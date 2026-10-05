import Icon from './icons.jsx';

// Spelled out rather than assembled from the variant name, so the dead-code audit can see that
// each stylesheet rule is in use.
const VARIANT_CLASS = {
  primary: 'icon-button--primary',
  secondary: 'icon-button--secondary',
  danger: 'icon-button--danger',
};

/**
 * A control drawn as a glyph, optionally with its word beside it.
 *
 * `label` is required and is always the accessible name and the tooltip, whether or not it is
 * shown: an icon alone is a guess, so the header of a profile — where there is room — shows both
 * (`showLabel`), and a dense list shows the glyph alone on a phone and adds the word once the
 * screen is wide enough for it (`wideLabel`). The box is never smaller than 44px (see styles/parts/
 * icon-button.css) because this app is played on a phone.
 */
export default function IconButton({ icon, label, onClick, variant = 'secondary', showLabel = false, wideLabel = false, disabled, ...rest }) {
  return (
    <button
      type="button"
      className={`icon-button ${VARIANT_CLASS[variant]} ${showLabel ? 'icon-button--labelled' : ''} ${wideLabel ? 'icon-button--wide-label' : ''}`}
      aria-label={showLabel ? undefined : label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      <Icon name={icon} />
      {showLabel && <span className="icon-button-label">{label}</span>}
      {wideLabel && <span className="icon-button-label icon-button-label--wide">{label}</span>}
    </button>
  );
}
