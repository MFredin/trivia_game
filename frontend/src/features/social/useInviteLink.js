import { useCallback, useEffect, useState } from 'react';
import { getInviteCode } from '../../api/auth.js';

/**
 * The player's own invite link, and copying it. Whoever registers through the link is made a friend at once
 * (routes/auth.js), so it lives where friends are made — the Friends screen — and not in Settings.
 */
export function useInviteLink(token) {
  const [code, setCode] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    getInviteCode(token)
      .then((data) => setCode(data.invite_code))
      .catch(() => {});
  }, [token]);

  const link = code ? `${window.location.origin}/?invite=${code}` : null;

  const copy = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard API unavailable (older browser, insecure context): fall back to a select-and-copy.
      const textarea = document.createElement('textarea');
      textarea.value = link;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [link]);

  return { link, copied, copy };
}
