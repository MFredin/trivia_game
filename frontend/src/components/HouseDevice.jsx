// The house devices: original geometric marks in a bookplate roundel, drawn from each
// house's classical element rather than its animal (see docs/design-overhaul-concept.md,
// "House devices"). Monochrome gets the blind stamp — a ring with no element.
const MARKS = {
  gryffindor: (
    <path d="M32 12c2 8 10 11 10 21a10 10 0 0 1-20 0c0-5 3-7 4-11 2 4 4 5 4 9 0-7-2-11 2-19z" fill="currentColor" />
  ),
  hufflepuff: (
    <>
      <path
        d="M14 26c6-4 12 4 18 0s12-4 18 0M14 36c6-4 12 4 18 0s12-4 18 0M14 46c6-4 12 4 18 0s12-4 18 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="32" cy="17" r="3.5" fill="currentColor" />
    </>
  ),
  slytherin: (
    <path
      d="M12 40c6-14 14-14 20-8 4 4 2 8-2 8-3 0-4-3-1-4M20 48c8-4 16-4 24 0M12 40c10 2 22 2 40-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  ravenclaw: (
    <path
      d="M14 24h24a5 5 0 1 0-5-5M14 33h32a5 5 0 1 1-5 5M14 42h20a4 4 0 1 1-4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
  ),
  monochrome: <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" strokeWidth="1.4" />,
};

export default function HouseDevice({ house = 'monochrome', size = 28, className = '', style }) {
  return (
    <svg
      className={`house-device ${className}`}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" />
      {MARKS[house] ?? MARKS.monochrome}
    </svg>
  );
}
