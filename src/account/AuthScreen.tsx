import { useState, type FormEvent } from "react";
import { authenticate, startGuest, type Session } from "./session";

// First screen for new visitors: create an account, log in, or try it as a guest.
export function AuthScreen(props: { onDone: (s: Session) => void; initial?: "signup" | "login"; guestProgress?: boolean; onCancel?: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">(props.initial ?? "signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      props.onDone(await authenticate(mode, username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="brand auth-brand">
        <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--teal)" /><path d="M5 22 C10 22 11 9 16 9 S22 20 27 18" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" /></svg>
        <h1>GlucoSnap</h1>
      </div>
      <p className="muted auth-tag">Snap a meal, see your glucose curve before you eat it, and level up your pet with healthy habits.</p>

      <form className="card" onSubmit={submit}>
        <div className="seg auth-seg" role="tablist" aria-label="Create an account or log in">
          <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setError(null); }}>Create account</button>
          <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setError(null); }}>Log in</button>
        </div>
        {props.guestProgress && mode === "signup" && <p className="note">Your guest progress moves into the new account.</p>}
        {props.guestProgress && mode === "login" && <p className="note">Logging in loads that account's progress in place of this guest session.</p>}
        <label className="field">Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false}
            required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" title="Letters, numbers or underscores" />
        </label>
        <label className="field">Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "One moment…" : mode === "signup" ? "Create account" : "Log in"}</button>
        <p className="note">Your meals, glucose and health numbers are private to your account. Other players only see your name, level, streak and pet.</p>
      </form>

      {props.onCancel ? (
        <button className="ghost" onClick={props.onCancel}>Keep playing as a guest</button>
      ) : (
        <button className="ghost" onClick={() => props.onDone(startGuest())}>Try it as a guest</button>
      )}
      {!props.onCancel && <p className="note auth-guest">Guest progress stays in this browser only. You can create an account later and keep it.</p>}
    </div>
  );
}
