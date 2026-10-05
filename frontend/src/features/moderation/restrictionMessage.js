// What to tell someone who has been turned away because their account is suspended or banned, from
// the server's answer (`{ error, until, note }`). Plain words and the moderator's own note, so the
// person knows what happened and for how long rather than only that "something went wrong".
export function isRestriction(err) {
  return err?.code === 'account_suspended' || err?.code === 'account_banned';
}

export function restrictionMessage(data) {
  const note = data?.note ? ` ${data.note}` : '';
  if (data?.error === 'account_banned') {
    return `Your account has been banned.${note} If you think this is a mistake, use Submit Feedback below.`;
  }
  const until = data?.until
    ? new Date(data.until).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    : null;
  return `Your account is suspended${until ? ` until ${until}` : ''}.${note} If you think this is a mistake, use Submit Feedback below.`;
}
