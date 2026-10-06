import { useEffect, useMemo, useState } from 'react';
import Plate from './Plate.jsx';
import AvatarDesigner from './AvatarDesigner.jsx';
import ProfileAbout from './ProfileAbout.jsx';
import ProfilePreview from './ProfilePreview.jsx';
import SectionTabs, { panelProps } from './SectionTabs.jsx';
import TitlePicker from './TitlePicker.jsx';

// What a refused save says, in the player's terms. The bio's reasons sit beside the bio; the rest
// are about the avatar or the connection and appear by the Save button.
const BIO_ERRORS = {
  bio_too_long: 'That is over the length limit.',
  bio_has_link: 'Bios cannot contain links, email addresses, handles or phone numbers.',
  bio_not_allowed: 'That bio contains language that is not allowed here.',
  invalid_bio: 'That bio could not be saved.',
};

const SAVE_ERRORS = {
  option_locked: 'One of those avatar choices has not been unlocked yet.',
  achievement_not_earned: 'You can only pin achievements you have earned.',
  title_not_held: 'You do not have that title.',
  too_many_attempts: 'You have saved a lot of changes — try again in a little while.',
};

export default function EditProfileScreen({ user, editor, onViewProfile }) {
  const { customization, loadError, draft, dirty, dirtyTabs, saving, error, saved, change, setStyle, discard, save } = editor;
  const [tab, setTab] = useState('avatar');

  const locks = useMemo(() => new Map((customization?.locks ?? []).map((l) => [l.key, l])), [customization]);

  const bioError = error ? BIO_ERRORS[error.code] : null;
  // A refused bio is explained beside the bio, so take the player there rather than leave the reason on a tab they cannot see.
  useEffect(() => {
    if (bioError) setTab('about');
  }, [bioError]);

  if (!draft) return null;

  const saveError = error && !bioError ? (SAVE_ERRORS[error.code] ?? 'Could not save your changes. Try again.') : null;
  const tabs = [
    { id: 'avatar', label: 'Avatar', dirty: dirtyTabs.avatar },
    { id: 'title', label: 'Title', dirty: dirtyTabs.title },
    { id: 'about', label: 'About', dirty: dirtyTabs.about },
  ];

  return (
    <div>
      <div className="screen-head">
        <div>
          <p className="screen-eyebrow">Your Page</p>
          <h2 className="screen-title">Edit Profile</h2>
        </div>
        <button type="button" className="secondary-button" onClick={() => onViewProfile(user.username)}>
          View my profile
        </button>
      </div>

      {loadError && (
        <div className="error-banner" role="alert">
          {loadError}
        </div>
      )}

      <div className="profile-editor">
        <ProfilePreview user={user} draft={draft} titles={customization?.titles} dirty={dirty} />
        <div className="profile-editor-main">
          <SectionTabs prefix="profile" label="Profile sections" tabs={tabs} active={tab} onChange={setTab} variant="tabs" />
          <div {...panelProps('profile', tab)}>
            {tab === 'avatar' && (
              <Plate>
                <p className="screen-eyebrow" style={{ margin: '0 0 0.8rem' }}>
                  Your Avatar
                </p>
                <AvatarDesigner
                  draft={draft}
                  username={user.username}
                  house={user.theme}
                  locks={locks}
                  onSigil={(avatar) => change({ avatar })}
                  onStyle={setStyle}
                />
              </Plate>
            )}
            {tab === 'title' && <TitlePicker titles={customization?.titles} value={draft.title} onChange={(title) => change({ title })} />}
            {tab === 'about' && <ProfileAbout draft={draft} customization={customization} bioError={bioError} onChange={change} />}
          </div>
        </div>
      </div>

      <div className="edit-savebar" role="region" aria-label="Save your changes">
        <span className="edit-savebar-status" role="status">
          {saved && !dirty ? 'Saved.' : dirty ? 'You have unsaved changes.' : 'No changes yet.'}
        </span>
        {saveError && (
          <span className="edit-savebar-error" role="alert">
            {saveError}
          </span>
        )}
        <span className="edit-savebar-actions">
          <button type="button" className="secondary-button" disabled={!dirty || saving} onClick={discard}>
            Discard
          </button>
          <button type="button" className="primary-button" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </span>
      </div>
    </div>
  );
}
