import HalloweenScene from './HalloweenScene.jsx';

// The seasonal backdrop, mounted once in App.jsx while a holiday is on and the player has not turned it off. It is a fixed
// layer behind the whole page: it ignores the pointer, is hidden from screen readers, and paints below every piece of
// content, so nothing is ever drawn over a question, an answer, a button or the timer.
//
//   scene     which holiday ('halloween'); a key with no scene draws nothing
//   animated  the player's "Animated background" switch. Off keeps the scene and stills it
//   calm      a question is on screen: everything stops and the extras go, so the quiz is the only thing that moves
//
// The scenes are one file each (HalloweenScene.jsx, and Yule's when it exists) with their own stylesheet. This file only
// decides which one, and carries the two states as attributes the stylesheet keys on, so a scene needs no logic of its own.
const SCENES = { halloween: HalloweenScene };

export default function HolidayOverlay({ scene, animated, calm }) {
  const Scene = SCENES[scene];
  if (!Scene) return null;
  return (
    <div className="holiday" data-scene={scene} data-motion={animated ? 'full' : 'still'} data-calm={calm ? 'on' : 'off'} aria-hidden="true">
      <Scene />
    </div>
  );
}
