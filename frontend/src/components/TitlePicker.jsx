import Plate from './Plate.jsx';

/**
 * Choosing the title worn beside your name: none, or any you hold. Earned ones come from achievements;
 * one an admin gave you shows here too. The ones still to earn are listed below, each with what it takes,
 * so a title is a reason to play as well as a label.
 */
export default function TitlePicker({ titles, value, onChange }) {
  if (!titles) return null;
  const held = titles.filter((t) => t.held);
  const locked = titles.filter((t) => !t.held);

  return (
    <Plate>
      <fieldset className="privacy-fieldset">
        <legend className="screen-eyebrow">Your Title</legend>
        <p className="explanation" style={{ margin: '0 0 1rem' }}>
          Shown beside your name to other players. You have {held.length} of {titles.length} to choose from.
        </p>
        <ul className="title-picker-list">
          <li>
            <label className="privacy-option" htmlFor="title-none">
              <input type="radio" id="title-none" name="title" value="" checked={value === ''} onChange={() => onChange('')} />
              <span>
                <span className="privacy-option-label">No title</span>
              </span>
            </label>
          </li>
          {held.map((title) => (
            <li key={title.id}>
              <label className="privacy-option" htmlFor={`title-${title.id}`}>
                <input
                  type="radio"
                  id={`title-${title.id}`}
                  name="title"
                  value={title.id}
                  checked={value === title.id}
                  onChange={() => onChange(title.id)}
                />
                <span>
                  <span className="privacy-option-label">{title.name}</span>
                  <span className="privacy-option-note">{title.kind === 'system' ? title.description : `Earned: ${title.achievement_name}`}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {locked.length > 0 && (
          <details className="title-picker-locked">
            <summary>Titles still to earn ({locked.length})</summary>
            <ul className="title-picker-list">
              {locked.map((title) => (
                <li key={title.id} className="title-locked-row">
                  <span className="title-locked-name">{title.name}</span>
                  <span className="title-locked-how">{title.requirement}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </fieldset>
    </Plate>
  );
}
