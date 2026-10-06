import Icon from './icons.jsx';

/**
 * A checkbox drawn to match the rest of the app. The real input is the 44px target, laid over the
 * drawn box and transparent, so keyboard, screen-reader and touch behaviour are the browser's own;
 * the box beside it is what is seen. `mark` replaces the tick — the pinned achievements show their
 * place in the order there.
 */
export default function Checkbox({ id, checked, disabled, onChange, mark }) {
  return (
    <span className="checkbox">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
      <span className="checkbox-box" aria-hidden="true">
        {checked ? (mark ?? <Icon name="check" size={14} />) : null}
      </span>
    </span>
  );
}
