import ContactModeFieldset from './ContactModeFieldset.jsx';

const OPTIONS = [
  { value: 'open', label: 'Open', note: 'Anyone can send you an owl. Someone who is not your friend can send one, and then waits for your answer. The default.' },
  { value: 'friends', label: 'Friends only', note: 'Only your friends can send you owls. Existing conversations stay readable.' },
  { value: 'off', label: 'Off', note: 'Nobody can send you owls and you cannot send any. Your old conversations stay readable.' },
];

export default function OwlPostSettings({ value, onChange, error }) {
  return (
    <ContactModeFieldset
      name="owl-post"
      legend="Owl Post"
      intro="Short plain-text messages, deleted after 90 days. You can block or report anyone who writes to you."
      options={OPTIONS}
      value={value}
      onChange={onChange}
      error={error}
    />
  );
}
