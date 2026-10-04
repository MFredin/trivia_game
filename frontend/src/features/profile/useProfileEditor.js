import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCustomization, saveProfile } from '../../api/account.js';
import { resolveStyle } from '../../constants/avatarStyle.js';

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

const draftFrom = (user) => ({
  avatar: user.avatar ?? null,
  style: resolveStyle(user.avatar_style),
  bio: user.bio ?? '',
  favoriteBook: user.favorite_book ?? '',
  favoriteSubject: user.favorite_subject ?? '',
  pinned: [...(user.pinned_achievements ?? [])],
});

/**
 * The Edit Profile screen's state: a draft of everything editable, what the server says is
 * earned, and a single save. Nothing is applied until Save, because the bio is the one field that
 * can be refused and a half-saved profile (new avatar, old bio, an error) reads as broken.
 *
 * `active` is whether the screen is showing: the draft starts fresh from the account each time it
 * opens, and the customisation lists are only fetched then.
 */
export function useProfileEditor({ token, user, active, onUserChanged }) {
  const [customization, setCustomization] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [draft, setDraft] = useState(() => (user ? draftFrom(user) : null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!active || !token || !user) return;
    setDraft(draftFrom(user));
    setError(null);
    setSaved(false);
    setLoadError(null);
    getCustomization(token)
      .then(setCustomization)
      .catch(() => setLoadError('Could not load your options. Try again.'));
    // Fresh each time the screen opens; later changes to `user` (a save) must not reset the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, token]);

  const dirty = useMemo(() => {
    if (!user || !draft) return false;
    const base = draftFrom(user);
    return (
      draft.avatar !== base.avatar ||
      JSON.stringify(draft.style) !== JSON.stringify(base.style) ||
      draft.bio.trim() !== base.bio ||
      draft.favoriteBook !== base.favoriteBook ||
      draft.favoriteSubject !== base.favoriteSubject ||
      !sameList(draft.pinned, base.pinned)
    );
  }, [user, draft]);

  const change = useCallback((fields) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, ...fields }));
  }, []);

  const setStyle = useCallback((layer, id) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, style: { ...prev.style, [layer]: id } }));
  }, []);

  const discard = useCallback(() => {
    setDraft(draftFrom(user));
    setError(null);
    setSaved(false);
  }, [user]);

  const save = useCallback(async () => {
    const base = draftFrom(user);
    const fields = {};
    if (draft.avatar !== base.avatar) fields.avatar = draft.avatar;
    if (JSON.stringify(draft.style) !== JSON.stringify(base.style)) fields.avatar_style = draft.style;
    if (draft.bio.trim() !== base.bio) fields.bio = draft.bio;
    if (draft.favoriteBook !== base.favoriteBook) fields.favorite_book = draft.favoriteBook || null;
    if (draft.favoriteSubject !== base.favoriteSubject) fields.favorite_subject = draft.favoriteSubject || null;
    if (!sameList(draft.pinned, base.pinned)) fields.pinned_achievements = draft.pinned;

    setSaving(true);
    setError(null);
    try {
      const data = await saveProfile(fields, token);
      onUserChanged(data.user);
      setDraft(draftFrom(data.user));
      setSaved(true);
    } catch (err) {
      setError({ code: err.code, option: err.option });
    } finally {
      setSaving(false);
    }
  }, [draft, user, token, onUserChanged]);

  return { customization, loadError, draft, dirty, saving, error, saved, change, setStyle, discard, save };
}
