// Six slow-drifting motes pinned to the viewport edges. Purely decorative: hidden below
// 1240px (no empty margin to sit in) and under prefers-reduced-motion, both in CSS.
const EMBERS = [
  { left: '6%', top: '34%', delay: '-2s' },
  { left: '9%', top: '72%', delay: '-6s' },
  { left: '4%', top: '58%', delay: '-4s', small: true },
  { left: '92%', top: '46%', delay: '-8s' },
  { left: '95%', top: '80%', delay: '-1s', small: true },
  { left: '90%', top: '88%', delay: '-5s' },
];

export default function Embers() {
  return (
    <>
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className={`ember ${e.small ? 'is-small' : ''}`}
          style={{ left: e.left, top: e.top, animationDelay: e.delay }}
        />
      ))}
    </>
  );
}
