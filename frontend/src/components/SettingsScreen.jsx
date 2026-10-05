import { useEffect, useState } from 'react';
import Plate from './Plate.jsx';
import HouseDevice from './HouseDevice.jsx';
import { HOUSES } from '../constants/houses.js';
import PrivacySettings from './PrivacySettings.jsx';
import BlockedPlayers from './BlockedPlayers.jsx';
import OwlPostSettings from './OwlPostSettings.jsx';
import ChallengeSettings from './ChallengeSettings.jsx';
import PasswordSettings from './PasswordSettings.jsx';
import DeleteAccountSection from './DeleteAccountSection.jsx';
import { getInviteCode } from '../api/auth.js';

export default function SettingsScreen({ user, onSelectTheme, token, onViewOwnProfile, onEditProfile, account, safety }) {
  const theme = user.theme;
  const [inviteCode, setInviteCode] = useState(null);
  const [copyLabel, setCopyLabel] = useState('Copy link');

  useEffect(() => {
    if (!token) return;
    getInviteCode(token)
      .then((data) => setInviteCode(data.invite_code))
      .catch(() => {});
  }, [token]);

  const inviteLink = inviteCode ? `${window.location.origin}/?invite=${inviteCode}` : null;

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      // Clipboard API unavailable (older browser, insecure context) — fall back to a
      // manual select-and-copy the user can trigger themselves via Ctrl/Cmd+C.
      const textarea = document.createElement('textarea');
      textarea.value = inviteLink;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy link'), 2000);
  };

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">The Bindery</p>
          <h2 className="screen-title">Choose Your Binding</h2>
        </div>
      </div>
      <Plate>
        <p className="explanation" style={{ margin: '0 0 1.4rem' }}>
          Pick a house and its colors — cover, trim, and ink — apply everywhere at once.
        </p>
        <div className="house-swatches">
          {HOUSES.map((house) => (
            <button
              key={house.id}
              type="button"
              className={`house-swatch ${theme === house.id ? 'is-active' : ''}`}
              aria-pressed={theme === house.id}
              onClick={() => onSelectTheme(house.id)}
            >
              <span
                className="house-swatch-chip"
                style={{ background: `linear-gradient(160deg, ${house.cover}, ${house.coverDeep})` }}
              >
                <span className="house-swatch-spine" style={{ background: house.accent }} />
                <HouseDevice house={house.id} size={20} className="house-swatch-device" style={{ color: house.accent }} />
              </span>
              {house.label}
            </button>
          ))}
        </div>
      </Plate>
      <PrivacySettings
        value={user.friends_visibility}
        onChange={account.setFriendsVisibility}
        error={account.privacyError}
      />
      <OwlPostSettings value={user.owl_post} onChange={account.setOwlPost} error={account.owlPostError} />
      <ChallengeSettings value={user.challenges} onChange={account.setChallenges} error={account.challengesError} />
      <BlockedPlayers
        blocked={safety.blocked}
        loaded={safety.loaded}
        loadError={safety.loadError}
        onUnblock={safety.unblock}
      />
      <Plate>
        <p className="screen-eyebrow" style={{ margin: '0 0 0.5rem' }}>
          Your Invite Link
        </p>
        <p className="explanation" style={{ margin: '0 0 1rem' }}>
          Share this with a friend — when they register through it, you're instantly connected.
        </p>
        <div className="invite-link-row">
          <input type="text" readOnly value={inviteLink ?? 'Generating…'} onFocus={(e) => e.target.select()} />
          <button type="button" className="secondary-button" onClick={handleCopy} disabled={!inviteLink}>
            {copyLabel}
          </button>
        </div>
      </Plate>
      {onViewOwnProfile && (
        <Plate>
          <p className="screen-eyebrow" style={{ margin: '0 0 0.5rem' }}>
            Your Player File
          </p>
          <p className="explanation" style={{ margin: '0 0 1rem' }}>
            Lifetime stats — accuracy, favorite category, duel record, and your day streak.
          </p>
          <span className="profile-actions">
            <button type="button" className="secondary-button" onClick={onViewOwnProfile}>
              View my profile
            </button>
            {onEditProfile && (
              <button type="button" className="secondary-button" onClick={onEditProfile}>
                Edit avatar &amp; bio
              </button>
            )}
          </span>
        </Plate>
      )}
      <PasswordSettings onChangePassword={account.updatePassword} />
      <DeleteAccountSection username={user.username} onDelete={account.removeAccount} />
    </div>
  );
}
