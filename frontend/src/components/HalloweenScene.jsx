// The Halloween scene: a night around the page. Drawn entirely with CSS and inline SVG, no image files, in colours from the
// --holiday-* tokens. Everything here is decoration (HolidayOverlay hides it from assistive technology and lets the pointer
// pass through), so none of it carries meaning or takes an event.
//
// Three layers, back to front: the background (vignette, fog, ghost-lights, eyes), the sky (stars, moon, clouds, witch, bats)
// and the land (tree, hills, gravestones, pumpkins). A shape that moves says so in its class name, which is what the "calm"
// and "still" rules in halloween.css switch off.
//
// Anything LIGHT that floats (the moon, the pumpkins' glow, the lights and eyes, the witch) is marked holiday-margin and is only
// drawn where the page has empty margins to put it in. Light text sits directly on the page in places (the nav, the footer),
// and a pale shape behind it would cost it legibility; dark shapes (hills, tree, gravestones, haze) only ever help.

// Fixed positions from a fixed seed, so every render of the sky is the same sky and React never sees the stars move.
const STARS = (() => {
  let seed = 11;
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: 26 }, () => ({
    left: `${(next() * 98).toFixed(1)}%`,
    top: `${Math.round(next() * 200)}px`,
    delay: `-${(next() * 3.4).toFixed(2)}s`,
  }));
})();

// The jack-o'-lantern's cut face, drawn twice: once fat and faint for the glow, once fine for the edge.
const FACE = 'M31 49 L37 38 L43 49Z M57 49 L63 38 L69 49Z M47 54 L50 48 L53 54Z M29 60 C38 74 62 74 71 60 L66 59 L62 64 L57 60 L50 67 L43 60 L38 64 L34 59Z';

function Pumpkin({ className }) {
  return (
    <div className={`holiday-pumpkin holiday-idle ${className}`}>
      <i className="holiday-pool" />
      <svg viewBox="0 0 100 86">
        <use href="#holiday-sym-pumpkin" />
      </svg>
    </div>
  );
}

function Symbols() {
  return (
    <svg className="holiday-defs" width="0" height="0" focusable="false">
      <defs>
        <symbol id="holiday-sym-pumpkin" viewBox="0 0 100 86">
          <ellipse cx="29" cy="52" rx="22" ry="29" fill="var(--holiday-pumpkin-deep)" />
          <ellipse cx="71" cy="52" rx="22" ry="29" fill="var(--holiday-pumpkin-deep)" />
          <ellipse cx="50" cy="50" rx="30" ry="32" fill="var(--holiday-pumpkin)" />
          <path d="M36 21 C25 38 25 66 37 80 M64 21 C75 38 75 66 63 80" fill="none" stroke="var(--holiday-pumpkin-deep)" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M45 21 C45 13 49 8 54 4 L59 8 C56 12 55 16 57 21 Z" fill="var(--holiday-stem)" />
          <path d={FACE} fill="var(--holiday-candle)" stroke="var(--holiday-candle)" strokeWidth="7" strokeLinejoin="round" opacity="0.28" />
          <path d={FACE} fill="var(--holiday-candle)" stroke="var(--holiday-candle)" strokeWidth="1.4" strokeLinejoin="round" />
        </symbol>
        <symbol id="holiday-sym-witch" viewBox="0 -16 200 126">
          <g fill="currentColor" stroke="var(--holiday-witch-rim)" strokeWidth="1" strokeLinejoin="round">
            <path d="M33 77 L9 66 L2 76 L7 87 L16 93 L38 80 Z" />
            <path d="M96 73 C98 55 112 41 130 37 C141 35 147 43 143 51 C139 59 141 67 151 73 C131 82 110 82 96 73 Z" />
            <path d="M96 73 C80 71 66 77 54 92 C73 85 90 86 106 82 Z" />
            <circle cx="136" cy="30" r="9" />
            <path d="M144 29 L152 33 L144 36 Z" />
            <path d="M128 32 C116 34 106 41 98 52 C111 47 122 45 131 40 Z" />
            <path d="M118 74 L111 91 L121 94 L127 77 Z" />
            <ellipse cx="136" cy="22" rx="20" ry="4.2" transform="rotate(-10 136 22)" />
            <path d="M124 21 C126 8 118 0 105 -11 C128 -9 139 7 145 21 Z" />
          </g>
          <path d="M32 78 L190 51" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" fill="none" />
          <path d="M32 78 L190 51" stroke="var(--holiday-witch-rim)" strokeWidth="0.7" fill="none" opacity="0.8" />
          <path d="M131 44 L152 58" stroke="currentColor" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M30 76 C22 73 14 71 8 70 M30 79 C20 80 12 82 7 84 M31 77 C22 77 12 77 5 77" stroke="var(--holiday-witch-rim)" strokeWidth="0.8" fill="none" opacity="0.7" />
        </symbol>
        <symbol id="holiday-sym-bat" viewBox="0 0 60 30">
          <path fill="currentColor" d="M30 13 C26 7 18 3 5 5 C9 9 11 13 10 19 C15 15 19 16 22 21 C25 17 27 16 30 20 C33 16 35 17 38 21 C41 16 45 15 50 19 C49 13 51 9 55 5 C42 3 34 7 30 13Z" />
          <ellipse cx="30" cy="15" rx="3.2" ry="5.2" fill="currentColor" />
          <path d="M27.5 10 L26.4 5.6 L29.6 8.6 M32.5 10 L33.6 5.6 L30.4 8.6" fill="currentColor" />
        </symbol>
        <symbol id="holiday-sym-moon" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="holiday-moon-shade" cx="40%" cy="38%" r="70%">
              <stop offset="0" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.34" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="var(--holiday-moon)" />
          <circle cx="50" cy="50" r="48" fill="url(#holiday-moon-shade)" />
          <g fill="var(--holiday-moon-edge)" opacity="0.42">
            <circle cx="34" cy="36" r="8" />
            <circle cx="62" cy="58" r="11" />
            <circle cx="44" cy="68" r="5" />
            <circle cx="68" cy="30" r="4" />
          </g>
        </symbol>
        <symbol id="holiday-sym-hills" viewBox="0 0 1280 150" preserveAspectRatio="none">
          <path d="M0 150 L0 96 C120 62 220 70 330 92 C450 116 520 70 650 64 C790 58 860 98 980 100 C1090 102 1180 66 1280 84 L1280 150 Z" />
        </symbol>
        <symbol id="holiday-sym-tree" viewBox="0 0 200 330">
          <path d="M84 330 C88 290 86 250 82 210 C70 190 52 176 30 170 C22 168 18 160 24 156 C46 158 66 168 80 182 C76 150 64 126 40 106 C32 100 36 92 44 96 C66 110 80 130 88 156 C90 120 86 84 70 52 C66 44 74 40 80 48 C94 74 100 108 100 146 C108 118 124 94 150 80 C158 76 162 84 156 90 C132 106 118 130 112 166 C124 150 144 140 170 138 C178 138 178 146 170 148 C146 152 128 164 114 186 C112 230 112 280 118 330 Z" />
        </symbol>
        <symbol id="holiday-sym-grave" viewBox="0 0 26 64">
          <path d="M3 64 L3 26 C3 6 23 6 23 26 L23 64 Z" />
        </symbol>
      </defs>
    </svg>
  );
}

export default function HalloweenScene() {
  return (
    <>
      <Symbols />

      <div className="holiday-bg">
        <div className="holiday-vignette" />
        <i className="holiday-fog" />
        <i className="holiday-fog f2" />
        <i className="holiday-wisp holiday-margin w1" />
        <i className="holiday-wisp holiday-margin w2" />
        <i className="holiday-wisp holiday-margin w3" />
        <i className="holiday-wisp holiday-margin w4" />
        <i className="holiday-wisp holiday-margin w5" />
        <i className="holiday-wisp holiday-margin w6" />
        <div className="holiday-eyes holiday-margin e1"><i /><i /></div>
        <div className="holiday-eyes holiday-margin e2"><i /><i /></div>
        <div className="holiday-eyes holiday-margin e3"><i /><i /></div>
      </div>

      <div className="holiday-sky">
        <div className="holiday-haze" />
        {STARS.map((star, i) => (
          <i key={i} className="holiday-star" style={{ left: star.left, top: star.top, '--d': star.delay }} />
        ))}
        <div className="holiday-moonbox">
          <i className="holiday-moon-glow" />
          <svg viewBox="0 0 100 100"><use href="#holiday-sym-moon" /></svg>
        </div>
        <i className="holiday-cloud k1" />
        <i className="holiday-cloud k2 holiday-wide" />
        <div className="holiday-witch holiday-mover holiday-margin">
          <svg viewBox="0 -16 200 126"><use href="#holiday-sym-witch" /></svg>
        </div>
        <div className="holiday-bats holiday-mover holiday-margin">
          <div className="holiday-bat b1"><svg viewBox="0 0 60 30"><use href="#holiday-sym-bat" /></svg></div>
          <div className="holiday-bat b2"><svg viewBox="0 0 60 30"><use href="#holiday-sym-bat" /></svg></div>
          <div className="holiday-bat b3"><svg viewBox="0 0 60 30"><use href="#holiday-sym-bat" /></svg></div>
          <div className="holiday-bat b4"><svg viewBox="0 0 60 30"><use href="#holiday-sym-bat" /></svg></div>
          <div className="holiday-bat b5"><svg viewBox="0 0 60 30"><use href="#holiday-sym-bat" /></svg></div>
        </div>
      </div>

      <div className="holiday-land">
        <svg className="holiday-tree holiday-wide" viewBox="0 0 200 330"><use href="#holiday-sym-tree" /></svg>
        <div className="holiday-ground">
          <svg viewBox="0 0 1280 150" preserveAspectRatio="none"><use href="#holiday-sym-hills" /></svg>
        </div>
        <svg className="holiday-grave g1" viewBox="0 0 26 64"><use href="#holiday-sym-grave" /></svg>
        <svg className="holiday-grave g2 holiday-wide" viewBox="0 0 26 64"><use href="#holiday-sym-grave" /></svg>
        <svg className="holiday-grave g3 holiday-wide" viewBox="0 0 26 64"><use href="#holiday-sym-grave" /></svg>
        <Pumpkin className="a holiday-margin" />
        <Pumpkin className="b holiday-margin" />
        <Pumpkin className="c holiday-margin" />
        <Pumpkin className="d holiday-margin" />
      </div>
    </>
  );
}
