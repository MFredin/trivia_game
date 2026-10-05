import Icon from './icons.jsx';

/**
 * The envelope in the running header, with the count of unread owls on it. A button like any other
 * nav control: 44px, named for what it does and, when there is something waiting, for how much.
 */
export default function OwlPostLink({ unread, active, onOpen }) {
  const label = unread > 0 ? `Owl Post, ${unread} unread` : 'Owl Post';
  return (
    <button type="button" className={`owl-link ${active ? 'on' : ''}`} aria-current={active ? 'page' : undefined} aria-label={label} title={label} onClick={onOpen}>
      <Icon name="owl" size={26} />
      {unread > 0 && (
        <span className="owl-badge owl-link-badge" aria-hidden="true">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
