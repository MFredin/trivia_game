import { AVATAR_SIGIL_BY_ID } from '../constants/avatarSigils.js';
import { DEFAULT_HOUSE, HOUSES } from '../constants/houses.js';

const HOUSE_BY_ID = Object.fromEntries(HOUSES.map((h) => [h.id, h]));

/**
 * A player's face in the app: a disc in their own house colours carrying either the sigil they
 * picked or, until they pick one, their initial.
 *
 * The house colours are applied directly rather than through the role tokens, for the same
 * reason the profile's "Bound in" card does: these tokens are scoped to whoever is LOOKING, and
 * an avatar has to render in its owner's house wherever it appears — a friends list shows five
 * houses at once. Decorative by default (the name always sits beside it); pass `label` where the
 * avatar stands alone.
 */
export default function Avatar({ username, avatar, house, size = 40, label, className = '' }) {
  const palette = HOUSE_BY_ID[house] ?? HOUSE_BY_ID[DEFAULT_HOUSE];
  const sigil = avatar ? AVATAR_SIGIL_BY_ID[avatar] : null;
  const initial = [...(username ?? '?')][0]?.toUpperCase() ?? '?';

  return (
    <span
      className={`avatar ${className}`}
      style={{
        '--avatar-size': `${size}px`,
        background: `linear-gradient(160deg, ${palette.cover}, ${palette.coverDeep})`,
        color: palette.sigil,
      }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {sigil ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {sigil.shapes.map((shape, i) => (
            <path key={i} d={shape.d} fill={shape.fill ? 'currentColor' : 'none'} />
          ))}
        </svg>
      ) : (
        <span className="avatar-initial">{initial}</span>
      )}
    </span>
  );
}
