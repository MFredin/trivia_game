const LINKS = [
  { screen: 'start', label: 'Home' },
  { screen: 'leaderboard', label: 'Leaderboard' },
  { screen: 'friends', label: 'Friends' },
  { screen: 'achievements', label: 'Achievements' },
];

export default function NavBar({ currentUser, activeScreen, onNavigate, onLogout }) {
  return (
    <div className="nav-bar">
      <button type="button" className="nav-wordmark" onClick={() => onNavigate('start')}>
        <svg className="nav-wordmark-glyph" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 4.5C4 3.7 4.7 3 5.5 3H17a2 2 0 0 1 2 2v15.2c0 .5-.6.8-1 .5l-1.2-.9a1 1 0 0 0-1.2 0l-1.1.9a1 1 0 0 1-1.2 0l-1.1-.9a1 1 0 0 0-1.2 0l-1.1.9a1 1 0 0 1-1.2 0l-1.1-.9a1 1 0 0 0-1.2 0l-1.2.9a.6.6 0 0 1-1-.5V4.5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M7.5 8h9M7.5 11.5h9M7.5 15h5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
        The Restricted Section
      </button>
      {currentUser && (
        <div className="nav-links">
          {LINKS.map((link) => (
            <button
              key={link.screen}
              type="button"
              className={`nav-btn ${activeScreen === link.screen ? 'is-active' : ''}`}
              onClick={() => onNavigate(link.screen)}
            >
              {link.label}
            </button>
          ))}
          <button type="button" className="nav-btn" onClick={onLogout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
