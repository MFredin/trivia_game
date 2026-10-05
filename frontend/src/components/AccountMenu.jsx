import Avatar from './Avatar.jsx';
import PopoverMenu from './PopoverMenu.jsx';
import PlayerTitle from './PlayerTitle.jsx';
import { HOUSES } from '../constants/houses.js';

const HOUSE_LABEL = Object.fromEntries(HOUSES.map((h) => [h.id, h.label]));

/**
 * The player's own corner of the nav: their avatar, opening a menu of everything that is about
 * them rather than about the game — profile, settings, the moderator's screens, signing out.
 * Those used to be five more words in the row of links beside Home and Leaderboard.
 */
export default function AccountMenu({ user, active, onViewProfile, onNavigate, onLogout }) {
  const items = [
    { key: 'profile', label: 'My profile', icon: 'user', onSelect: () => onViewProfile(user.username) },
    { key: 'edit-profile', label: 'Edit profile', icon: 'edit', onSelect: () => onNavigate('edit-profile') },
    { key: 'settings', label: 'Settings', icon: 'cog', onSelect: () => onNavigate('settings') },
    ...(user.is_admin
      ? [
          { key: 'questions', label: 'Review questions', icon: 'check', onSelect: () => onNavigate('admin-suggestions') },
          { key: 'reports', label: 'Review reports', icon: 'alert', onSelect: () => onNavigate('admin-reports') },
          { key: 'titles', label: 'Manage titles', icon: 'user', onSelect: () => onNavigate('admin-titles') },
        ]
      : []),
    { key: 'logout', label: 'Log out', icon: 'logout', onSelect: onLogout },
  ];

  return (
    <PopoverMenu
      label="Account menu"
      triggerClassName={`account-trigger ${active ? 'on' : ''}`}
      triggerCurrent={active}
      trigger={<Avatar username={user.username} avatar={user.avatar} style={user.avatar_style} house={user.theme} size={34} />}
      header={
        <>
          <Avatar username={user.username} avatar={user.avatar} style={user.avatar_style} house={user.theme} size={40} />
          <span className="account-menu-who">
            <span className="account-menu-name">{user.username}</span>
            <PlayerTitle title={user.title} />
            <span className="account-menu-house">{HOUSE_LABEL[user.theme]}</span>
          </span>
        </>
      }
      items={items}
    />
  );
}
