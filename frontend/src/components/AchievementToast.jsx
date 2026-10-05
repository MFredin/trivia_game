// The small notice that slides in when a run unlocks an achievement. Click to dismiss; useAchievements removes it on a
// timer as well. `role="status"` so a screen reader announces it without taking focus.
export default function AchievementToast({ achievement, onDismiss }) {
  if (!achievement) return null;
  return (
    <div className="achievement-toast" role="status" onClick={onDismiss}>
      <span className="achievement-toast-eyebrow">Achievement Unlocked</span>
      <span className="achievement-toast-name">{achievement.name}</span>
      <span className="achievement-toast-desc">{achievement.description}</span>
    </div>
  );
}
