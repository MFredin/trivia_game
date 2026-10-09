import { useCallback, useEffect, useRef, useState } from 'react';
import { catchBat } from '../../api/holiday.js';

// A bat flies across the page now and then on Halloween, and catching one unlocks an achievement. The first comes a few seconds after the page
// opens, so a player sees one early; after that, one every quarter minute or so. It is a small surprise, never an interruption: it flies only
// while nothing is being asked, never during a question or the guest preview, and only for a signed-in player, since the achievement needs an account.
const FIRST_MS = [6000, 4000];
const BETWEEN_MS = [16000, 20000];
const pick = ([base, spread]) => base + Math.random() * spread;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => (typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * The bats. What each of them is for:
 *   flyer   the bat crossing the page, while the scene is allowed to move
 *   perch   a bat hanging from the oak, for everyone else: a player who turned the animation off, a device that asks for reduced motion, and
 *           a keyboard (it is the one a keyboard reaches; while bats fly it is hidden until focused). Catching it is the same catch.
 * Neither exists outside Halloween, off the account, or during a question.
 */
export function useHolidayBats({ scene, token, signedIn, overlayOn, animated, calm }) {
  const reducedMotion = usePrefersReducedMotion();
  const available = scene === 'halloween' && overlayOn && signedIn && !calm;
  const flying = available && animated && !reducedMotion;

  const [flyer, setFlyer] = useState(null);
  const [perchGone, setPerchGone] = useState(false);
  const first = useRef(true);
  const sent = useRef(false);

  // Schedule the next bat whenever there is none on screen, and stop the moment bats are not wanted.
  useEffect(() => {
    if (!flying) {
      setFlyer(null);
      first.current = true;
      return undefined;
    }
    if (flyer) return undefined;
    const timer = setTimeout(
      () => {
        first.current = false;
        setFlyer({ id: Date.now(), top: 16 + Math.random() * 40, dur: 9 + Math.random() * 4, ltr: Math.random() < 0.5, w: 52 + Math.random() * 14, caught: false });
      },
      first.current ? pick(FIRST_MS) : pick(BETWEEN_MS),
    );
    return () => clearTimeout(timer);
  }, [flying, flyer]);

  // The server says whether this catch was the first; the toast comes over the socket either way, so there is nothing to show here. A failure
  // (offline, out of season) is a bat that got away, which is no reason to say anything.
  const report = useCallback(() => {
    if (sent.current) return;
    sent.current = true;
    catchBat(token)
      .catch(() => {})
      .finally(() => {
        sent.current = false;
      });
  }, [token]);

  const catchFlyer = useCallback(() => {
    setFlyer((f) => (f && !f.caught ? { ...f, caught: true } : f));
    report();
  }, [report]);

  const onFlyerEnd = useCallback((event) => {
    if (['hw-fly', 'hw-fly-r', 'hw-poof'].includes(event.animationName)) setFlyer(null);
  }, []);

  const catchPerch = useCallback(() => {
    setPerchGone(true);
    report();
  }, [report]);

  return { flyer, perch: available && !perchGone, perchHidden: flying, catchFlyer, onFlyerEnd, catchPerch };
}
