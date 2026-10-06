import { useState } from 'react';
import SectionTabs, { panelProps } from './SectionTabs.jsx';
import AppearanceSettings from './AppearanceSettings.jsx';
import HolidaySettings from './HolidaySettings.jsx';
import PrivacySettings from './PrivacySettings.jsx';
import OwlPostSettings from './OwlPostSettings.jsx';
import ChallengeSettings from './ChallengeSettings.jsx';
import BlockedPlayers from './BlockedPlayers.jsx';
import PasswordSettings from './PasswordSettings.jsx';
import DeleteAccountSection from './DeleteAccountSection.jsx';

// One section shows at a time: Settings grew from "pick a colour" into privacy, contact rules and the
// account itself, and one long page of all of it was easy to get lost in. Invites live on the Friends
// screen, and View / Edit profile are in the avatar menu, so neither is repeated here.
const SECTIONS = [
  { id: 'appearance', label: 'Appearance', hint: 'The Bindery', icon: 'book' },
  { id: 'privacy', label: 'Privacy', hint: 'Who can reach you', icon: 'shield' },
  { id: 'account', label: 'Account', hint: 'Password and deletion', icon: 'user' },
];

export default function SettingsScreen({ user, onSelectTheme, account, safety, holiday }) {
  const [section, setSection] = useState('appearance');

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Your Account</p>
          <h2 className="screen-title">Settings</h2>
        </div>
      </div>
      <div className="settings-layout">
        <div className="settings-rail">
          <SectionTabs prefix="settings" label="Settings sections" tabs={SECTIONS} active={section} onChange={setSection} variant="rail" />
          <p className="settings-rail-note">Changes on this page save as you make them.</p>
        </div>
        <div {...panelProps('settings', section)} className="settings-panel">
          {section === 'appearance' && (
            <>
              <AppearanceSettings theme={user.theme} onSelectTheme={onSelectTheme} />
              <HolidaySettings
                scene={holiday.scene}
                overlay={holiday.overlayOn}
                motion={holiday.animated}
                onChange={holiday.save}
                error={holiday.error}
              />
            </>
          )}
          {section === 'privacy' && (
            <>
              <PrivacySettings value={user.friends_visibility} onChange={account.setFriendsVisibility} error={account.privacyError} />
              <OwlPostSettings value={user.owl_post} onChange={account.setOwlPost} error={account.owlPostError} />
              <ChallengeSettings value={user.challenges} onChange={account.setChallenges} error={account.challengesError} />
              <BlockedPlayers blocked={safety.blocked} loaded={safety.loaded} loadError={safety.loadError} onUnblock={safety.unblock} />
            </>
          )}
          {section === 'account' && (
            <>
              <PasswordSettings onChangePassword={account.updatePassword} />
              <DeleteAccountSection username={user.username} onDelete={account.removeAccount} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
