// Spelled out rather than assembled, so the dead-code audit can see each rule is in use.
const KIND_CLASS = { earned: 'player-title--earned', system: 'player-title--system' };

/**
 * A title worn beside a player's name. Earned ones are quiet; one an admin gave (Prefect, Head Student)
 * is set apart, because it says something about the person and not just about their record.
 * `onPage` is for a title that sits on the dark page rather than on parchment.
 */
export default function PlayerTitle({ title, onPage = false, className = '' }) {
  if (!title) return null;
  // On the dark page (a screen heading) the on-surface colours would not be legible, so it takes the page's.
  return <span className={`player-title ${onPage ? 'player-title--on-page' : KIND_CLASS[title.kind]} ${className}`}>{title.name}</span>;
}
