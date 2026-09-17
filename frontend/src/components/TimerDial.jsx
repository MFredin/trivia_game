// The ring dial: a gold ring with quarter ticks and a scarlet arc that drains clockwise as
// time runs out. Replaced an earlier candle-timer draft — the dial reads at a glance under
// pressure, which the candle didn't (see docs/design-overhaul-concept.md).
const R = 46;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function TimerDial({ remainingMs, totalMs, size = 132 }) {
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const seconds = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="timer"
      aria-label={`${mm}:${ss} remaining`}
      style={{ overflow: 'visible' }}
    >
      <circle cx="60" cy="60" r="57" fill="none" stroke="var(--gilt)" strokeWidth="1.2" />
      <circle cx="60" cy="60" r="53" fill="none" stroke="var(--gilt)" strokeWidth="0.6" opacity="0.6" />
      <path d="M60 3v5M117 60h-5M60 117v-5M3 60h5" stroke="var(--gilt-deep)" strokeWidth="1.5" />
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--text-muted-on-surface)" strokeOpacity="0.28" strokeWidth="6" />
      <circle
        cx="60"
        cy="60"
        r={R}
        fill="none"
        stroke="var(--rubric)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${CIRCUMFERENCE * fraction} ${CIRCUMFERENCE}`}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dasharray 0.2s linear' }}
      />
      <circle cx="60" cy="60" r="38" fill="none" stroke="var(--text-muted-on-surface)" strokeOpacity="0.35" strokeWidth="1" />
      <text
        x="60"
        y="68"
        textAnchor="middle"
        fontFamily="'IM Fell English', Georgia, serif"
        fontSize="32"
        fill="var(--text-on-surface)"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {mm}:{ss}
      </text>
    </svg>
  );
}
