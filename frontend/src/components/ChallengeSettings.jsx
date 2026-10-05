import ContactModeFieldset from './ContactModeFieldset.jsx';

const OPTIONS = [
  { value: 'open', label: 'Open', note: 'Anyone can challenge you to a duel. The default.' },
  { value: 'friends', label: 'Friends only', note: 'Only your friends can challenge you.' },
  { value: 'off', label: 'Off', note: 'Nobody can challenge you, and you cannot challenge anyone or make challenge links either.' },
];

export default function ChallengeSettings({ value, onChange, error }) {
  return (
    <ContactModeFieldset
      name="challenges"
      legend="Challenges"
      intro="Who may invite you to a duel. A duel you have already accepted is never interrupted."
      options={OPTIONS}
      value={value}
      onChange={onChange}
      error={error}
    />
  );
}
