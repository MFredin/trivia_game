// Names a player may not register: the ones the app itself uses for an account that has been
// deleted. `deleted-<id>-…` is what such an account's username becomes (unique, so the column
// stays unique), and "Deleted player" is what everyone else is shown. Letting someone register
// either would let them impersonate a removed account.
export function isReservedUsername(name) {
  const normalised = String(name).trim().toLowerCase();
  return normalised.startsWith('deleted-') || normalised === 'deleted player';
}
