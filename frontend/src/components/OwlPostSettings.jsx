import Plate from './Plate.jsx';

const OPTIONS = [
  { value: 'friends', label: 'On', note: 'Your friends can send you owls, and you can send them. The default.' },
  { value: 'off', label: 'Off', note: 'Nobody can send you owls and you cannot send any. Your old conversations stay readable.' },
];

export default function OwlPostSettings({ value, onChange, error }) {
  return (
    <Plate>
      <fieldset className="privacy-fieldset">
        <legend className="screen-eyebrow">Owl Post</legend>
        <p className="explanation" style={{ margin: '0 0 1rem' }}>
          Short plain-text messages between friends, deleted after 90 days. Blocking someone ends the conversation.
        </p>
        {OPTIONS.map((option) => (
          <label key={option.value} className="privacy-option" htmlFor={`owl-post-${option.value}`}>
            <input
              type="radio"
              id={`owl-post-${option.value}`}
              name="owl-post"
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
