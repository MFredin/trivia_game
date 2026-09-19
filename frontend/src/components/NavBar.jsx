import { useRef } from 'react';
import HouseDevice from './HouseDevice.jsx';
import { DEFAULT_HOUSE } from '../constants/houses.js';

const LINKS = [
  { screen: 'start', label: 'Home' },
  { screen: 'leaderboard', label: 'Leaderboard' },
  { screen: 'friends', label: 'Friends' },
  { screen: 'achievements', label: 'Achievements' },
  { screen: 'settings', label: 'Settings' },
];

const TAP_COUNT_TO_TRIGGER = 7;
const TAP_RESET_MS = 1500;

export default function NavBar({ currentUser, activeScreen, onNavigate, onLogout, onSecretFound }) {
  // The mobile-friendly half of the Marauder's Map easter egg (see App.jsx for the
  // keydown-phrase half, which needs a physical keyboard). Tapping the wordmark itself
  // — the "tap the build number 7 times" pattern — works identically on touch, mouse, or
  // keyboard activation, with no permissions and no gesture tuning required.
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

  const handleWordmarkClick = () => {
    tapCountRef.current += 1;
    clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= TAP_COUNT_TO_TRIGGER) {
      tapCountRef.current = 0;
      onSecretFound?.();
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, TAP_RESET_MS);
  };

  return (
    <div className="running-header">
      <button
        type="button"
        className="running-title"
        onClick={() => {
          handleWordmarkClick();
          onNavigate('start');
        }}
      >
        <HouseDevice house={currentUser?.theme ?? DEFAULT_HOUSE} size={30} />
        The Restricted Section
      </button>
      {currentUser && (
        // Navigation, not toggles: aria-current says "this is the screen you are on", which
        // is what the `on` class has been saying visually and to nobody else.
        <div className="running-nav">
          {LINKS.map((link) => (
            <button
              key={link.screen}
              type="button"
              className={activeScreen === link.screen ? 'on' : ''}
              aria-current={activeScreen === link.screen ? 'page' : undefined}
              onClick={() => onNavigate(link.screen)}
            >
              {link.label}
            </button>
          ))}
          {currentUser.is_admin && (
            <button
              type="button"
              className={activeScreen === 'admin-suggestions' ? 'on' : ''}
              aria-current={activeScreen === 'admin-suggestions' ? 'page' : undefined}
              onClick={() => onNavigate('admin-suggestions')}
            >
              Admin
            </button>
          )}
          <button type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
