import Avatar from './Avatar.jsx';
import Icon from './icons.jsx';
import { AVATAR_SIGILS } from '../constants/avatarSigils.js';
import { AVATAR_STYLE_LAYERS, LAYER_LABELS } from '../constants/avatarStyle.js';

const LAYERS = ['shape', 'color', 'pattern', 'frame', 'mark'];

/**
 * Dress an avatar: pick a sigil, then a shape, colour, pattern, frame and corner mark. Every
 * button is a small preview of the avatar as it would look with THAT choice (and the rest of the
 * draft as it stands), so there is nothing to imagine. Choices that have to be earned are shown,
 * disabled, with what earns them — a locked option that simply was not there would give no one
 * anything to play for.
 */
export default function AvatarDesigner({ draft, username, house, locks, onSigil, onStyle }) {
  const lockFor = (layer, id) => locks.get(`${layer}:${id}`);
  const isLocked = (layer, id) => {
    const lock = lockFor(layer, id);
    return Boolean(lock && !lock.unlocked);
  };
  const preview = (override = {}) => ({ avatar: draft.avatar, style: draft.style, ...override });

  return (
    <div className="designer">
      <div className="designer-preview">
        <Avatar username={username} avatar={draft.avatar} style={draft.style} house={house} size={96} label="Your avatar" />
        <p className="explanation">
          This is what other players see beside your name. &ldquo;Your house&rdquo; colour follows your binding; the other
          colours stay as chosen.
        </p>
      </div>

      <fieldset className="designer-group">
        <legend className="designer-legend">Sigil</legend>
        <div className="designer-options">
          <button
            type="button"
            className={`avatar-option ${draft.avatar ? '' : 'is-active'}`}
            aria-pressed={!draft.avatar}
            aria-label="Your initial"
            title="Your initial"
            onClick={() => onSigil(null)}
          >
            <Avatar username={username} avatar={null} style={draft.style} house={house} size={40} />
          </button>
          {AVATAR_SIGILS.map((sigil) => (
            <button
              key={sigil.id}
              type="button"
              className={`avatar-option ${draft.avatar === sigil.id ? 'is-active' : ''}`}
              aria-pressed={draft.avatar === sigil.id}
              aria-label={sigil.label}
              title={sigil.label}
              onClick={() => onSigil(sigil.id)}
            >
              <Avatar username={username} avatar={sigil.id} style={draft.style} house={house} size={40} />
            </button>
          ))}
        </div>
      </fieldset>

      {LAYERS.map((layer) => {
        const lockedHere = AVATAR_STYLE_LAYERS[layer].filter((o) => isLocked(layer, o.id));
        return (
          <fieldset key={layer} className="designer-group">
            <legend className="designer-legend">{LAYER_LABELS[layer]}</legend>
            <div className="designer-options">
              {AVATAR_STYLE_LAYERS[layer].map((option) => {
                const locked = isLocked(layer, option.id);
                const lock = lockFor(layer, option.id);
                const name = locked ? `${option.label}, locked — earn ${lock.achievement_name}` : option.label;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`avatar-option ${draft.style[layer] === option.id ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`}
                    aria-pressed={draft.style[layer] === option.id}
                    aria-label={name}
                    title={name}
                    disabled={locked}
                    onClick={() => onStyle(layer, option.id)}
                  >
                    <Avatar
                      username={username}
                      {...preview({ style: { ...draft.style, [layer]: option.id } })}
                      house={house}
                      size={40}
                    />
                    {locked && (
                      <span className="avatar-option-lock" aria-hidden="true">
                        <Icon name="lock" size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {lockedHere.length > 0 && (
              <p className="designer-locked">
                Locked:{' '}
                {lockedHere
                  .map((o) => `${o.label} (earn “${lockFor(layer, o.id).achievement_name}”)`)
                  .join(', ')}
              </p>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
