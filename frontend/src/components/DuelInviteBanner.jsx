import Avatar from './Avatar.jsx';
import IconButton from './IconButton.jsx';

/**
 * The invite that follows you to every screen: who it is from, and the same two small buttons a
 * friend request has, so a yes or a no looks the same wherever it is asked.
 */
export default function DuelInviteBanner({ invite, onAccept, onDecline }) {
  if (!invite) return null;
  return (
    <div className="duel-invite-banner" role="status">
      <span className="duel-invite-who">
        <Avatar
          username={invite.created_by_username}
          avatar={invite.created_by_avatar}
          style={invite.created_by_avatar_style}
          house={invite.created_by_theme}
          size={40}
        />
        <span>
          <strong className="duel-invite-name">{invite.created_by_username}</strong> has challenged you to a duel
        </span>
      </span>
      <span className="duel-invite-actions">
        <IconButton icon="check" label="Accept" variant="primary" wideLabel onClick={() => onAccept(invite.duel_id)} />
        <IconButton icon="x" label="Decline" wideLabel onClick={() => onDecline(invite.duel_id)} />
      </span>
    </div>
  );
}
