"""Checks for sign-up, login, saved data privacy and the leaderboard, on a temporary folder store.

  python accounts_test.py          # from the api/ folder
  AZURE_STORAGE_CONNECTION_STRING=... python accounts_test.py   # same checks against Blob Storage (e.g. Azurite)
"""
import os, tempfile

from fastapi import FastAPI
from fastapi.testclient import TestClient

import accounts

if not os.environ.get("AZURE_STORAGE_CONNECTION_STRING"):
    os.environ["DATA_DIR"] = tempfile.mkdtemp()
os.environ.pop("SESSION_SECRET", None)
store = accounts.make_store()
for k in store.list("users") + store.list("data"):
    store.delete(k)


def client():
    app = FastAPI()
    app.include_router(accounts.router(accounts.Accounts(store)))
    return TestClient(app)


c = client()
auth = lambda t: {"Authorization": f"Bearer {t}"}

# sign-up rules
assert c.post("/api/auth/signup", json={"username": "a", "password": "secret1"}).status_code == 422
assert c.post("/api/auth/signup", json={"username": "maya", "password": "123"}).status_code == 422
r = c.post("/api/auth/signup", json={"username": "Maya", "password": "secret1"})
assert r.status_code == 200, r.text
maya = r.json()["token"]
assert r.json()["username"] == "maya"
assert c.post("/api/auth/signup", json={"username": "maya", "password": "other12"}).status_code == 409

# the password is stored hashed
rec = store.get("users/maya.json")
assert "secret1" not in str(rec) and rec["password"].startswith("scrypt$")

# login
assert c.post("/api/auth/login", json={"username": "maya", "password": "wrong!!"}).status_code == 401
assert c.post("/api/auth/login", json={"username": "MAYA", "password": "secret1"}).status_code == 200

# saved data round trip; health data stays private
data = {"glucosnap-quest": {"playerName": "Maya", "level": 4, "streak": 6, "evo": 2, "petPath": {"element": "ember"}},
        "glucosnap-history": [{"label": "Spaghetti", "carbs": 85}], "glucosnap-profile": {"a1c": 5.9}}
assert c.get("/api/me").status_code == 401
assert c.get("/api/me", headers=auth("junk.token")).status_code == 401
assert c.get("/api/me", headers=auth(maya)).json()["data"] == {}
assert c.put("/api/me/data", headers=auth(maya), json={"data": data}).json()["ok"]
assert c.get("/api/me", headers=auth(maya)).json()["data"] == data

jo = c.post("/api/auth/signup", json={"username": "jordan", "password": "secret2"}).json()["token"]
assert c.get("/api/me", headers=auth(jo)).json()["data"] == {}
c.put("/api/me/data", headers=auth(jo), json={"data": {"glucosnap-quest": {"level": 7, "streak": 1}}})

board = c.get("/api/leaderboard").json()["players"]
assert [p["name"] for p in board] == ["jordan", "Maya"], board
assert set(board[1]) == {"name", "level", "streak", "evo", "path", "me"} and not any(p["me"] for p in board)
assert [p["me"] for p in c.get("/api/leaderboard", headers=auth(maya)).json()["players"]] == [False, True]
assert "Spaghetti" not in str(board) and "5.9" not in str(board)

# a token signed with another key is refused
other = accounts.Accounts(accounts.LocalStore(tempfile.mkdtemp()))
assert c.get("/api/me", headers=auth(other.token("maya"))).status_code == 401

# a restarted server (new process, same store) keeps accounts, data and tokens
c2 = client()
assert c2.get("/api/me", headers=auth(maya)).json()["data"] == data
assert c2.post("/api/auth/login", json={"username": "jordan", "password": "secret2"}).status_code == 200

# too-large uploads are refused
big = {"data": {"glucosnap-cgm": "x" * (accounts.MAX_DATA_BYTES + 10)}}
assert c.put("/api/me/data", headers=auth(maya), json=big).status_code == 413

# repeated wrong passwords are throttled
for _ in range(10):
    c.post("/api/auth/login", json={"username": "maya", "password": "nope123"})
assert c.post("/api/auth/login", json={"username": "maya", "password": "secret1"}).status_code == 429

# deleting the account removes the data and the leaderboard row
assert c2.delete("/api/me", headers=auth(jo)).json()["ok"]
assert store.get("data/jordan.json") is None
assert [p["name"] for p in c2.get("/api/leaderboard").json()["players"]] == ["Maya"]

print("accounts checks passed on", type(store).__name__)
