import Avatar from './Avatar.jsx';
import PlayerTitle from './PlayerTitle.jsx';
import { HOUSES } from '../constants/houses.js';

const HOUSE_LABEL = Object.fromEntries(HOUSES.map((h) => [h.id, h.label]));

/**
 * How the player will appear, kept in view beside the editor so a change to the avatar, title or bio can be
 * seen without leaving the tab it was made on. It reads the draft, so it shows changes before they are saved.
 * On a phone it collapses to a strip across the top of the editor.
 */
export default function ProfilePreview({ user, draft, titles, dirty }) {
  const title = draft.title ? titles?.find((t) => t.id === draft.title) : null;
  return (
    <aside className="plate profile-preview" aria-label="How you appear to other players">
      <span className="plate-corner tl" />
      <span className="plate-corner br" />
      <Avatar username={user.username} avatar={draft.avatar} style={draft.style} house={user.theme} size={96} label="Your avatar" />
      <div className="profile-preview-who">
        <span className="profile-preview-name">{user.username}</span>
        <PlayerTitle title={title && { id: title.id, name: title.name, kind: title.kind }} />
        <span className="profile-preview-house">{HOUSE_LABEL[user.theme]}</span>
      </div>
      {draft.bio.trim() && <p className="profile-preview-bio">{draft.bio.trim()}</p>}
      <p className="profile-preview-state">{dirty ? 'Preview — not saved yet' : 'This is how you appear now'}</p>
    </aside>
  );
}
