// The house devices: original geometric marks in a bookplate roundel, drawn from each
// house's classical element rather than its animal (see docs/design-overhaul-concept.md,
// "House devices"). Monochrome gets the blind stamp — a ring with no element.
//
// Every mark is drawn on the same 64x64 grid and centred on the roundel, and mixes solid
// shapes with one shared line weight, so a row of devices carries the same visual weight.
//
//   Gryffindor  The Ember  fire   a flame with an inner tongue cut out
//   Hufflepuff  The Furrow earth  a seedling over furrowed soil
//   Slytherin   The Tide   water  a crescent moon over two swells
//   Ravenclaw   The Gale   air    three curling wind lines
//   Monochrome  Blind Stamp       a ring around a solid centre
//
// Optical sizes: at SMALL_CUT_MAX_PX and below the device switches to a simplified "small
// cut" — a heavier line, a thicker roundel and no fine detail — the way type has optical
// sizes. It is the same drawing with fewer parts, so the shapes survive at 18-20px.

/** Rendered sizes at or below this use the small cut. */
const SMALL_CUT_MAX_PX = 30;

const FULL_LINE = 3.2;
const SMALL_LINE = 4;
const FULL_RING = 2;
const SMALL_RING = 3;

const FLAME = 'M32 12c2 8 10 11 10 21a10 10 0 0 1-20 0c0-5 3-7 4-11 2 4 4 5 4 9 0-7-2-11 2-19z';
// The tongue is punched out of the flame with fill-rule evenodd (full cut only).
const FLAME_TONGUE = 'M32 41c-2.6 0-4.2-1.7-4.2-3.7 0-2 2-3.2 4.2-5.6 2.2 2.4 4.2 3.6 4.2 5.6 0 2-1.6 3.7-4.2 3.7z';
const CRESCENT = 'M38 14a8.5 8.5 0 1 0 0 14 7 7 0 0 1 0-14z';
const swell = (y) => `M15 ${y}c6-5 12 5 18 0s12-5 18 0`;

/** Props shared by every stroked (not filled) part of a mark. */
const lineProps = (width) => ({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: width,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

// Each mark takes the cut's line weight and whether it is the small cut. The translate on
// each group nudges the mark's visual centre onto the roundel's centre (32, 32).
const MARKS = {
  gryffindor: (line, small) => (
    <g transform="translate(0 4)">
      <path d={small ? FLAME : FLAME + FLAME_TONGUE} fill="currentColor" fillRule="evenodd" />
    </g>
  ),
  hufflepuff: (line, small) => (
    <g transform="translate(0 -3)">
      <path d="M32 41V27" {...lineProps(line)} />
      <path d="M32 35c-7 0-10-4-10-9 7 0 10 4 10 9z" fill="currentColor" />
      <path d="M32 31c6 0 9-3.5 9-8-6 0-9 3.5-9 8z" fill="currentColor" />
      <path d="M16 44h32" {...lineProps(line)} />
      {!small && <path d="M22 51h20" {...lineProps(line)} />}
    </g>
  ),
  slytherin: (line, small) => (
    <g transform="translate(-1 1)">
      <path d={CRESCENT} fill="currentColor" />
      <path d={swell(small ? 40 : 38)} {...lineProps(line)} />
      <path d={swell(small ? 50 : 48)} {...lineProps(line)} />
    </g>
  ),
  ravenclaw: (line) => (
    <g transform="translate(1.5 0)">
      <path d="M14 24h24a5 5 0 1 0-5-5M14 33h32a5 5 0 1 1-5 5M14 42h20a4 4 0 1 1-4 4" {...lineProps(line)} />
    </g>
  ),
  monochrome: (line, small) => (
    <>
      <circle cx="32" cy="32" r="18" {...lineProps(line)} />
      <circle cx="32" cy="32" r={small ? 6 : 5.5} fill="currentColor" />
    </>
  ),
};

export default function HouseDevice({ house = 'monochrome', size = 28, className = '', style }) {
  const small = size <= SMALL_CUT_MAX_PX;
  const mark = MARKS[house] ?? MARKS.monochrome;
  return (
    <svg
      className={`house-device ${className}`}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-cut={small ? 'small' : 'full'}
      style={style}
    >
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth={small ? SMALL_RING : FULL_RING} />
      {mark(small ? SMALL_LINE : FULL_LINE, small)}
    </svg>
  );
}
