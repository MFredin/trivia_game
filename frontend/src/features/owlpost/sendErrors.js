// What a refused send says, in the player's terms — shared by the reply box in a conversation and
// the form for a new owl, which are refused for the same reasons.
const SEND_ERRORS = {
  message_too_long: 'That is too long — owls carry up to 500 characters.',
  message_has_link: 'Owls cannot carry links, email addresses, handles or phone numbers.',
  message_not_allowed: 'That contains language that is not allowed here.',
  message_empty: 'Write something first.',
  subject_too_long: 'The subject is too long — keep it to 60 characters.',
  subject_has_link: 'The subject cannot hold links, email addresses, handles or phone numbers.',
  subject_not_allowed: 'The subject contains language that is not allowed here.',
  invalid_subject: 'That subject could not be used.',
  duplicate_message: 'You just sent that.',
  too_many_attempts: 'Slow down — you are sending a lot of owls. Try again in a moment.',
  user_not_found: 'There is no player by that name.',
  not_accepting_owls: 'That player is not accepting owls from you.',
  awaiting_reply: 'You have already sent this player an owl. You can write again once they answer.',
  too_many_new_contacts: 'You have started a lot of new conversations today. Try again tomorrow, or write to a friend.',
};

export function sendErrorText(error) {
  if (!error) return null;
  if (error.code === 'owl_post_muted') {
    const until = error.until ? new Date(error.until).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : null;
    return `A moderator has stopped you sending owls${until ? ` until ${until}` : ''}.`;
  }
  if (error.code === 'owl_post_off') return 'Owl Post is switched off. You can turn it on in Settings.';
  return SEND_ERRORS[error.code] ?? 'That did not send. Try again.';
}
