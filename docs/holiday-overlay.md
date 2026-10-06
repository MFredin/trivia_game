# Holiday overlay

A decorated backdrop that goes up around a holiday: a night sky behind the quiz, and decorations in the margins. Halloween is
the first; Yule is next and joins by adding one entry and one scene (see "Adding a holiday").

It is atmosphere, not a feature of the game. It never delays the first question, never sits over content, and a player can turn
it off.

## What a player sees

- **Settings → Appearance → Holiday overlay**, two switches, both **on by default**:
  - **Show the overlay**: the scene itself.
  - **Animated background**: whether it moves. Off keeps the still scene. Disabled while the overlay is off.
- Both are saved **on the account**, so the choice follows the player to another device. A visitor who is not signed in has no
  account to hold a choice and sees the defaults (on).
- Settings says whether a holiday is on right now. Outside a holiday the switches are kept for the next one.

## When it is on

Which overlay is on is a pure function of the date, in `backend/src/lib/holidayOverlay.js`, evaluated in UTC like the seasons. The
client asks `GET /api/holiday` (public: the sign-in screen is dressed too) and draws nothing if it fails.

| Holiday | Window (both days included) | Why this window |
|---|---|---|
| Halloween | 1 October to 2 November | The Halloween *bundle* runs 17 October to 2 November (`lib/seasons.js`). The decoration goes up earlier: it is what tells a player the season has started. |

A test asserts every overlay window **covers its bundle's whole season**, so a decorated page never loses its decoration partway
through the feast.

Outside production `GET /api/holiday?force=halloween` treats that holiday as on, for development and browser tests. It is
ignored in production, so it can never switch a holiday on for players.

## How it is built

| Layer | File |
|---|---|
| Window rule, settings parsing | `backend/src/lib/holidayOverlay.js` |
| `GET /api/holiday` | `backend/src/routes/holiday.js` |
| `PATCH /api/account/holiday` | `backend/src/routes/account.js` |
| Columns `users.holiday_overlay`, `users.holiday_motion` (default true) | `backend/src/db/schema.sql` |
| State: what is on, the two switches, optimistic save | `frontend/src/features/holiday/useHoliday.js` |
| Shell: carries the calm / still states as attributes | `frontend/src/components/HolidayOverlay.jsx` |
| The Halloween scene | `frontend/src/components/HalloweenScene.jsx` + `styles/parts/halloween.css` |
| Rules every scene shares | `frontend/src/styles/parts/holiday-overlay.css` |
| Settings section | `components/HolidaySettings.jsx`, `Switch.jsx` |
| Colours | `--holiday-*` role tokens in `styles/tokens.css` |

CSS and inline SVG only, no image files. The overlay component is `lazy()`-loaded and mounted once in `App.jsx`, so it is not in
the bundle a player downloads to reach question one.

## The rules every scene follows

1. **Behind everything.** One fixed layer at `z-index: -1`. It ignores the pointer, is `aria-hidden`, and is `display: none` in
   print. Nothing is drawn over a question, an answer, a button or the timer.
2. **The quiz comes first.** While a question is on screen (`screen === 'question'`, or the guest preview) `data-calm="on"` stops
   every animation and removes the extras (travellers, lights, eyes, pumpkins). The quiz is the only thing that moves.
3. **Reduced motion is honoured.** `prefers-reduced-motion` is treated exactly as "Animated background: off", whatever the switch
   says. The travellers (witch, bats) are not drawn at all when still, because parked in mid-air they would look stuck.
4. **Nothing flashes.** The slowest-blinking thing is eyes that open once every twelve seconds.
5. **Cheap.** Every animation changes `transform` or `opacity` only; the moon's pulse is an opacity change on a separate glow
   element rather than an animated `filter`. No scripts run per frame.
6. **Pale shapes live in the margins only.** The page's content is 1040px wide, so a margin exists only at 1280px and up.
   Anything light that floats (the moon, the witch, pumpkins, lights, eyes) is marked `holiday-margin` and is **not drawn
   below 1280px**; below that, the moon shows only as a rising edge above the nav. This is a legibility rule, not a taste one:
   the first build put the moon behind the nav and a pumpkin behind the footer, and the nav links and footer text lost contrast.
   Dark shapes (hills, tree, gravestones, haze) only ever help and are drawn everywhere. A phone also drops what is marked
   `holiday-wide` (the tree, two gravestones, the second cloud).
7. **Follows the binding.** The scene is the same in all five houses; the fog takes a house tint, and Monochrome rebinds every
   token to grey so that binding stays colourless.

## What the audits check, and what they cannot

`npm run audit:contrast` includes the lightest grounds the overlay can put behind page-level text: the haze (60% at the top
edge, behind the nav and first heading) and the fog (34%, behind the footer), for every house. Writing this found two real
failures, Monochrome's fog and Slytherin's, and both tints were darkened. The audit **cannot** measure a pale shape such as the
moon, which is why rule 6 exists as a layout rule and `e2e/holiday-overlay.test.mjs` asserts it at 390, 1100 and 1400px.

`e2e/holiday-overlay.test.mjs` also covers: on by default, nothing drawn over the page's middle, each switch on its own, the
choice surviving a reload (it is on the account, not the device), calm during a question, reduced motion, no overlay between
holidays, and no horizontal overflow on a phone. The existing layout, overflow and accessibility e2e tests run with the overlay
on whenever a holiday is.

## Adding a holiday

1. Add `{ key, start, end }` to `OVERLAYS` in `backend/src/lib/holidayOverlay.js`. The window must cover its season's window if it
   has one (a test checks), and must not overlap another overlay (a test checks).
2. Add `{ label }` to `frontend/src/constants/holidays.js`.
3. Add `XScene.jsx` and `x.css`, put the scene in `SCENES` in `HolidayOverlay.jsx`, and add the `@import` to `styles/index.css`.
4. Add `--holiday-*` tokens if the palette differs (Yule is not orange), in `tokens.css` inside each house's block, and re-run
   `npm run audit:contrast`.
5. Mark every pale floating piece `holiday-margin`, and every movement `holiday-mover` or an animation the shared rules reach.

## Known limits

- A signed-out visitor cannot turn it off until they have an account.
- Below 1280px the scene is a night sky with fog, hills and a gravestone and no jack-o'-lanterns, because there is no empty space
  to put one without risking text. A pumpkin that lives *on* the page (beside a plate's eyebrow, say) would be a separate piece
  of work.
