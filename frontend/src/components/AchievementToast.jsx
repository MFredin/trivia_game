export default function AchievementToast({ achievement, onDismiss }) {
  if (!achievement) return null;
  return (
    <div className="achievement-toast" onClick={onDismiss}>
      <span className="achievement-toast-eyebrow">Achievement Unlocked</span>
      <span className="achievement-toast-name">{achievement.name}</span>
      <span className="achievement-toast-desc">{achievement.description}</span>
    </div>
  );
}
