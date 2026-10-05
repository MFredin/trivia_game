# Screen sizes and browsers

The rule: **nothing scrolls sideways, on any screen, and nothing a person needs is out of reach.** This page says
what is checked, how, and what that does not prove.

## What is checked

`frontend/e2e/overflow-matrix.test.mjs` signs in as a moderator and walks the whole app (every screen, every tab and
section, the dialogs, a run's question and its reveal, and the logged-out pages) at eleven widths:
**320, 360, 375, 390, 412, 430, 600, 768, 1024, 1280 and 1920 px**. The content is the worst that can exist:
40-character names with no break in them (`WWWW…`, the widest letter), 140-character bios, 476-character unbroken
message bodies and report notes, an Owl Post thread of 30 messages.

At each stop it asserts:

| Check | Why |
|---|---|
| The page never scrolls sideways (`scrollWidth` against the screen's width) | The basic rule. Measured against the real width, not `clientWidth`: a phone widens its layout viewport to fit what overflows, which would hide the problem. |
| Text itself is measured, not just boxes | An unbroken string can spill out of a box that fits; no element is "too wide". |
| On a phone, no text field is under 16px | iOS Safari zooms the page in when a smaller field takes focus, and does not zoom back. It looks exactly like an overflow. |
| A dialog is fully on screen, or scrolls inside itself, and its top is reachable | A dialog taller than the screen must not lose its top edge. |
| Escape closes every dialog | The keyboard's way out. |

Also: **200% text size** at 390 and 1280 px (WCAG reflow), a **phone on its side** (667×375: dialogs, and the Owl Post
composer reachable), and the logged-out pages at 320 / 390 / 1280.

Phone widths (500 px and under) are run in Chromium with the iPhone 13 profile applied (touch, pixel ratio, mobile
viewport handling, user agent), so `isMobile` behaviour such as shrink-to-fit is real.

Run it against a running app and database:

```
DATABASE_URL=… E2E_BASE_URL=http://localhost:5175 node --test e2e/overflow-matrix.test.mjs
WIDTHS=320,390 …   # a subset, while working on one screen
```

`popover.test.mjs` opens the account menu at 320–412 px with text at 100–150% (what Android's font-size setting does),
because the sweep above never opened a menu and missed one that ran off the left edge of 320 and 360 px phones: the
header wraps, the avatar lands at the left of its row, and a menu anchored to the avatar's right edge opened
leftwards off the screen. Every `PopoverMenu` now slides itself back inside the screen after it opens.

`layout.test.mjs` (the Gauntlet header regression) and `a11y.test.mjs` (44px touch targets, accessible names) stay as
they are.

## Rules the CSS follows because of this

- Anything that shows another person's text (names, bios, messages, notes) is allowed to break anywhere
  (`overflow-wrap: anywhere`), **not** `break-word`: only `anywhere` lets the text shrink inside a flex row.
  A flex or grid child that holds such text also needs `min-width: 0`. See `.screen-head > *`, `.member-name`.
- A table that might not fit scrolls inside `TableScroll`, not the page.
- Dialogs are `width: min(100%, 440px)`, centred with `margin: auto`, and the overlay scrolls.
- Form fields are never under 16px (one rule in `a11y.css`).
- `100dvh` (with `100vh` before it) where a height follows the screen: a phone's address bar moves, `vh` ignores it.
- The Owl Post thread sizes itself to the room left on the screen (`useFillViewport`) and follows `visualViewport`, so
  the composer stays above a phone's keyboard.

A lesson from that miss: a sweep that only *looks* at screens does not find what only appears when something is
*opened* (a menu, a dialog, a popover). When a new kind of floating element is added, add it to a test that opens it.

## What this does not prove

- **WebKit.** Every automated check runs in Chromium. Playwright can run WebKit, but this project's CI installs
  Chromium only, and WebKit on Linux is still not iOS Safari (no dynamic toolbar, no real keyboard, different font
  rendering). The emulation reproduces iOS's *rules* (16px zoom, shrink-to-fit, viewport units), not the engine.
- **Real devices.** Notches and the home-indicator safe area, the keyboard pushing the page, address-bar collapse and
  pinch-zoom are not exercised. The page does not use `viewport-fit=cover`, so the browser keeps content out of the
  notch on its own.
- **Browsers other than Chromium-based ones** (Firefox, Samsung Internet) for rendering differences.
- Anything not on a screen the test can reach: the "suggest a question" screen sits behind the Marauder's Map
  easter egg and is not in the sweep.

A pass on a real iPhone (Safari) and a real Android phone (Chrome) before a release is still worth ten minutes: open
Home, a long Owl Post thread, Edit Profile, and a dialog, in both orientations.
