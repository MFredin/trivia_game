# Design & UX audit — September 2026

Requested as a follow-up to the stale stack-audit fixes: a full pass over the app's visual
design and UX, prompted by a specific report that the Friends screen's tabs are hard to read.
This is a findings-only document — nothing here has been fixed. Ordered roughly by impact.

## How this was done

Started the app against real seeded data, logged in, and screenshotted every major screen at
desktop width (1100px) plus a second pass of key screens at phone width (390px): auth, Start
(all 5 modes), Question, Result Reveal, Session Summary, Leaderboard (Classic/Duel/House Cup),
Friends (all 4 tabs), Achievements, Settings, Profile, Challenge create/view, Duel Lobby, and
Admin Question Review. Cross-checked every visual finding against the actual CSS/token
definitions in `styles/tokens.css` and `styles/global.css` rather than guessing from pixels
alone, so each finding below names the real rule and can be fixed at its root rather than
patched per-screen. Not sampled in this pass: Suggest Question, the guest Preview flow, and the
Marauder's Map easter egg modal — worth a quick look in a follow-up pass, but nothing in this
audit depends on them.

## Findings

### 1. `.nav-btn`'s default color only works on the dark page background — Confirmed, High

**This is the reported issue.** `--silver-400` (`#9aa1a8`) is documented in `tokens.css` as
deliberately fixed chrome for the *running header on the dark page* ("does NOT get rebound per
house — used only for the running-header/nav chrome"). But the `.nav-btn`/`.nav-links` pattern
built for that header got reused as a generic tab-row component in four other places —
`FriendsPanel` (Online Now / All Members / Search / Activity), `SessionSummary`, the top of
`LeaderboardScreen`, and `AdminSuggestionsScreen`. Two of those four render the tabs directly on
the dark page background, where silver-on-black reads fine (confirmed in the Leaderboard and
Admin screenshots). `FriendsPanel` is the one case that nests the tab row **inside a `<Plate>`**
— the light parchment surface — so the same `#9aa1a8` sits on `#ddc48a`-family cream, which is
badly under-contrast, exactly matching the screenshot that prompted this audit. Same failure
mode, still Plate-nested, on the "Activity" tab added in the last round of work.

**Root cause**: one CSS class silently serving two backgrounds with opposite contrast needs.
**Fix direction**: give `.nav-btn` an on-surface variant (ink-based color, the same way
`--text-muted-on-surface` already exists as the on-surface counterpart to the dark-page muted
tone) and apply it wherever a `.nav-links` row is nested inside a `<Plate>` — that's
`FriendsPanel` only today, but any future tab row inside a Plate should reach for the same
variant rather than rediscovering this bug.

### 2. House `brass` color applied directly on the dark page fails contrast for several houses — Confirmed, High

`ProfileScreen`'s title is styled `color: house.brass`, rendered directly on the page background
(outside any Plate). `brass` tokens are calibrated in `tokens.css` as accents for the *light
parchment surface* — text/borders/buttons drawn on `--surface`, not on `--ink-900`. Checked
against the actual near-black each house uses as its page background:
- Monochrome: `brass-500 #5a5a5a` on `ink-900 #161616` — roughly 3:1, below WCAG AA's 4.5:1 for
  body text.
- Ravenclaw (`#2a4a8a` navy on `#0a1330`) and Slytherin (`#2a623d` dark green on `#0a1a13`) are
  the same shape of problem — a mid-dark saturated color on a near-black ground of a similar
  darkness band.
- Gryffindor's `#ae0001` and Hufflepuff's `#ecb939` happen to read acceptably (Gryffindor is
  fairly saturated/light for its hue; Hufflepuff's gold is bright), which is likely why this
  wasn't caught earlier — it depends on which house happens to be active.

**Fix direction**: don't apply `brass` directly to text on the dark page. Either use
`--text-on-bg` (the token already defined for exactly this surface) with a smaller house-colored
accent element alongside it, or introduce a page-background-safe house accent tier the way
`--text-muted-on-surface` exists as the surface-safe counterpart to the page's muted tone.

### 3. Mobile `.screen-head` never stacks — Confirmed, High, mobile-only

`.screen-head` is a fixed `display: flex; justify-content: space-between; align-items:
baseline;` with no responsive rule to collapse it. At phone width (390px), that's fine when the
right-hand side is empty or a single button, but the Leaderboard's window/scope toggle (This
Week / All Time / Global / Friends — 4 buttons) wraps onto a second row and visually collides
with the "Leaderboard" title sitting to its left, confirmed in the mobile screenshot. Every other
screen with a `.screen-head` right-hand control (Profile's "Back", Challenge's "Not now") is
lower-risk since it's a single button, but all of them crowd the title at this width rather than
giving it room.

**Fix direction**: a `flex-direction: column` (or `flex-wrap` plus full-width children) rule for
`.screen-head` under a phone-width media query, matching the `@media (max-width: 720px)` block
that already exists for the book-spread layout.

### 4. Book-spread corner brackets don't reframe when the two-page layout collapses to one column — Confirmed, Medium, mobile-only

`Plate`'s two-page mode gives the **left** leaf its own top-left + bottom-left corner marks and
the **right** leaf its own top-right + bottom-right marks — correct for a side-by-side spread,
where together they read as one frame around the whole card. The existing `max-width: 720px`
rule collapses the grid to a single column and turns off the right leaf's binding-groove shadow,
but doesn't touch the corner marks — so once stacked, the top card keeps only its left-side
corners and the bottom card keeps only its right-side corners, instead of each stacked block
getting a full 4-corner frame (or none at all). Visible in the mobile Start-screen screenshot as
a stray bracket mark sitting alone near the middle seam.

**Fix direction**: under the same mobile breakpoint, either give both leaves all 4 corners
(matching the plain single-Plate look) or drop corner marks from the secondary leaf entirely,
since it reads as a distinct block once stacked rather than half of one frame.

### 5. NavBar's own links are uniformly dim, and the "Admin" row now has 7 items — Worth a look, Medium

The running header's `--silver-400` chrome is correctly contrasted against the dark page
(confirmed above), but it's a fairly *low* contrast dark-mode gray by design — comfortable for
decorative/secondary text, borderline for a primary navigation row a player uses every screen.
Worth reassessing now that Admin adds a 7th item for privileged accounts: is the whole row still
scannable at a glance, or does it read as one undifferentiated block of gray text broken up only
by the active-page underline?

### 6. Secondary buttons on a Plate blend into the parchment they sit on — Worth a look, Medium

`.secondary-button`'s fill (`rgba(255, 255, 255, 0.3)`) is close enough in tone to the Plate
surface it usually sits beside (e.g., "Cancel" on the Duel Lobby, "Not now" on Challenge) that
the button reads mainly via its border rather than looking clickable at a glance. Not a
readability failure — the label text itself has good contrast — but a hierarchy/affordance gap
worth a second look, especially since Phase 4/5 added several new secondary actions (challenge
link copy, "View my profile," "Try it now") that all share this styling.

### 7. Empty "Favorite category" reads as a glitch, not an empty state — Small

`ProfileScreen` shows a bare em dash (`—`) when a player has never played with a specific
category selected — technically correct (there's genuinely no data), but visually indistinguishable
from a rendering bug. A short phrase ("No category picked yet") would read as an intentional
empty state.

### 8. Known-good pattern worth extending, not duplicating — informational

`--text-muted-on-surface` already exists specifically because someone noticed the page's default
muted tone (tuned for the dark background) went low-contrast on the light parchment surface, and
built the AA-safe on-surface counterpart rather than patching each usage — it's applied
consistently across `.explanation`, achievement cards, leaderboard rows, and more. Findings #1
and #2 above are the exact same shape of bug (a color correct on one surface, wrong on the
other) that this pattern already solved once — the fix is to extend the same
on-bg/on-surface-pair convention to `.nav-btn` and to house `brass`, not to invent a new
approach.

### 9. Opacity-only "dim" states are a blunt instrument — Small, low priority

`.choice-button.is-muted` and `.achievement-card.is-locked` both dim via a flat `opacity: 0.55`
rather than a dedicated muted-state color. Fine today (both read acceptably in the screenshots),
but opacity dims *everything* in the element uniformly, including borders and icons — a real
color token would hold up better as more locked/disabled states get added, and would be easier
to keep AA-compliant on purpose rather than by accident of the underlying color's own contrast.

### 10. Local dev database has ~90 accumulated test accounts — Not a design finding, housekeeping

Visible in the "All Members" screenshot (usernames like `Ach1789167646159`) — residue from
Playwright/curl testing across many sessions. Doesn't affect production (separate database,
never touched), but worth a cleanup pass before using this environment for a demo, since it
currently makes the member directory and leaderboards look noisier than real usage would.

## Suggested order

1 and 2 together first — same root cause (a surface-specific color applied to the wrong
surface), same fix pattern, and #1 is the one a user has now reported twice. 3 and 4 together
next — both mobile-only layout bugs, worth a proper mobile pass rather than one-off patches
given the roadmap already flags "Mobile & accessibility pass" as upcoming work. 5–7 are smaller,
independent polish items that can land in any order or alongside other work. 8–9 aren't action
items on their own — they're the design rationale that should guide *how* 1–4 get fixed.
