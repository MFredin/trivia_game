import { useRef } from 'react';
import BrandMark from './BrandMark.jsx';
import AccountMenu from './AccountMenu.jsx';
import OwlPostLink from './OwlPostLink.jsx';

const LINKS = [
  { screen: 'start', label: 'Home' },
  { screen: 'leaderboard', label: 'Leaderboard' },
  { screen: 'friends', label: 'Friends' },
  { screen: 'achievements', label: 'Achievements' },
];

// Screens that live behind the avatar menu rather than in the row of links; the avatar takes
// the "you are here" underline for them.
const ACCOUNT_SCREENS = ['settings', 'edit-profile', 'admin-suggestions', 'admin-reports'];

const TAP_COUNT_TO_TRIGGER = 7;
const TAP_RESET_MS = 1500;

export default function NavBar({ currentUser, activeScreen, unreadOwls, onNavigate, onViewProfile, onLogout, onSecretFound }) {
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
        <BrandMark size={30} />
        The Restricted Section
      </button>
      {currentUser && (
        <>
          {/* The account menu comes before the links in the markup so that on a phone, where
              the links drop to their own row, it stays beside the wordmark; the stylesheet
              puts it after them on a wide screen. */}
          <div className="running-account">
            <OwlPostLink unread={unreadOwls} active={activeScreen === 'owl-post'} onOpen={() => onNavigate('owl-post')} />
            <AccountMenu
              user={currentUser}
              active={ACCOUNT_SCREENS.includes(activeScreen)}
              onViewProfile={onViewProfile}
              onNavigate={onNavigate}
              onLogout={onLogout}
            />
          </div>
          {/* Navigation, not toggles: aria-current says "this is the screen you are on", which
              is what the `on` class has been saying visually and to nobody else. */}
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
          </div>
        </>
      )}
    </div>
  );
}
