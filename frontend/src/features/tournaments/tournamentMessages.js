// What to say when a tournament request is refused: the server's error code, in the player's words. One table, so every
// screen that can hit the same refusal says the same thing.
const MESSAGES = {
  not_found: 'No tournament with that code, or you are not in it.',
  cannot_join: 'You cannot join that one: it is limited to friends, or one of you has switched challenges off.',
  challenges_off: 'You have challenges switched off, so you cannot run a tournament. You can change this in Settings.',
  not_open: 'That tournament has already started or ended.',
  full: 'That tournament is full.',
  already_joined: 'You are already in that tournament.',
  already_started: 'It has already started.',
  too_few_players: 'It needs at least three players to start.',
  not_creator: 'Only the person who made it can do that.',
  creator_cannot_leave: 'The person who made it cannot leave; cancel it instead.',
  already_over: 'That tournament is already over.',
  match_not_open: 'That match is not open.',
  match_closed: 'That match has passed its deadline.',
  name_too_long: 'Keep the name to 40 characters.',
  invalid_name: 'Give it a name, without links or email addresses.',
  network_unreachable: 'Could not reach the server. Try again in a moment.',
};

export const tournamentMessage = (error) => MESSAGES[error?.code] ?? 'Something went wrong. Try again.';
