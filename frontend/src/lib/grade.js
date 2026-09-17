// O.W.L.-style grade names, applied at every difficulty tier — a run reads "Outstanding at
// N.E.W.T.", never a bare grade with no sense of how hard the questions actually were.
const GRADES = [
  { min: 0.9, label: 'Outstanding' },
  { min: 0.75, label: 'Exceeds Expectations' },
  { min: 0.5, label: 'Acceptable' },
  { min: 0.35, label: 'Poor' },
  { min: 0.2, label: 'Dreadful' },
  { min: 0, label: 'Troll' },
];

export function gradeForAccuracy(correctCount, answeredCount) {
  if (!answeredCount) return null;
  const pct = correctCount / answeredCount;
  return GRADES.find((g) => pct >= g.min)?.label ?? 'Troll';
}
