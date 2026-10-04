import IconButton from './IconButton.jsx';
import Icon from './icons.jsx';
import PopoverMenu from './PopoverMenu.jsx';

/**
 * What the viewer can do about this player, which depends on how they already stand: someone
 * you are friends with has no "Add", someone who asked you has "Accept" and "Decline".
 * Challenge is offered to everyone but yourself, because the duel lobby never required a
 * friendship — only a username.
 */
export default function ProfileActions({ relationship, onAdd, onAccept, onDecline, onChallenge, onSendOwl, onEdit, onRemove, onBlock, onReport }) {
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
      {relationship === 'friends' && <IconButton icon="mail" label="Send an owl" showLabel onClick={onSendOwl} />}
      {/* Everything that is not a first-class action lives behind one menu, so a profile
          does not open with Block and Report as loud as Challenge. */}
      <PopoverMenu
        label="More actions"
        triggerClassName="icon-button icon-button--secondary"
        trigger={<Icon name="more" />}
        align="left"
        items={[
          ...(relationship === 'friends'
            ? [{ key: 'remove', label: 'Remove friend', icon: 'user-minus', onSelect: onRemove }]
            : []),
          { key: 'block', label: 'Block', icon: 'ban', danger: true, onSelect: onBlock },
          { key: 'report', label: 'Report', icon: 'alert', danger: true, onSelect: onReport },
        ]}
      />
    </div>
  );
}
