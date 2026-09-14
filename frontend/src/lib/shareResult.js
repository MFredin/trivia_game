const SITE_NAME = 'The Restricted Section';

const MODE_LABELS = {
  classic: 'Classic Quiz',
  daily: 'Daily Challenge',
  blitz: 'Blitz',
  survival: 'Survival',
  gauntlet: 'Gauntlet',
};

export function buildRunShareText({ totalScore, mode, category, difficulty, bestStreak }) {
  const modeLabel = MODE_LABELS[mode] ?? mode;
  const segments = [category, difficulty].filter(Boolean);
  const modePhrase = segments.length > 0 ? `${modeLabel} (${segments.join(', ')})` : modeLabel;
  const streakPhrase = bestStreak > 1 ? ` with a ${bestStreak}-streak` : '';
  return `Scored ${totalScore} on ${modePhrase}${streakPhrase} in ${SITE_NAME} — beat that?`;
}

export function buildDuelShareText({ yourScore, opponentScore, opponentUsername, outcome }) {
  const verb = outcome === 'win' ? 'beat' : outcome === 'loss' ? 'lost to' : 'tied';
  return `I ${verb} ${opponentUsername ?? 'a friend'} ${yourScore}-${opponentScore} in a duel on ${SITE_NAME} — care for a rematch?`;
}

// navigator.clipboard requires a secure context and isn't universal (older Safari, some
// in-app browsers), so callers get back whether it actually worked and can show the
// selectable-textarea fallback themselves rather than silently doing nothing.
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path below
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
