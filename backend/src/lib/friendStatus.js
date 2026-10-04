// How two players stand towards each other, from the pair of directional friendship rows
// between them (see routes/friends.js — a friendship is two rows, one each way).
// Shared by every endpoint that lists other members "with my relationship to each", and by the
// profile, so the five words the UI switches on are decided in exactly one place.
export function deriveStatus(row) {
  if (row.outgoing_status === 'accepted' || row.incoming_status === 'accepted') return 'friends';
  if (row.outgoing_status === 'pending') return 'pending_sent';
  if (row.incoming_status === 'pending') return 'pending_received';
  return 'none';
}
