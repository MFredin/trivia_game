import { useEffect, useState } from 'react';

// The holiday art, loaded one holiday at a time. Each module (halloween.js and the rest) is a few HTML strings of decoration, 8 to 12 KB, and
// a player sees at most one of them at a time and only for part of the year, so none of them is in the bundle a player downloads to reach
// question one. The first component to ask starts the load; the rest read the same cache, so the backdrop, the plates and the foot all
// appear together.
const LOADERS = {
  halloween: () => import('./halloween.js'),
  thanksgiving: () => import('./thanksgiving.js'),
  yule: () => import('./yule.js'),
  newyear: () => import('./newyear.js'),
  easter: () => import('./easter.js'),
  midsummer: () => import('./midsummer.js'),
};

const loaded = new Map();
const loading = new Map();

function load(scene) {
  if (!loading.has(scene)) {
    const loader = LOADERS[scene];
    // A key with no art, or a chunk that fails to arrive, is no decoration rather than an error: the page is complete without it.
    loading.set(
      scene,
      (loader ? loader() : Promise.reject(new Error('no art'))).then((module) => loaded.set(scene, module.default)),
    );
  }
  return loading.get(scene);
}

/** The art for `scene` once it has loaded, else null. Reads the cache on every render, so a change of holiday never shows the last one's art. */
export function useHolidayArt(scene) {
  const [, setReady] = useState(0);
  useEffect(() => {
    if (!scene || loaded.has(scene)) return undefined;
    let current = true;
    load(scene)
      .then(() => current && setReady((n) => n + 1))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [scene]);
  return (scene && loaded.get(scene)) || null;
}
