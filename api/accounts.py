"""User accounts: sign-up, login, each user's saved app data, and the leaderboard.

Storage is a folder of JSON files by default (DATA_DIR, ./data). Container disk is wiped on every
redeploy, so production sets AZURE_STORAGE_CONNECTION_STRING and the same files live in Azure Blob
Storage instead (container AZURE_STORAGE_CONTAINER, default "glucosnap"):

  users/<username>.json   login record: scrypt password hash + leaderboard fields
  data/<username>.json    the user's app data (profile, meal history, CGM, quest and pet state)
  secret.json             signing key for login tokens, made on first start unless SESSION_SECRET is set

App data holds health data, so it is only ever returned to its owner. The leaderboard reads only
name, level, streak and pet stage.

POST   /api/auth/signup  {username, password} -> {token, username}
POST   /api/auth/login   {username, password} -> {token, username}
GET    /api/me           (Bearer token) -> {username, data, updated}
PUT    /api/me/data      (Bearer token) {data} -> {ok, updated}
DELETE /api/me           (Bearer token) -> deletes the account and its data
GET    /api/leaderboard  (token optional) -> {players: [{name, level, streak, evo, path, me}]}
"""
import base64, hashlib, hmac, json, os, re, secrets, threading, time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

TOKEN_DAYS = 30
MAX_DATA_BYTES = 2_000_000
USERNAME = re.compile(r"^[a-z0-9_]{3,20}$")
SCRYPT = dict(n=2 ** 14, r=8, p=1, dklen=32)


# ---------- storage -----------------------------------------------------------------------
class LocalStore:
    def __init__(self, root: str):
        self.root = root

    def _path(self, key: str) -> str:
        return os.path.join(self.root, *key.split("/"))

    def get(self, key: str) -> Optional[dict]:
        try:
            with open(self._path(key)) as f:
                return json.load(f)
        except FileNotFoundError:
            return None

    def put(self, key: str, obj: dict):
        p = self._path(key)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        tmp = p + ".tmp"
        with open(tmp, "w") as f:
            json.dump(obj, f)
        os.replace(tmp, p)

    def delete(self, key: str):
        try:
            os.remove(self._path(key))
        except FileNotFoundError:
            pass

    def list(self, prefix: str):
        d = self._path(prefix)
        if not os.path.isdir(d):
            return []
        return [prefix + "/" + n for n in os.listdir(d) if n.endswith(".json")]


class BlobStore:
    def __init__(self, conn: str, container: str):
        from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
        from azure.storage.blob import BlobServiceClient
        self.missing = ResourceNotFoundError
        self.c = BlobServiceClient.from_connection_string(conn).get_container_client(container)
        try:
            self.c.create_container()
        except ResourceExistsError:
            pass

    def get(self, key: str) -> Optional[dict]:
        try:
            return json.loads(self.c.download_blob(key).readall())
        except self.missing:
            return None

    def put(self, key: str, obj: dict):
        self.c.upload_blob(key, json.dumps(obj).encode(), overwrite=True)

    def delete(self, key: str):
        try:
            self.c.delete_blob(key)
        except self.missing:
            pass

    def list(self, prefix: str):
        return [b.name for b in self.c.list_blobs(name_starts_with=prefix + "/")]


def make_store():
    conn = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if conn:
        return BlobStore(conn, os.environ.get("AZURE_STORAGE_CONTAINER", "glucosnap"))
    here = os.path.dirname(os.path.abspath(__file__))
    return LocalStore(os.environ.get("DATA_DIR", os.path.join(here, "data")))


# ---------- accounts ----------------------------------------------------------------------
def hash_password(pw: str, salt: Optional[bytes] = None) -> str:
    salt = salt or secrets.token_bytes(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, **SCRYPT)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(h).decode()


def check_password(pw: str, stored: str) -> bool:
    try:
        _, salt, _ = stored.split("$")
        return hmac.compare_digest(hash_password(pw, base64.b64decode(salt)), stored)
    except ValueError:
        return False


def board_fields(data: dict, username: str) -> dict:
    """The only fields of a user's data that anyone else can see. No health data."""
    q = data.get("glucosnap-quest") if isinstance(data, dict) else None
    q = q if isinstance(q, dict) else {}

    def num(k, hi):
        v = q.get(k)
        return max(0, min(int(v), hi)) if isinstance(v, (int, float)) else 0

    path = q.get("petPath") if isinstance(q.get("petPath"), dict) else {}
    name = q.get("playerName") if isinstance(q.get("playerName"), str) else ""
    name = "" if name.strip().lower() == "you" else name  # the app's placeholder name
    return {
        "name": (name.strip() or username)[:24],
        "level": max(1, num("level", 999)),
        "streak": num("streak", 9999),
        "evo": num("evo", 4),
        "path": {k: v for k, v in path.items() if k in ("element", "form") and isinstance(v, str)},
    }


class Accounts:
    def __init__(self, store):
        self.store = store
        self.lock = threading.Lock()
        self._users: Optional[Dict[str, dict]] = None  # single replica, so an in-memory cache is safe
        secret = os.environ.get("SESSION_SECRET")
        if not secret:
            rec = store.get("secret.json")
            if not rec:
                rec = {"key": secrets.token_hex(32)}
                store.put("secret.json", rec)
            secret = rec["key"]
        self.key = secret.encode()
        self.fails: Dict[str, list] = {}

    @property
    def users(self) -> Dict[str, dict]:
        if self._users is None:
            loaded = {}
            for k in self.store.list("users"):
                u = self.store.get(k)
                if u:
                    loaded[u["username"]] = u
            self._users = loaded
        return self._users

    # tokens: base64(username:expiry).hmac
    def token(self, username: str) -> str:
        body = base64.urlsafe_b64encode(f"{username}:{int(time.time()) + TOKEN_DAYS * 86400}".encode()).decode()
        return body + "." + hmac.new(self.key, body.encode(), hashlib.sha256).hexdigest()

    def user_for(self, token: str) -> Optional[str]:
        try:
            body, sig = token.split(".")
            if not hmac.compare_digest(sig, hmac.new(self.key, body.encode(), hashlib.sha256).hexdigest()):
                return None
            username, exp = base64.urlsafe_b64decode(body).decode().rsplit(":", 1)
        except (ValueError, UnicodeDecodeError):
            return None
        if int(exp) < time.time() or username not in self.users:
            return None
        return username

    def throttle(self, ip: str):
        now = time.time()
        recent = [t for t in self.fails.get(ip, []) if now - t < 600]
        self.fails[ip] = recent
        if len(recent) >= 10:
            raise HTTPException(429, "Too many tries. Wait a few minutes and try again.")

    def signup(self, username: str, password: str) -> dict:
        username = username.strip().lower()
        if not USERNAME.match(username):
            raise HTTPException(422, "Usernames are 3 to 20 letters, numbers or underscores.")
        if len(password) < 6:
            raise HTTPException(422, "Use a password of at least 6 characters.")
        if len(password) > 200:
            raise HTTPException(422, "That password is too long.")
        with self.lock:
            if username in self.users:
                raise HTTPException(409, "That username is taken.")
            u = {"username": username, "password": hash_password(password), "created": int(time.time()),
                 "board": board_fields({}, username)}
            self.store.put(f"users/{username}.json", u)
            self.users[username] = u
        return {"token": self.token(username), "username": username}

    def login(self, username: str, password: str, ip: str) -> dict:
        self.throttle(ip)
        u = self.users.get(username.strip().lower())
        if not u or not check_password(password, u["password"]):
            self.fails.setdefault(ip, []).append(time.time())
            raise HTTPException(401, "Wrong username or password.")
        return {"token": self.token(u["username"]), "username": u["username"]}

    def load(self, username: str) -> dict:
        return self.store.get(f"data/{username}.json") or {"data": {}, "updated": 0}

    def save(self, username: str, data: dict) -> int:
        updated = int(time.time() * 1000)
        with self.lock:
            self.store.put(f"data/{username}.json", {"data": data, "updated": updated})
            u = dict(self.users[username], board=board_fields(data, username))
            self.store.put(f"users/{username}.json", u)
            self.users[username] = u
        return updated

    def delete(self, username: str):
        with self.lock:
            self.store.delete(f"data/{username}.json")
            self.store.delete(f"users/{username}.json")
            self.users.pop(username, None)

    def leaderboard(self, me: Optional[str] = None, limit: int = 50) -> list:
        rows = [dict(u["board"], me=name == me) for name, u in self.users.items()]
        rows.sort(key=lambda r: (-r["level"], -r["streak"]))
        return rows[:limit]


# ---------- routes ------------------------------------------------------------------------
class Credentials(BaseModel):
    username: str
    password: str


class SaveData(BaseModel):
    data: Dict[str, Any]


def router(accounts: Accounts) -> APIRouter:
    r = APIRouter()

    def viewer(authorization: Optional[str]) -> Optional[str]:
        token = (authorization or "").removeprefix("Bearer ").strip()
        return accounts.user_for(token) if token else None

    def current(authorization: Optional[str]) -> str:
        user = viewer(authorization)
        if not user:
            raise HTTPException(401, "Please log in again.")
        return user

    @r.post("/api/auth/signup")
    def signup(c: Credentials):
        return accounts.signup(c.username, c.password)

    @r.post("/api/auth/login")
    def login(c: Credentials, request: Request):
        return accounts.login(c.username, c.password, request.client.host if request.client else "?")

    @r.get("/api/me")
    def me(authorization: Optional[str] = Header(None)):
        user = current(authorization)
        return {"username": user, **accounts.load(user)}

    @r.put("/api/me/data")
    async def save(request: Request, authorization: Optional[str] = Header(None)):
        user = current(authorization)
        body = await request.body()
        if len(body) > MAX_DATA_BYTES:
            raise HTTPException(413, "Saved data is too large.")
        try:
            data = SaveData.model_validate_json(body).data
        except ValueError:
            raise HTTPException(422, "Expected {\"data\": {...}}.")
        return {"ok": True, "updated": accounts.save(user, data)}

    @r.delete("/api/me")
    def delete(authorization: Optional[str] = Header(None)):
        accounts.delete(current(authorization))
        return {"ok": True}

    @r.get("/api/leaderboard")
    def leaderboard(authorization: Optional[str] = Header(None)):
        # public, and only name, level, streak and pet; "me" marks the caller's own row when logged in
        return {"players": accounts.leaderboard(viewer(authorization))}

    return r
