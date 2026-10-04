import Plate from './Plate.jsx';
import Avatar from './Avatar.jsx';

const when = (iso) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** Every conversation, newest first, with what was said last and how many are unread. */
export default function OwlInbox({ conversations, onOpen }) {
  return (
    <Plate>
      {conversations === null && <p className="explanation">Fetching&hellip;</p>}
      {conversations && conversations.length === 0 && (
        <p className="explanation">
          No owls yet. Open a friend&rsquo;s profile, or find them on the Friends screen, and choose &ldquo;Send an owl&rdquo;.
        </p>
      )}
      {conversations && conversations.length > 0 && (
        <ul className="friend-list">
          {conversations.map((c) => (
            <li key={c.username} className="friend-row owl-row">
              <button type="button" className="member-id" onClick={() => onOpen(c.username)}>
                <Avatar username={c.username} avatar={c.avatar} style={c.avatar_style} house={c.theme} size={40} />
                <span className="member-text owl-row-text">
                  <span className="member-name">
                    <span className={`online-dot ${c.online ? 'is-online' : ''}`} aria-hidden="true" />
                    {c.username}
                    <span className="owl-row-when">{when(c.last.created_at)}</span>
                  </span>
                  <span className={`owl-row-preview ${c.unread > 0 ? 'is-unread' : ''}`}>
                    {c.last.from_me ? 'You: ' : ''}
                    {c.last.body}
                  </span>
                </span>
                {c.unread > 0 && (
                  <span className="owl-badge" aria-label={`${c.unread} unread`}>
                    {c.unread}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="explanation owl-retention">Owls are deleted after 90 days.</p>
    </Plate>
  );
}
