import { useCallback, useEffect, useRef, useState } from 'react';
import { catchVisitor } from '../../api/holiday.js';
import { HOLIDAYS } from '../../constants/holidays.js';

// The holiday's creature crosses the page now and then while a holiday that has one is on (a bat, a turkey, an owl; constants/holidays.js), and
// catching it unlocks an achievement. The first comes a few seconds after the page opens, so a player sees one early; after that, one every
// quarter minute or so. It is a small surprise, never an interruption: it crosses only while nothing is being asked, never during a question or
// the guest preview, and only for a signed-in player, since the achievement needs an account.
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
 * The visitor. What each part of it is for:
 *   flyer   the creature crossing the page, while the scene is allowed to move
 *   perch   the same creature standing in the scene, for everyone else: a player who turned the animation off, a device that asks for reduced
 *           motion, and a keyboard (it is the one a keyboard reaches; while the flyer crosses it is hidden until focused). Catching it is the
 *           same catch.
 * Neither exists on a holiday with no creature, off the account, or during a question.
 */
export function useHolidayVisitor({ scene, token, signedIn, overlayOn, animated, calm }) {
  const config = HOLIDAYS[scene]?.visitor ?? null;
  const reducedMotion = usePrefersReducedMotion();
  const available = Boolean(config) && overlayOn && signedIn && !calm;
  const flying = available && animated && !reducedMotion;

  const [flyer, setFlyer] = useState(null);
  const [perchGone, setPerchGone] = useState(false);
  const first = useRef(true);
  const sent = useRef(false);

  // Schedule the next one whenever there is none on screen, and stop the moment one is not wanted.
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
        const [from, spread] = config.lane === 'ground' ? config.bottom : config.top;
        setFlyer({
          id: Date.now(),
          pos: from + Math.random() * spread,
          dur: config.dur[0] + Math.random() * config.dur[1],
          ltr: Math.random() < 0.5,
          w: config.width[0] + Math.random() * config.width[1],
          caught: false,
        });
      },
      first.current ? pick(FIRST_MS) : pick(BETWEEN_MS),
    );
    return () => clearTimeout(timer);
  }, [flying, flyer, config]);

  // A new holiday is a new creature, and one that was caught or hanging from the last is no business of the next.
  useEffect(() => {
    setPerchGone(false);
    setFlyer(null);
  }, [scene]);

  // The server says whether this catch was the first; the toast comes over the socket either way, so there is nothing to show here. A failure
  // (offline, out of season) is a creature that got away, which is no reason to say anything.
  const report = useCallback(() => {
    if (sent.current) return;
    sent.current = true;
    catchVisitor(token)
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
    if (['hol-fly', 'hol-fly-r', 'hol-poof'].includes(event.animationName)) setFlyer(null);
  }, []);

  const catchPerch = useCallback(() => {
    setPerchGone(true);
    report();
  }, [report]);

  return { scene, flyer, perch: available && !perchGone, perchHidden: flying, catchFlyer, onFlyerEnd, catchPerch };
}
