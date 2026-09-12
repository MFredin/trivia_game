const LINKS = [
  { screen: 'start', label: 'Home' },
  { screen: 'leaderboard', label: 'Leaderboard' },
  { screen: 'friends', label: 'Friends' },
  { screen: 'achievements', label: 'Achievements' },
  { screen: 'settings', label: 'Settings' },
];

export default function NavBar({ currentUser, activeScreen, onNavigate, onLogout }) {
  return (
    <div className="running-header">
      <button type="button" className="running-title" onClick={() => onNavigate('start')}>
        The Restricted Section
      </button>
      {currentUser && (
        <div className="running-nav">
          {LINKS.map((link) => (
            <button
              key={link.screen}
              type="button"
              className={activeScreen === link.screen ? 'on' : ''}
              onClick={() => onNavigate(link.screen)}
            >
              {link.label}
            </button>
          ))}
          <button type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
