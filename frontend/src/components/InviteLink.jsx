import Plate from './Plate.jsx';

/** The invite link, as a plate on the Friends screen. Its state comes from useInviteLink. */
export default function InviteLink({ invite }) {
  return (
    <Plate>
      <h3 className="plate-subhead">Invite a friend</h3>
      <p className="explanation" style={{ margin: '0 0 1rem' }}>
        Share this link — when someone registers through it, you are connected at once.
      </p>
      <div className="invite-link-row">
        <input type="text" readOnly aria-label="Your invite link" value={invite.link ?? 'Generating…'} onFocus={(e) => e.target.select()} />
        <button type="button" className="secondary-button" onClick={invite.copy} disabled={!invite.link}>
          {invite.copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </Plate>
  );
}
