# Holiday overlay

A seasonal dressing for the whole app: a dark backdrop behind the quiz, small drifting things in the gutters, ornament on the
plates, and a scene above the footer. Six holidays are built, and each is drawn for a **phone first**: the details that are on a
desktop are on a phone too, because most players are on one.

It is atmosphere, not a feature of the game. It never delays the first question, never sits over content, and a player can turn it
off.

## What a player sees

- **Settings → Appearance → Holiday overlay**, two switches, both **on by default**:
  - **Show the overlay**: the dressing itself.
  - **Animated background**: whether it moves. Off keeps the still scene. Disabled while the overlay is off.
- Both are saved **on the account**, so the choice follows the player to another device. A visitor who is not signed in has no
  account to hold a choice and sees the defaults (on).
- Settings says whether a holiday is on right now. Outside a holiday the switches are kept for the next one.
- **Admins only:** a third control, *Overlay*, lists *Automatic* and every holiday. It lets an admin preview any overlay on any
  day, and sits in the same section as the switches. It is not shown to anyone else (see "Admin override").

## When each is on

Which overlay is on is a pure function of the date, in `backend/src/lib/holidayOverlay.js`, evaluated in UTC like the seasons. The
client asks `GET /api/holiday` (public: the sign-in screen is dressed too) and draws nothing if it fails.

| Holiday | Window (both days included) | Notes |
|---|---|---|
| Halloween | 1 October to 2 November | The Halloween *bundle* runs 17 October to 2 November (`lib/seasons.js`); the dressing goes up earlier because it is what tells a player the season has started. |
| Thanksgiving | 3 to 30 November | Starts the day after Halloween ends. |
| Yule | 1 to 30 December | The Yule bundle's whole season is covered. |
| New Year's | 31 December to 2 January | Crosses the year end. |
| Easter | 14 days before Easter Sunday to Easter Monday | Moves every year, so it is computed from Easter Sunday (Western date, anonymous Gregorian algorithm). Orthodox Easter is not used. |
| Midsummer | 15 to 24 June | Around the solstice (20 or 21 June) and the Eve of Saint John (23 June). |

Two tests guard the windows. Every bundle season is **covered** by an overlay, so a dressed page never loses its dressing partway
through a feast. And no two windows **overlap** (checked over five years, with Easter's window checked against all the others), so
there is never a question of which one wins.

Outside production `GET /api/holiday?force=<key>` treats that holiday as on, for development and browser tests. It is ignored in
production, so it can never switch a holiday on for players.

## Admin override

`users.holiday_override` holds a holiday key or null (Automatic). Only a user flagged `is_admin` may set it.

- `PATCH /api/account/holiday` with an `override` field returns **403 `admin_only`** for anyone else, and applies nothing from that
  request, switches included.
- `userView` returns the field **only for admins**. If an admin loses the flag, the stored value is neither returned nor honoured.
- The override picks *which* overlay is drawn. It does not bypass the player's own switches: "Show the overlay: off" still draws
  nothing, so an admin can always turn the overlay off for themselves.
- It is a preview tool. It is on the account, so it follows an admin to another device; set it back to Automatic to follow the
  calendar.

## How it is built

| Layer | File |
|---|---|
| Windows, Easter rule, settings parsing | `backend/src/lib/holidayOverlay.js` |
| `GET /api/holiday` | `backend/src/routes/holiday.js` |
| `PATCH /api/account/holiday` | `backend/src/routes/account.js` |
| Columns `holiday_overlay`, `holiday_motion` (default true), `holiday_override` | `backend/src/db/schema.sql` |
| State: calendar, override, the two switches, optimistic save | `frontend/src/features/holiday/useHoliday.js` |
| Scene to every `Plate` without prop-drilling | `features/holiday/holidayContext.js` |
| Names | `frontend/src/constants/holidays.js` |
| Art, one module per holiday, loaded on demand | `frontend/src/holidays/<key>.js`, `holidays/index.js` |
| Backdrop layer | `components/HolidayOverlay.jsx` |
| Plate dressing, foot scene | `components/HolidayDressing.jsx`, `components/HolidayFoot.jsx` |
| Rules every scene shares | `styles/parts/holiday-overlay.css` |
| One stylesheet per holiday | `styles/parts/holiday-<key>.css` |
| Settings section | `components/HolidaySettings.jsx`, `Switch.jsx` |
| Colours | `--holiday-*-rgb` wash tokens in `styles/tokens.css`, per scene |

CSS and inline SVG only, no image files. An art module default-exports `{ defs, backdrop, dressing, foot }`, static HTML strings
rendered with `dangerouslySetInnerHTML` (safe because they are literals in the repo, never player input). A holiday's module is
`import()`ed only when that holiday is showing, so none of it is in the bundle a player downloads to reach question one.

## The four tiers

Every holiday has the same four tiers, so a phone keeps the detail:

1. **Backdrop** (`.holiday`): one fixed layer at `z-index: -1`, `pointer-events: none`, `aria-hidden`. Dark washes at the top and
   bottom of the screen and the scene's sky or ground.
2. **Gutter drifters** (`.hol-gut`): small things that move in the 16px side strips beside the content.
3. **Plate dressing** (`.hol-pd`): props and fine line art on the plates themselves, drawn by `Plate` through
   `HolidayDressing`. Props sit on the plate's rim, line art is thin and low contrast, neither is over text.
4. **Foot scene** (`.hol-foot`): a scene in the page flow just above the colophon. It is full-bleed, so it takes real space and
   cannot cover anything. Hidden at 1280px and up, where the margin scene (`.hol-margin`) takes over in the empty space beside the
   page instead.

## The rules every scene follows

1. **Behind or beside, never over.** Nothing is drawn over a question, an answer, a button or the timer; the backdrop ignores the
   pointer; all of it is `display: none` in print.
2. **The quiz comes first.** While a question is on screen (`screen === 'question'`, or the guest preview) the shell carries
   `data-holiday-calm="on"`, which stops every holiday animation and removes the extras. The quiz is the only thing that moves.
3. **Reduced motion is honoured.** `prefers-reduced-motion` is treated exactly as "Animated background: off"
   (`data-holiday-motion="still"`), whatever the switch says. Travelling pieces are not drawn when still, because parked in
   mid-air they would look stuck.
4. **Scoped.** Calm and still rules reach only holiday elements (`:is(.holiday, .hol-pd, .hol-foot, .hol-gut)`), never every
   element in the app.
5. **Nothing flashes**, and every animation changes `transform` or `opacity` only. No scripts run per frame.
6. **No sideways scroll.** The foot is full-bleed with `margin-inline: -1.25rem` and `overflow-x: clip`, so a glow can never widen
   the page. `clip` is used because `clip-path` does not stop it.
7. **Pale floating pieces live in the margins only**, which exist at 1280px and up. Below that, light things are part of a plate or
   the foot, never behind the nav or text.
8. **Follows the binding.** The washes take a tint per scene, and Monochrome rebinds them to grey so that binding stays colourless.

## What the audits check, and what they cannot

`npm run audit:contrast` includes the lightest ground each overlay can put behind page-level text: the haze at the top (behind
the nav and first heading) and the mist and glow stack at the bottom (behind the page's closing text and the colophon, which has a
50% black scrim under it), for every scene in every house. The peak alphas per scene live in `HOLIDAY_LAYERS` in
`scripts/contrast-audit.mjs`; **change an alpha in a stylesheet and the matching entry there too.** It cannot measure a pale shape
such as a moon, which is why rule 7 exists as a layout rule and the e2e tests assert it.

`e2e/holiday-overlay.test.mjs` covers: on by default, each switch on its own, the choice surviving a reload (it is on the account),
every holiday at 390px and on desktop (plates dressed, foot fully on screen above the footer, no horizontal overflow, foot hidden
from 1280px), calm during a question, reduced motion, no overlay between holidays, and the admin override (set, persisted, absent
for a non-admin, gone after demotion). The existing layout, overflow and accessibility tests run with a holiday on whenever one is.

## Adding a holiday

1. Add `{ key, start, end }` (or `easter`-style rule) to `OVERLAYS` in `backend/src/lib/holidayOverlay.js`. Tests check it covers
   any bundle season it should and overlaps no other window.
2. Add `{ label }` to `frontend/src/constants/holidays.js`.
3. Add `holidays/<key>.js` with `{ defs, backdrop, dressing, foot }`, register it in `LOADERS` in `holidays/index.js`, add
   `styles/parts/holiday-<key>.css` and its `@import` in `styles/index.css`. Use the `hol-` generic class names for the four tiers.
4. Add wash tokens under `.app-shell[data-holiday='<key>']` in `tokens.css`, and a `HOLIDAY_LAYERS` entry in the contrast audit.
   Re-run `npm run audit:contrast`.
5. Add the holiday to the e2e list.

## Known limits

- A signed-out visitor cannot turn it off until they have an account.
- Easter is the Western date. Orthodox Easter and the Southern Hemisphere's seasons are not modelled; Midsummer is a fixed
  15–24 June window.
