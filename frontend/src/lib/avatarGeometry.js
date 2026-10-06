// Path data for the avatar's background patterns, on the same 48-unit square the avatar is drawn
// in. Pure arithmetic, no React, so the shapes can be reasoned about (and the file imported by
// the constants that list them) without rendering anything.
const r = (n) => Math.round(n * 100) / 100;

export function dotGrid({ step = 8, radius = 1.1 } = {}) {
  const parts = [];
  for (let x = step; x < 48; x += step) {
    for (let y = step; y < 48; y += step) {
      parts.push(`M${r(x - radius)} ${y}a${radius} ${radius} 0 1 0 ${r(radius * 2)} 0a${radius} ${radius} 0 1 0 ${r(-radius * 2)} 0z`);
    }
  }
  return parts.join('');
}

export function rays({ count = 12, length = 34 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    parts.push(`M24 24L${r(24 + Math.cos(a) * length)} ${r(24 + Math.sin(a) * length)}`);
  }
  return parts.join('');
}

export function rings(radii = [8, 14, 20]) {
  return radii.map((rad) => `M${24 - rad} 24a${rad} ${rad} 0 1 0 ${rad * 2} 0a${rad} ${rad} 0 1 0 ${-rad * 2} 0z`).join('');
}

export function grid({ step = 8 } = {}) {
  const parts = [];
  for (let i = step; i < 48; i += step) parts.push(`M${i} 0V48M0 ${i}H48`);
  return parts.join('');
}

export function weave({ step = 8 } = {}) {
  const parts = [];
  for (let i = -48; i < 96; i += step) parts.push(`M${i} 0L${i + 48} 48M${i} 48L${i + 48} 0`);
  return parts.join('');
}
