import { useEffect, useRef } from 'react';

/**
 * Watches for a phrase typed anywhere on the page.
 *
 * A passive listener with no preventDefault, so it never interferes with typing in a form
 * field. The mobile-friendly way in (tap the wordmark seven times) lives in NavBar and calls
 * the same handler — a keyboard-only easter egg would be invisible to most of the players.
 */
export function useSecretPhrase(phrase, onFound) {
  const bufferRef = useRef('');

  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.key.length !== 1) return;
      bufferRef.current = (bufferRef.current + event.key).slice(-phrase.length);
      if (bufferRef.current.toLowerCase() === phrase) {
        bufferRef.current = '';
        onFound();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [phrase, onFound]);
}
