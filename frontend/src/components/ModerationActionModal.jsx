import { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import Checkbox from './Checkbox.jsx';
import { MODERATION_ACTION_BY_ID, NOTE_MAX, NOTE_MIN, suggestedNote } from '../constants/moderationActions.js';
import { REPORT_REASONS } from '../constants/reportReasons.js';

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label]));

/**
 * Decide what to do about a report. The actions that fit this kind of report are listed first, the
 * ones the player's history points to are ticked and marked "Suggested", and every action says what
 * it does. The note is what the PLAYER will read — it is prefilled from the action and the reason,
 * and a moderator can rewrite it. Nothing is applied until the button, which names exactly what it
 * will do.
 */
export default function ModerationActionModal({ report, suspensionDays, onApply, onClose }) {
  const suggested = report.suggestion.actions;
  const [chosen, setChosen] = useState(suggested);
  const [days, setDays] = useState(report.suggestion.days ?? suspensionDays[0]);
  const [note, setNote] = useState(() => suggestedNote(report.reason, suggested, report.suggestion.days ?? suspensionDays[0]));
  const [noteEdited, setNoteEdited] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  // The prefilled note follows the choices until the moderator starts writing their own.
  const update = (nextChosen, nextDays) => {
    setChosen(nextChosen);
    setDays(nextDays);
    if (!noteEdited) setNote(suggestedNote(report.reason, nextChosen, nextDays));
  };

  const toggle = (id) => {
    let next = chosen.includes(id) ? chosen.filter((a) => a !== id) : [...chosen, id];
    // A ban already includes everything a suspension would do.
    if (id === 'ban' && next.includes('ban')) next = next.filter((a) => a !== 'suspend');
    if (id === 'suspend' && next.includes('suspend')) next = next.filter((a) => a !== 'ban');
    update(next, days);
  };

  const summary = useMemo(
    () =>
      chosen
        .map((a) => (a === 'suspend' || a === 'mute' ? `${MODERATION_ACTION_BY_ID[a].label} ${days} day${days === 1 ? '' : 's'}` : MODERATION_ACTION_BY_ID[a].label))
        .join(' + '),
    [chosen, days],
  );

  const noteOk = note.trim().length >= NOTE_MIN && note.trim().length <= NOTE_MAX;
  const canApply = chosen.length > 0 && noteOk && !pending;

  const apply = async () => {
    setPending(true);
    setError(null);
    try {
      await onApply({ actions: chosen, days: chosen.includes('suspend') || chosen.includes('mute') ? days : undefined, note: note.trim() });
    } catch (err) {
      setError(
        err.code === 'cannot_moderate_admin'
          ? 'Admins cannot be moderated here.'
          : err.code === 'report_not_found'
            ? 'That report has already been dealt with.'
            : 'That did not go through. Nothing was changed.',
      );
      setPending(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="action-title">
      <p className="screen-eyebrow">Take Action</p>
      <h2 className="screen-title" id="action-title">
        {report.reported_username}
      </h2>
      <p className="explanation">Reported for: {REASON_LABEL[report.reason] ?? report.reason}</p>

      <fieldset className="action-fieldset">
        <legend className="field-label">What should happen?</legend>
        {report.available_actions.map((id) => {
          const action = MODERATION_ACTION_BY_ID[id];
          return (
            <label key={id} className="action-option" htmlFor={`act-${id}`}>
              <Checkbox id={`act-${id}`} checked={chosen.includes(id)} onChange={() => toggle(id)} />
              <span className="action-option-text">
                <span className="action-option-name">
                  {action.label}
                  {suggested.includes(id) && <span className="action-suggested">Suggested</span>}
                </span>
                <span className="action-option-effect">{action.effect}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {(chosen.includes('suspend') || chosen.includes('mute')) && (
        <label className="start-form-field action-days" htmlFor="suspend-days">
          <span className="field-label">{chosen.includes('suspend') ? 'Suspend' : 'Mute'} for</span>
          <select id="suspend-days" value={days} onChange={(e) => update(chosen, Number(e.target.value))}>
            {suspensionDays.map((d) => (
              <option key={d} value={d}>
                {d} day{d === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="start-form-field" htmlFor="action-note">
        <span className="field-label">What the player will be told</span>
        <textarea
          id="action-note"
          rows={5}
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteEdited(true);
          }}
        />
      </label>
      <p className="explanation action-note-count">
        {note.trim().length < NOTE_MIN ? `At least ${NOTE_MIN} characters.` : `${note.trim().length}/${NOTE_MAX}`}
      </p>

      {chosen.includes('ban') && (
        <p className="action-warning" role="note">
          A ban locks the account out until a moderator lifts it, and the email address cannot be used to register again.
        </p>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="primary-button" disabled={!canApply} onClick={apply}>
          {pending ? 'Applying…' : chosen.length === 0 ? 'Choose an action' : `Apply: ${summary}`}
        </button>
        <button type="button" className="secondary-button" disabled={pending} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
