import { useId } from 'react';
import { AVATAR_SIGIL_BY_ID } from '../constants/avatarSigils.js';
import { AVATAR_LAYER_BY_ID, resolveStyle } from '../constants/avatarStyle.js';
import { DEFAULT_HOUSE, HOUSES } from '../constants/houses.js';

const HOUSE_BY_ID = Object.fromEntries(HOUSES.map((h) => [h.id, h]));

// Frames and marks are drawn in the sigil colour, except the gilt frame, which is gold — unless
// the disc is light, where gold would disappear and a darker bronze is used.
const GILT = '#d3a625';
const GILT_ON_LIGHT = '#7a5c10';

// A mark sits on a small backing disc in the corner of the 48-unit square.
const MARK_CENTER = 35;

function palette(colorId, house) {
  const color = AVATAR_LAYER_BY_ID.color[colorId];
  if (colorId === 'house' || !color?.disc) {
    const h = HOUSE_BY_ID[house] ?? HOUSE_BY_ID[DEFAULT_HOUSE];
    return { disc: h.cover, deep: h.coverDeep, mark: h.sigil, light: false };
  }
  return { disc: color.disc, deep: color.deep, mark: color.mark, light: colorId === 'parchment' };
}

function Sigil({ sigil, transform }) {
  return (
    <g transform={transform}>
      {sigil.shapes.map((shape, i) => (
        <path key={i} d={shape.d} fill={shape.fill ? 'currentColor' : 'none'} />
      ))}
    </g>
  );
}

/**
 * A player's face in the app: a sigil (or, until they pick one, their initial) on a disc they
 * have dressed — shape, colour, pattern, frame, corner mark. All of it is SVG drawn from fixed
 * lists, so nothing here depends on an uploaded image or on anything a player typed.
 *
 * Colours come from the style, or from the OWNER's house when the style says so, never from the
 * viewer's tokens: a friends list shows five houses at once and each avatar has to read as its
 * owner's. Decorative by default (the name always sits beside it); pass `label` where it stands
 * alone.
 */
export default function Avatar({ username, avatar, style, house, size = 40, label, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const s = resolveStyle(style);
  const shape = AVATAR_LAYER_BY_ID.shape[s.shape];
  const pattern = AVATAR_LAYER_BY_ID.pattern[s.pattern];
  const frame = AVATAR_LAYER_BY_ID.frame[s.frame];
  const mark = AVATAR_LAYER_BY_ID.mark[s.mark];
  const { disc, deep, mark: ink, light } = palette(s.color, house);
  const sigil = avatar ? AVATAR_SIGIL_BY_ID[avatar] : null;
  const initial = [...(username ?? '?')][0]?.toUpperCase() ?? '?';
  const markSigil = mark?.sigil ? AVATAR_SIGIL_BY_ID[mark.sigil] : null;

  return (
    <span
      className={`avatar ${className}`}
      style={{ '--avatar-size': `${size}px`, color: ink }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 48 48" focusable="false">
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor={disc} />
            <stop offset="1" stopColor={deep} />
          </linearGradient>
          <clipPath id={`${uid}-clip`}>
            <path d={shape.path} />
          </clipPath>
        </defs>

        <path d={shape.path} fill={`url(#${uid}-fill)`} />

        {pattern.d && (
          <g clipPath={`url(#${uid}-clip)`} opacity="0.3">
            <path
              d={pattern.d}
              fill={pattern.fill ? ink : 'none'}
              stroke={pattern.fill ? 'none' : ink}
              strokeWidth="0.9"
            />
          </g>
        )}

        {frame.rings.map((ring, i) => (
          <path
            key={i}
            d={shape.path}
            transform={`translate(24 24) scale(${ring.scale}) translate(-24 -24)`}
            fill="none"
            stroke={ring.gilt ? (light ? GILT_ON_LIGHT : GILT) : ink}
            strokeWidth={ring.width}
            strokeDasharray={ring.dash}
            strokeLinecap={ring.round ? 'round' : 'butt'}
            opacity={ring.gilt ? 1 : 0.85}
          />
        ))}

        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {sigil ? (
            <Sigil sigil={sigil} transform="translate(9.6 9.6) scale(1.2)" />
          ) : (
            <text
              x="24"
              y="24.5"
              textAnchor="middle"
              dominantBaseline="central"
              fill="currentColor"
              stroke="none"
              fontSize="24"
              fontFamily="var(--font-display)"
            >
              {initial}
            </text>
          )}
        </g>

        {(markSigil || mark?.pip) && (
          <g>
            <circle cx={MARK_CENTER} cy={MARK_CENTER} r="6.4" fill={deep} stroke={ink} strokeWidth="0.8" />
            {mark.pip ? (
              <circle cx={MARK_CENTER} cy={MARK_CENTER} r="2.2" fill={ink} />
            ) : (
              <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <Sigil sigil={markSigil} transform={`translate(${MARK_CENTER - 4.2} ${MARK_CENTER - 4.2}) scale(0.35)`} />
              </g>
            )}
          </g>
        )}
      </svg>
    </span>
  );
}
