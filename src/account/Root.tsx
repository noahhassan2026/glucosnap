import { useEffect, useState } from "react";
import App from "../App";
import { AuthScreen } from "./AuthScreen";
import { AuthError, NO_SERVER, deleteAccount, loadSession, logOut, pull, startGuest, startSync, stopSync, type Session } from "./session";

// Decides what a visitor sees: the sign-up screen on a first visit, otherwise the app with
// their account's data loaded. The app remounts per account so it reads fresh data.
export function Root() {
  const [session, setSession] = useState<Session | null>(() => (NO_SERVER ? startGuest() : loadSession()));
  const [ready, setReady] = useState(session?.kind !== "user");
  const [error, setError] = useState<string | null>(null);
  const [signUp, setSignUp] = useState(false);

  const signOut = async () => {
    await logOut();
    setSignUp(false);
    setSession(null);
  };

  // A returning user: load their saved data before the app reads it.
  useEffect(() => {
    if (session?.kind !== "user" || ready) return;
    let live = true;
    pull(session)
      .then(() => live && setReady(true))
      .catch((e) => {
        if (!live) return;
        if (e instanceof AuthError && e.status === 401) return void signOut();
        setError(e instanceof Error ? e.message : "Couldn't load your account.");
      });
    return () => { live = false; };
  }, [session, ready]);

  useEffect(() => {
    if (session?.kind !== "user" || !ready) return;
    startSync(session, () => void signOut());
    return stopSync;
  }, [session, ready]);

  const enter = (s: Session) => {
    setSignUp(false);
    setError(null);
    setReady(true); // authenticate() already put the account's data in place
    setSession(s);
  };

  if (!session || signUp) {
    return (
      <div className="app">
        <AuthScreen onDone={enter} initial="signup" guestProgress={signUp} onCancel={signUp ? () => setSignUp(false) : undefined} />
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="app">
        <div className="auth">
          {error ? (
            <>
              <p className="error" role="alert">{error}</p>
              <button onClick={() => { setError(null); setReady(false); setSession({ ...session }); }}>Try again</button>
              <button className="ghost" onClick={() => void signOut()}>Log out</button>
            </>
          ) : <p className="muted">Loading your progress…</p>}
        </div>
      </div>
    );
  }
  return (
    <App
      key={session.kind === "user" ? session.username : "guest"}
      session={session}
      onSignUp={() => setSignUp(true)}
      onLogOut={() => void signOut()}
      onDelete={async () => {
        if (session.kind !== "user") return;
        await deleteAccount(session);
        setSession(null);
      }}
    />
  );
}
