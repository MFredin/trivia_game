import Plate from './Plate.jsx';

/**
 * Three radios for "who may start this with me": everyone, friends only, no one. Owl Post and
 * challenges ask the same question with different words, so the group is drawn once and each
 * setting brings its own legend, intro and notes.
 */
export default function ContactModeFieldset({ name, legend, intro, options, value, onChange, error }) {
  return (
    <Plate>
      <fieldset className="privacy-fieldset">
        <legend className="screen-eyebrow">{legend}</legend>
        <p className="explanation" style={{ margin: '0 0 1rem' }}>
          {intro}
        </p>
        {options.map((option) => (
          <label key={option.value} className="privacy-option" htmlFor={`${name}-${option.value}`}>
            <input
              type="radio"
              id={`${name}-${option.value}`}
              name={name}
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
