/**
 * An on/off switch drawn to match the rest of the app. Like Checkbox, the real input is the target — here a 44px-tall,
 * transparent one laid over the drawn track — so keyboard, screen-reader and touch behaviour are the browser's own, and
 * `role="switch"` makes it announce as on or off rather than checked. The word beside the track says the state in text too,
 * so it does not rest on the knob's position alone.
 */
export default function Switch({ id, checked, onChange, disabled, describedBy }) {
  return (
    <span className="switch">
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} aria-describedby={describedBy} onChange={onChange} />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-knob" />
      </span>
      <span className="switch-state" aria-hidden="true">
        {checked ? 'On' : 'Off'}
      </span>
    </span>
  );
}
