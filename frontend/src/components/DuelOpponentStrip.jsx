export default function DuelOpponentStrip({ opponentUsername, live }) {
  return (
    <div className="duel-strip">
      <span className="duel-strip-name">{opponentUsername}</span>
      <span className="duel-strip-stats">
        <span>score: {live?.runningTotal ?? 0}</span>
        <span>streak: {live?.streak ?? 0}</span>
        {live?.sessionComplete && <span className="duel-strip-done">Finished</span>}
      </span>
    </div>
  );
}
