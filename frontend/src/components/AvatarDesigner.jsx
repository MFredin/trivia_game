import { useState } from 'react';
import Avatar from './Avatar.jsx';
import Icon from './icons.jsx';
import { AVATAR_SIGILS, AVATAR_SIGIL_BY_ID } from '../constants/avatarSigils.js';
import { AVATAR_LAYER_BY_ID, AVATAR_STYLE_LAYERS, LAYER_LABELS } from '../constants/avatarStyle.js';

const LAYERS = ['shape', 'color', 'pattern', 'frame', 'mark'];
const GROUPS = ['sigil', ...LAYERS];
const GROUP_LABELS = { sigil: 'Sigil', ...LAYER_LABELS };

/**
 * Dress an avatar: pick a sigil, then a shape, colour, pattern, frame and corner mark. One part shows at a
 * time, chosen from the row above, each labelled with what is currently picked — six stacked rows of options
 * were most of the length of Edit Profile. Every button is a small preview of the avatar as it would look with
 * THAT choice (and the rest of the draft as it stands), so there is nothing to imagine. Choices that have to
 * be earned are shown, disabled, with what earns them — a locked option that simply was not there would give
 * no one anything to play for. The large preview lives beside the editor (ProfilePreview).
 */
export default function AvatarDesigner({ draft, username, house, locks, onSigil, onStyle }) {
  const [group, setGroup] = useState('sigil');

  const lockFor = (layer, id) => locks.get(`${layer}:${id}`);
  const isLocked = (layer, id) => {
    const lock = lockFor(layer, id);
    return Boolean(lock && !lock.unlocked);
  };
  const preview = (override = {}) => ({ avatar: draft.avatar, style: draft.style, ...override });
  const currentName = (g) => (g === 'sigil' ? (AVATAR_SIGIL_BY_ID?.[draft.avatar]?.label ?? 'Your initial') : AVATAR_LAYER_BY_ID[g]?.[draft.style[g]]?.label);

  const lockedHere = group === 'sigil' ? [] : AVATAR_STYLE_LAYERS[group].filter((o) => isLocked(group, o.id));

  return (
    <div className="designer">
      <div className="designer-groups" role="group" aria-label="Part of the avatar">
        {GROUPS.map((g) => (
          <button key={g} type="button" className="designer-group-button" aria-pressed={group === g} onClick={() => setGroup(g)}>
            {GROUP_LABELS[g]}
            <span className="designer-group-value">{currentName(g)}</span>
          </button>
        ))}
      </div>

      {group === 'sigil' ? (
        <div className="designer-options" role="group" aria-label="Sigil">
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
      ) : (
        <>
          <div className="designer-options" role="group" aria-label={GROUP_LABELS[group]}>
            {AVATAR_STYLE_LAYERS[group].map((option) => {
              const locked = isLocked(group, option.id);
              const lock = lockFor(group, option.id);
              const name = locked ? `${option.label}, locked — earn ${lock.achievement_name}` : option.label;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`avatar-option ${draft.style[group] === option.id ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`}
                  aria-pressed={draft.style[group] === option.id}
                  aria-label={name}
                  title={name}
                  disabled={locked}
                  onClick={() => onStyle(group, option.id)}
                >
                  <Avatar username={username} {...preview({ style: { ...draft.style, [group]: option.id } })} house={house} size={40} />
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
              Locked: {lockedHere.map((o) => `${o.label} (earn “${lockFor(group, o.id).achievement_name}”)`).join(', ')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
