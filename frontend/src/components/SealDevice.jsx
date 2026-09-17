import { useId } from 'react';
import HouseDevice from './HouseDevice.jsx';

// The stamped gold seal that overlaps the top of the reveal plate — the one big animated
// moment in the whole Second Edition (a brief stamp-and-settle on mount). Everything else
// on the page stays still.
export default function SealDevice({ house, size = 220 }) {
  const ringId = useId();

  return (
    <svg
      className="seal-device"
      viewBox="0 0 220 220"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ filter: 'drop-shadow(0 14px 22px rgba(0,0,0,.55))' }}
    >
      <defs>
        <path id={ringId} d="M110 110 m-84 0 a84 84 0 1 1 168 0 a84 84 0 1 1 -168 0" />
        <radialGradient id={`${ringId}-fill`} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="var(--leaf-hi)" />
          <stop offset="0.55" stopColor="var(--leaf)" />
          <stop offset="1" stopColor="var(--leaf-lo)" />
        </radialGradient>
      </defs>
      <circle cx="110" cy="110" r="106" fill={`url(#${ringId}-fill)`} stroke="var(--leaf-edge)" strokeWidth="2" />
      <circle cx="110" cy="110" r="97" fill="none" stroke="var(--leaf-edge)" strokeWidth="1" opacity="0.8" />
      <circle cx="110" cy="110" r="70" fill="none" stroke="var(--leaf-edge)" strokeWidth="1" opacity="0.8" />
      {/* leaf-text, not leaf-edge: the edge colour is the seal's border tone and read as
          low as 1.43:1 against the leaf it sits on. leaf-text is the role already
          calibrated to read on the leaf (the primary button's label), 6.09–11.62:1. */}
      <text fontFamily="'IM Fell English', Georgia, serif" fontSize="14.5" letterSpacing="3.2" fill="var(--leaf-text)">
        <textPath href={`#${ringId}`} startOffset="0">
          THE RESTRICTED SECTION &middot; ENQUIRY CONCLUDED &middot;
        </textPath>
      </text>
      <g transform="translate(78 78)" style={{ color: 'var(--leaf-text)' }}>
        <HouseDevice house={house} size={64} />
      </g>
    </svg>
  );
}
