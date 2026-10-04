import Plate from './Plate.jsx';

/**
 * The "about you" half of Edit Profile: a short bio, two favourites picked from lists, and up to
 * three achievements to show off. Everything but the bio is a choice from a fixed list, so only
 * the bio can be refused — and the form says why, in the player's terms, next to the field.
 */
export default function ProfileAbout({ draft, customization, bioError, onChange }) {
  const limits = customization?.limits ?? { bio: 140, pinned: 3 };
  const earned = customization?.earned ?? [];
  const atLimit = draft.pinned.length >= limits.pinned;

  const togglePin = (id) => {
    const next = draft.pinned.includes(id) ? draft.pinned.filter((p) => p !== id) : [...draft.pinned, id];
    onChange({ pinned: next });
  };

  return (
    <Plate>
      <p className="screen-eyebrow" style={{ margin: '0 0 0.5rem' }}>
        About You
      </p>
      <div className="start-form">
        <label htmlFor="profile-bio">
          Short bio
          <textarea
            id="profile-bio"
            value={draft.bio}
            rows={3}
            maxLength={limits.bio}
            aria-describedby="profile-bio-help"
            aria-invalid={bioError ? true : undefined}
            onChange={(e) => onChange({ bio: e.target.value })}
          />
        </label>
        <p id="profile-bio-help" className="explanation profile-bio-help">
          <span>Plain text only — no links, emails or phone numbers. Every signed-in player can read it.</span>
          <span className="profile-bio-count">
            {[...draft.bio].length}/{limits.bio}
          </span>
        </p>
        {bioError && (
          <div className="error-banner" role="alert">
            {bioError}
          </div>
        )}

        <label htmlFor="profile-book">
          Favourite book
          <select id="profile-book" value={draft.favoriteBook} onChange={(e) => onChange({ favoriteBook: e.target.value })}>
            <option value="">No favourite</option>
            {(customization?.books ?? []).map((book) => (
              <option key={book} value={book}>
                {book}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="profile-subject">
          Favourite subject
          <select id="profile-subject" value={draft.favoriteSubject} onChange={(e) => onChange({ favoriteSubject: e.target.value })}>
            <option value="">No favourite</option>
            {(customization?.subjects ?? []).map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="pin-fieldset">
        <legend className="screen-eyebrow">Pinned achievements</legend>
        {earned.length === 0 ? (
          <p className="explanation">Earn an achievement by playing and you can pin up to {limits.pinned} here.</p>
        ) : (
          <>
            <p className="explanation" style={{ margin: '0 0 0.5rem' }}>
              Pick up to {limits.pinned} to show on your profile, in the order you choose them. With none pinned, your most
              recent are shown.
            </p>
            {earned.map((a) => {
              const checked = draft.pinned.includes(a.id);
              return (
                <label key={a.id} className="pin-option" htmlFor={`pin-${a.id}`}>
                  {/* The real checkbox is the 44px target, transparent, laid over a box drawn beside it. */}
                  <span className="pin-check">
                    <input
                      id={`pin-${a.id}`}
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && atLimit}
                      onChange={() => togglePin(a.id)}
                    />
                    <span className="pin-box" aria-hidden="true">
                      {checked ? draft.pinned.indexOf(a.id) + 1 : ''}
                    </span>
                  </span>
                  <span>
                    <span className="pin-option-name">
                      {a.name}
                    </span>
                    <span className="pin-option-desc">{a.description}</span>
                  </span>
                </label>
              );
            })}
          </>
        )}
      </fieldset>
    </Plate>
  );
}
