import Avatar from './Avatar.jsx';
import IconButton from './IconButton.jsx';
import PlayerTitle from './PlayerTitle.jsx';

const STATUS_CAPTION = {
  friends: 'Friends',
  pending_sent: 'Request sent',
  pending_received: 'Wants to be friends',
  none: null,
};

/**
 * One player in a list: who they are (avatar, name, online dot, how you stand), and what can be
 * done about them as icon buttons. Every list of people in the app — online now, search, the
 * directory, requests, your friends — is this, so a player looks and behaves the same in all of
 * them. An action is shown only if its handler is passed, which is how the lists differ.
 *
 * The name opens their profile and is the one big target; the buttons are 44px squares, glyph
 * only on a phone and glyph plus word on a wide screen. The dot is drawn only where presence is
 * actually known (`online` is true or false), never guessed, and an owl or a challenge is offered only
 * when the server says the other player would accept it (`can_owl`, `can_challenge`).
 * `answerable` is for a row that asks for a yes or a no without being a friend request (a duel invite).
 */
export default function MemberRow({
  member,
  showStatus = true,
  caption: captionOverride,
  answerable = false,
  onViewProfile,
  onAdd,
  onAccept,
  onDecline,
  onChallenge,
  onMessage,
  onRemove,
}) {
  const caption = captionOverride ?? (showStatus ? STATUS_CAPTION[member.status] : null);

  return (
    <li className="friend-row member-row">
      <button type="button" className="member-id" onClick={onViewProfile}>
        <Avatar username={member.username} avatar={member.avatar} style={member.avatar_style} house={member.theme} size={40} />
        <span className="member-text">
          <span className="member-name">
            {typeof member.online === 'boolean' && (
              <span className={`online-dot ${member.online ? 'is-online' : ''}`} aria-hidden="true" />
            )}
            {member.username}
          </span>
          {(member.title || caption) && (
            <span className="member-meta">
              <PlayerTitle title={member.title} />
              {caption && <span className="member-caption">{caption}</span>}
            </span>
          )}
        </span>
      </button>
      <span className="member-actions">
        {(member.status === 'pending_received' || answerable) && onAccept && (
          <IconButton icon="check" label="Accept" variant="primary" wideLabel onClick={onAccept} />
        )}
        {(member.status === 'pending_received' || answerable) && onDecline && (
          <IconButton icon="x" label="Decline" wideLabel onClick={onDecline} />
        )}
        {member.status === 'none' && onAdd && <IconButton icon="user-plus" label="Add friend" wideLabel onClick={onAdd} />}
        {onMessage && member.can_owl && <IconButton icon="owl" label="Send an owl" wideLabel onClick={onMessage} />}
        {onChallenge && member.can_challenge && <IconButton icon="flag" label="Challenge" variant="primary" wideLabel onClick={onChallenge} />}
        {onRemove && <IconButton icon="user-minus" label="Remove friend" wideLabel onClick={onRemove} />}
      </span>
    </li>
  );
}
