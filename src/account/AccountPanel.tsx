import { useState } from "react";
import type { Session } from "./session";

export function AccountPanel(props: {
  session: Session;
  onSignUp: () => void;
  onLogOut: () => void;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const { session } = props;
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="acct-title" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="dialog">
        <div className="spread">
          <h2 id="acct-title">{session.kind === "user" ? session.username : "Guest"}</h2>
          <button className="ghost small-btn" onClick={props.onClose} aria-label="Close">✕</button>
        </div>
        {session.kind === "guest" ? (
          <>
            <p className="small">You're playing as a guest, so your progress lives only in this browser and you're not on the leaderboard yet.</p>
            <button onClick={props.onSignUp}>Create an account and keep my progress</button>
            <button className="ghost" onClick={props.onLogOut}>Leave guest mode</button>
          </>
        ) : (
          <>
            <p className="small">Your progress saves to your account, so it follows you to any device you log in on.</p>
            <p className="note">Meals, glucose and health numbers are private. The leaderboard shows only your quest name, level, streak and pet.</p>
            <button className="ghost" onClick={props.onLogOut}>Log out</button>
            {!confirm ? (
              <button className="ghost" onClick={() => setConfirm(true)}>Delete my account</button>
            ) : (
              <div className="cgm-box">
                <p className="small">This deletes your account and everything saved in it. It can't be undone.</p>
                <div className="row">
                  <button className="danger-btn" onClick={() => props.onDelete().catch((e) => setError(e instanceof Error ? e.message : "Couldn't delete the account."))}>Delete for good</button>
                  <button className="ghost" onClick={() => setConfirm(false)}>Cancel</button>
                </div>
                {error && <p className="error" role="alert">{error}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
