export default function DuelInviteBanner({ invite, onAccept, onDecline }) {
  if (!invite) return null;
  return (
    <div className="duel-invite-banner">
      <span>{invite.created_by_username} has challenged you to a duel!</span>
      <span className="duel-invite-actions">
        <button type="button" className="primary-button" onClick={() => onAccept(invite.duel_id)}>
          Accept
        </button>
        <button type="button" className="secondary-button" onClick={() => onDecline(invite.duel_id)}>
          Decline
        </button>
      </span>
    </div>
  );
}
