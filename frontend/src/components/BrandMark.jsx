// The archive's own mark — not a house device. HouseDevice answers "which house is this
// bound to"; this answers "which app is this." The two coexist deliberately: Settings, the
// profile's Ex Libris card and the seal all still show a HouseDevice, because they are
// legitimately about house membership. Only the persistent nav wordmark and the favicon,
// which are about brand identity rather than house identity, use this instead.
//
// A rubricated initial — the drop-cap convention already used on every question
// (.has-rubric-initial in styles/parts/question.css) — framed the way the app's own Plate
// component frames a card: open corner brackets, not a closed box. Reused geometry, not
// invented ornament: the bracket below is the same 15px two-leg-plus-bud shape as
// .plate-corner, just drawn once in SVG instead of four times in CSS.
//
// currentColor throughout, same as HouseDevice, so a parent sets the colour by context —
// silver chrome in the nav (see .running-title .brand-mark in chrome.css), rubric on
// parchment, gilt on the dark page for a hero/favicon treatment.
function Bracket({ x, y, flipX, flipY }) {
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  return (
    <>
      <path
        d={`M${x} ${y + 16 * sy} V${y} H${x + 16 * sx}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="square"
      />
      {/* The corner bud from .plate-corner::after, mirrored per corner exactly as the CSS
          rotates it — verified by hand that all four close back to their own start point
          rather than assuming the mirrored coordinates happen to work out. */}
      <path
        d={`M${x + 3 * sx} ${y + 3 * sy} q0 ${6 * sy} ${6 * sx} ${6 * sy} q0 ${-6 * sy} ${-6 * sx} ${-6 * sy} Z`}
        fill="currentColor"
      />
    </>
  );
}

export default function BrandMark({ size = 28, className = '', style }) {
  return (
    <svg
      className={`brand-mark ${className}`}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <Bracket x={14} y={14} flipX={false} flipY={false} />
      <Bracket x={86} y={14} flipX={true} flipY={false} />
      <Bracket x={14} y={86} flipX={false} flipY={true} />
      <Bracket x={86} y={86} flipX={true} flipY={true} />
      <text
        x="50"
        y="65"
        fontFamily="'IM Fell English', 'Iowan Old Style', Georgia, serif"
        fontSize="52"
        textAnchor="middle"
        fill="currentColor"
      >
        R
      </text>
    </svg>
  );
}
