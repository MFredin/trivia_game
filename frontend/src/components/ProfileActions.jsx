import IconButton from './IconButton.jsx';

/**
 * What the viewer can do about this player, which depends on how they already stand: someone
 * you are friends with has no "Add", someone who asked you has "Accept" and "Decline".
 * Challenge is offered to everyone but yourself, because the duel lobby never required a
 * friendship — only a username.
 */
export default function ProfileActions({ relationship, onAdd, onAccept, onDecline, onChallenge, onEdit }) {
  if (relationship === 'self') {
    return (
      <div className="profile-actions">
        <IconButton icon="edit" label="Edit sigil & settings" showLabel onClick={onEdit} />
      </div>
    );
  }

  return (
    <div className="profile-actions">
      {relationship === 'none' && <IconButton icon="user-plus" label="Add friend" showLabel onClick={onAdd} />}
      {relationship === 'pending_sent' && <IconButton icon="check" label="Request sent" showLabel disabled />}
      {relationship === 'pending_received' && (
        <>
          <IconButton icon="check" label="Accept request" showLabel variant="primary" onClick={onAccept} />
          <IconButton icon="x" label="Decline" showLabel onClick={onDecline} />
        </>
      )}
      <IconButton
        icon="flag"
        label="Challenge"
        showLabel
        variant={relationship === 'pending_received' ? 'secondary' : 'primary'}
        onClick={onChallenge}
      />
    </div>
  );
}
