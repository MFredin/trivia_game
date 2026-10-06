// The form for making a tournament: a name, how many may join, how long each round lasts, and which canon the questions draw on.
// Category and difficulty are left at "any", which the server defaults to.
import { useState } from 'react';

const SIZES = [4, 8, 16];
const ROUND_HOURS = [24, 48, 72];
const CANONS = [
  { value: 'books', label: 'Books' },
  { value: 'movies', label: 'Films' },
  { value: 'combined', label: 'Combined' },
];

function Choice({ label, options, value, onChange, format = (o) => o }) {
  return (
    <div className="tournament-field">
      <span className="field-label">{label}</span>
      <div className="seg-control">
        {options.map((option) => {
          const v = option.value ?? option;
          return (
            <button key={v} type="button" className={`seg ${value === v ? 'is-active' : ''}`} aria-pressed={value === v} onClick={() => onChange(v)}>
              {option.label ?? format(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TournamentCreateForm({ busy, onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [size, setSize] = useState(8);
  const [roundHours, setRoundHours] = useState(48);
  const [canonSource, setCanonSource] = useState('combined');

  const submit = (event) => {
    event.preventDefault();
    onCreate({ name, size, roundHours, canonSource });
  };

  return (
    <form className="tournament-form" onSubmit={submit}>
      <label className="tournament-field">
        <span className="field-label">Name</span>
        <input
          type="text"
          className="friend-add-input"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="Friday Night Cup"
          autoComplete="off"
          required
        />
      </label>
      <Choice label="Players, at most" options={SIZES} value={size} onChange={setSize} />
      <Choice label="Time for each round" options={ROUND_HOURS} value={roundHours} onChange={setRoundHours} format={(h) => `${h} hours`} />
      <Choice label="Questions from" options={CANONS} value={canonSource} onChange={setCanonSource} />
      <p className="explanation tournament-trust">
        Matches are played on your own time, so it is a game of trust. Everyone in a match answers the same ten questions.
      </p>
      <div className="tournament-actions">
        <button type="submit" className="primary-button" disabled={busy || name.trim() === ''}>
          {busy ? 'Making it…' : 'Make the tournament'}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Not now
        </button>
      </div>
    </form>
  );
}
