// Accounts: the app keeps working from localStorage as before, and this module copies the
// user's saved keys to and from their account on the server. Logging in loads the account's
// data into the browser; every save after that is sent back a moment later.
import { onSave } from "../storage";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
export const NO_SERVER = import.meta.env.VITE_USE_MOCK === "1";

// What belongs to the account. Per-device keys (which reminders fired today) stay local.
export const SYNCED = [
  "glucosnap-profile",
  "glucosnap-cgm",
  "glucosnap-history",
  "glucosnap-quest",
  "glucosnap-day-offset",
  "glucosnap-coach",
  "glucosnap-reminders",
];
const SESSION_KEY = "glucosnap-session";
const OWNER_KEY = "glucosnap-owner"; // whose data is in this browser: a username or "guest"

export type Session = { kind: "user"; username: string; token: string } | { kind: "guest" };

export class AuthError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function get(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function set(key: string, v: string | null) {
  try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, v); } catch { /* unavailable */ }
}

export function loadSession(): Session | null {
  try {
    const s = JSON.parse(get(SESSION_KEY) ?? "null");
    if (s?.kind === "guest" || (s?.kind === "user" && s.token && s.username)) return s;
  } catch { /* fall through */ }
  return null;
}

export const owner = () => get(OWNER_KEY);

function localData(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SYNCED) {
    const v = get(k);
    if (v === null) continue;
    try { out[k] = JSON.parse(v); } catch { /* skip */ }
  }
  return out;
}

function clearLocal() {
  for (const k of SYNCED) set(k, null);
  set("glucosnap-reminders-fired", null);
}

function writeLocal(data: Record<string, unknown>, who: string) {
  clearLocal();
  for (const k of SYNCED) if (k in data) set(k, JSON.stringify(data[k]));
  set(OWNER_KEY, who);
}

async function call(path: string, init: RequestInit = {}, token?: string) {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  } catch {
    throw new AuthError(0, "Can't reach the GlucoSnap server. Check your connection, or try as a guest.");
  }
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const down = res.status === 404 || res.status === 502 || res.status === 504 || (res.status === 500 && !text);
    const detail = typeof body?.detail === "string" ? body.detail : null;
    throw new AuthError(down ? 0 : res.status, down ? "Can't reach the GlucoSnap server. Try as a guest for now." : detail ?? res.statusText);
  }
  return body;
}

// Sign up or log in. A guest who signs up keeps the progress they made; logging in to an
// existing account replaces this browser's data with the account's.
export async function authenticate(mode: "signup" | "login", username: string, password: string): Promise<Session> {
  const r = await call(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify({ username, password }) });
  const s: Session = { kind: "user", username: r.username, token: r.token };
  if (mode === "signup") {
    if (owner() === "guest") await call("/api/me/data", { method: "PUT", body: JSON.stringify({ data: localData() }) }, s.token);
    else clearLocal();
    set(OWNER_KEY, s.username);
  } else {
    await pull(s);
  }
  set(SESSION_KEY, JSON.stringify(s));
  return s;
}

export function startGuest(): Session {
  if (owner() !== "guest") clearLocal();
  set(OWNER_KEY, "guest");
  const s: Session = { kind: "guest" };
  set(SESSION_KEY, JSON.stringify(s));
  return s;
}

// Load the account's data into the browser. When the server can't be reached, carry on with
// the copy already here if it is this user's.
export async function pull(s: Session & { kind: "user" }) {
  try {
    const r = await call("/api/me", {}, s.token);
    writeLocal(r.data ?? {}, s.username);
  } catch (e) {
    if (e instanceof AuthError && e.status === 0 && owner() === s.username) return;
    throw e;
  }
}

export async function logOut() {
  await flush();
  stopSync();
  set(SESSION_KEY, null);
  set(OWNER_KEY, null);
  clearLocal();
}

export async function deleteAccount(s: Session & { kind: "user" }) {
  stopSync();
  await call("/api/me", { method: "DELETE" }, s.token);
  set(SESSION_KEY, null);
  set(OWNER_KEY, null);
  clearLocal();
}

// ---------- background sync ----------
let active: { token: string; onExpired: () => void } | null = null;
let timer: number | undefined;
let dirty = false;
let unsubscribe: (() => void) | null = null;

export function startSync(s: Session & { kind: "user" }, onExpired: () => void) {
  stopSync();
  active = { token: s.token, onExpired };
  unsubscribe = onSave((key) => {
    if (!SYNCED.includes(key)) return;
    dirty = true;
    clearTimeout(timer);
    timer = window.setTimeout(() => void flush(), 1500);
  });
  window.addEventListener("pagehide", flushOnLeave);
}

export function stopSync() {
  unsubscribe?.();
  unsubscribe = null;
  clearTimeout(timer);
  window.removeEventListener("pagehide", flushOnLeave);
  active = null;
}

export async function flush() {
  if (!active || !dirty) return;
  dirty = false;
  const { token, onExpired } = active;
  try {
    await call("/api/me/data", { method: "PUT", body: JSON.stringify({ data: localData() }) }, token);
  } catch (e) {
    if (e instanceof AuthError && e.status === 401) return onExpired();
    dirty = true; // offline or a server hiccup: try again with the next change
  }
}

function flushOnLeave() {
  if (!active || !dirty) return;
  dirty = false;
  try {
    fetch(`${BASE}/api/me/data`, {
      method: "PUT",
      keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${active.token}` },
      body: JSON.stringify({ data: localData() }),
    }).catch(() => {});
  } catch { /* keepalive bodies are capped at 64 KB; the debounced save usually got there first */ }
}

export interface Player { name: string; level: number; streak: number; evo: number; path: { element?: string; form?: string }; me?: boolean }

export async function leaderboard(s: Session | null): Promise<Player[] | null> {
  if (NO_SERVER) return null;
  try {
    const r = await call("/api/leaderboard", {}, s?.kind === "user" ? s.token : undefined);
    return Array.isArray(r?.players) ? r.players : null;
  } catch {
    return null;
  }
}
