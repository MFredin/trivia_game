// Settings → Privacy: who can see your friends list (friends only, everyone, only me). Your stats and achievements are
// visible to other players regardless.
import Plate from './Plate.jsx';

const OPTIONS = [
  { value: 'friends', label: 'Friends only', note: 'The people you have added. The default.' },
  { value: 'everyone', label: 'Every signed-in player', note: 'Anyone who opens your profile can see who you play with.' },
  { value: 'only_me', label: 'Only me', note: 'Your profile shows no friends list to anyone else.' },
];

export default function PrivacySettings({ value, onChange, error }) {
  return (
    <Plate>
      <fieldset className="privacy-fieldset">
        <legend className="screen-eyebrow">Who can see your friends</legend>
        <p className="explanation" style={{ margin: '0 0 1rem' }}>
          Your stats and achievements stay visible to other players. This controls only the list of people you are friends with.
        </p>
        {OPTIONS.map((option) => (
          <label key={option.value} className="privacy-option" htmlFor={`friends-visibility-${option.value}`}>
            <input
              type="radio"
              id={`friends-visibility-${option.value}`}
              name="friends-visibility"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>
              <span className="privacy-option-label">{option.label}</span>
              <span className="privacy-option-note">{option.note}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error && (
        <div className="error-banner" role="alert" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}
    </Plate>
  );
}
