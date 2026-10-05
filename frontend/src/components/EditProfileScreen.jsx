import { useMemo } from 'react';
import Plate from './Plate.jsx';
import AvatarDesigner from './AvatarDesigner.jsx';
import ProfileAbout from './ProfileAbout.jsx';

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
  too_many_attempts: 'You have saved a lot of changes — try again in a little while.',
};

export default function EditProfileScreen({ user, editor, onViewProfile }) {
  const { customization, loadError, draft, dirty, saving, error, saved, change, setStyle, discard, save } = editor;

  const locks = useMemo(() => new Map((customization?.locks ?? []).map((l) => [l.key, l])), [customization]);

  if (!draft) return null;

  const bioError = error ? BIO_ERRORS[error.code] : null;
  const saveError = error && !bioError ? (SAVE_ERRORS[error.code] ?? 'Could not save your changes. Try again.') : null;

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

      <ProfileAbout draft={draft} customization={customization} bioError={bioError} onChange={change} />

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
