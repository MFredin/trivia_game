# Design overhaul concept — "The Illuminated Archive" (Second Edition)

Status: concept, not yet approved. Companion design canvas: the "Restricted Section Overhaul"
artifact (ten artboards: Start, Question, Reveal and Monochrome Question on desktop; Start,
Question, Reveal, nav drawer and Monochrome Question on phone; System).

## Why an overhaul, and why now

The feature set is now genuinely differentiated (canon-source, two-axis difficulty, duels,
house cup, challenge links, activity feed). The visual layer is tasteful and consistent but
quiet: one parchment plate on a dark ground, hairline corner brackets, two Garamonds. It reads
as *correct* rather than *alive*. The goal of this overhaul is to make the app visually
memorable without touching the loop — the quiz stays the whole point, and nothing below adds a
step, a popup, or a mandatory interaction.

## The concept in one line

The app is a rare book. Each house is a different **binding** of the same book; Monochrome is
the unbound proof copy. The pages are an **illuminated archive**: rubricated (red) initials
and numerals, gold leaf for the moments that matter, gilt-tooled bookcloth, and a small original
**house device** drawn from the house's classical element rather than its animal.

That last choice is the IP line: elements (fire, earth, water, air) and bookbinding craft
are unownable visual language; lions, badgers, snakes, eagles, shields, wands and lightning
bolts are not ours to use. See "IP guardrails" below.

## What stays (deliberately)

- The house token rebinding in `tokens.css` (`--ink-*`, `--brass-*`, `--metal-*`). Every
  new element is built from those same channels, so Hufflepuff/Slytherin/Ravenclaw inherit
  the overhaul for free once Gryffindor is done.
- Silver nav chrome, kept separate from house colour (the existing rule).
- Parchment plates with corner brackets, the book-spread, the page-turn between questions.
- EB Garamond as the body/UI face.
- The "stay optional, stay light" principle from Phase 5.

## What changes

### 1. Atmosphere (the dark page)
- Page ground goes a step deeper (`#1A0607` for Gryffindor) so a house-coloured **glow** can
  sit on it: a warm ember radial top-left, a faint gold one bottom-right. Today's page is a
  flat radial of `--ink-800`; the glow is what makes the page feel lit rather than painted.
- A faint horizontal ruling texture at ~1% white over the page (paper-under-lamplight).
- **Embers**: 4–6 tiny slow-drifting motes in house gold, CSS-only, disabled under
  `prefers-reduced-motion`. They're the only ambient motion.

### 2. Rubrication (the red)
Medieval manuscripts used red ("rubrica") for the parts you navigate by: initials, headings,
numerals. Gryffindor's scarlet *is* rubrication — the house colour becomes the wayfinding
colour on the leaf:
- Rubricated **initial** on every question (the dropcap already exists as `.has-dropcap`;
  it gains a gilt hairline frame).
- **Roman numerals** for question position ("VII of X") and folio marks ("fol. 7").
- Small-caps rubric labels replace the current brass eyebrows on the leaf.
- Choice chips become rubricated letters ("A.") instead of boxed chips.
- For Monochrome, rubrication is plain ink — the structure holds with no colour at all.

### 3. Gold leaf (the moments that matter)
- **Primary button** becomes a gold-leaf stamp (gradient + inset highlight), used once per
  screen at most.
- **The seal**: the result reveal gets a stamped gold roundel with the house device in the
  centre and the app name around the ring. This is the single big animated moment (stamp,
  settle, embers rise). Everything else stays still.
- Gilt double rules (`3px double`) replace some single hairlines; rubricated double rules
  (2px + 1px) mark section breaks on the leaf.

### 4. Bookcloth and tooling
- House cloth (a darker brass, `--cloth`) with a linen weave, a faint gilt diaper lattice,
  and a tooled double frame with gold corner pieces. Pure CSS gradients — **no image files**
  (keeps the IP-audit "zero image files" property) — tinted from the cloth and metal tokens
  each house already binds. (An earlier draft used procedural marbling; it read as noise at
  small sizes and was dropped.)
- Where: the Start spread's left board (with a parchment "Ex Libris" card on top), a 30px
  spine strip with two gilt rules on the question spread, the profile's Ex Libris board, the
  Settings binding chips. Never behind text.

### 5. House devices (by element, not animal)
Original geometric marks in a bookplate roundel:
- **The Ember** — Gryffindor, fire.
- **The Furrow** — Hufflepuff, earth.
- **The Tide** — Slytherin, water.
- **The Gale** — Ravenclaw, air.
- **The Blind Stamp** — Monochrome, no element (embossed ring, no colour).
Used on: the nav wordmark (in silver), the Ex Libris card, the seal, book spines, streak pips.
They are the only "logo-like" element in the app and they belong to us.

### 6. Type
- **Display: IM Fell English** (Google Fonts) replaces Cormorant Garamond for titles, big
  numerals, initials, seals and spine labels. It's a digitisation of genuine 17th-century
  printing type — rough-edged, unmistakably *printed*, and not on any AI-default list.
  Cormorant is elegant but generic; Fell is what makes the page look like an old book.
- **Body/UI: EB Garamond** unchanged. Two families, as the original brief requires.
- Tabular numerals (`font-variant-numeric: tabular-nums`) everywhere digits are compared
  (timer, scores, ledger).

### 7. Components
| Screen | Today | Second Edition |
|---|---|---|
| Start | `<select>` for mode, description on the left leaf | Five **book spines** on a shelf (pull one down); left leaf becomes a tooled cloth board with an Ex Libris card; canon source as a segmented rubric control; difficulty as a ruled scale with a gold bead |
| Question | margin leaf with timer text and streak count | Cloth spine strip; roman-numeral position; a **ring dial** timer (gold ring, scarlet arc drains clockwise, time in the centre); streak as ember pips; rubricated initial; ledger-style choices with a gilt hover wash |
| Reveal / summary | plate with score and breakdown | The **seal**; giant rubricated numeral; O.W.L.-style verdict in italic; "folio by folio" ✓/✗ strip; achievements as small bookplates; "ledger movement" (21st → 14th) |
| Leaderboard | table | A **ledger**: ruled rows, rubricated rank numerals, house device beside each name |
| Profile | plate with stats | An **Ex Libris** card on a tooled cloth ground; achievements shelved as spines |
| Friends / Activity | tabbed plate | Unchanged structurally; picks up rubric labels, gilt rules, and the on-surface tab fix already shipped |
| Settings | house chips | Chips become small bound volumes (cloth + tooling + device) |
| Nav | silver running header | Unchanged, plus the house device (in silver) beside the wordmark |

### 8. Mobile
Mobile is not a cut-down version; it's the same bones re-stacked. Rules the phone boards
follow (Start, Question, Reveal, nav drawer, Monochrome Question at 390px):
- The two-leaf spread collapses to **one leaf with a 12px cloth top edge** carrying a single
  gilt rule — the binding survives as an edge, not a panel.
- The margin column becomes a **90px strip** under that edge: roman numeral left, a 60px dial
  with the time beside it centre, streak pips right.
- The Start screen's cloth board becomes a **112px tooled band** under the header carrying the
  Ex Libris card; the **spine shelf stays a single row** (five 50px spines fit in 358px).
- Choices are **52px-minimum ledger rows** (touch targets ≥44px). The Question screen fits in
  an 844px viewport *without scrolling* — the whole point of the quiz loop on a phone.
- The Reveal scrolls (it's a summary); the seal shrinks to 150px and still overlaps the
  plate's top edge; the ✓/✗ folio strip fits in one row of ten; actions stack, primary first.
- The running nav becomes a **right-hand drawer** (scrim + 300px sheet): device + binding
  name, six links at 48px, a small "Today" card (day streak, daily played or not), log out,
  Submit Feedback. Nothing new is added to the drawer that isn't already in the desktop nav.
- Nothing in the overhaul depends on hover; the embers and the draining dial respect
  `prefers-reduced-motion`.

## Monochrome rules
Same bones, no colour: rubrication → ink; gold leaf → blind stamp (embossed, grey);
cloth → charcoal with pale tooling; glow → neutral lamp; the device → an embossed ring. The
"two-tone structure" the current tokens file describes still holds, which is the proof that
the system is structural rather than decorative.

## IP guardrails (additions to `docs/ip-risk-notes.md`)
- No crests, shields, or house animals anywhere — devices are elemental and geometric.
- No wand, lightning bolt, spectacles, letter-with-wax-seal, or film-title lettering.
- The seal ring text is the app's own name, never a school or ministry name.
- No licensed typefaces; both faces are OFL via Google Fonts.
- Still zero image files in the repo: cloth, devices and ornaments are inline SVG/CSS.
- O.W.L.-grade verdict words ("Outstanding" etc.) are short phrases already used as trivia
  terms in the bank; keep them to the verdict line only.

## Token changes (additive)
```
--glow-warm / --glow-cool     per-house radial colours for the page atmosphere
--rubric                      = --brass-500 for houses; = --text-ink for monochrome
--leaf-hi / --leaf / --leaf-lo gold-leaf gradient stops (metal channel for houses)
--cloth                       spine colour (darker brass)
--tooling                     gilt rule colour on cloth (metal channel; pale grey for monochrome)
--font-display                'IM Fell English'
```
No schema or backend work; the overhaul is CSS, SVG and JSX only.

## Suggested phasing (each a PR, each shippable alone)
1. **A — Atmosphere + type + ornament.** Deeper page, glow, embers, IM Fell, rubric labels,
   double rules, corner buds, gold-leaf primary button. Site-wide lift, no layout change.
2. **B — Question spread.** Cloth spine strip, roman numerals, ring-dial timer, rubricated
   initial frame, ledger choices.
3. **C — Start room.** Spine shelf, tooled cloth board, Ex Libris card, segmented canon control.
4. **D — The seal.** Result reveal + share card refresh.
5. **E — Ledger, profile, settings, friends** polish pass.
6. **F — Other three houses.** Devices already drawn; mostly verifying contrast per binding.

## Decisions to make before Phase A
1. Display face: IM Fell English (recommended) or keep Cormorant Garamond.
2. ~~Candle timer~~ — replaced by the ring dial after review.
3. Widen the shell from 720px to ~1040px on desktop (the boards assume 1040).
4. Whether verdict lines use O.W.L. grade names or a neutral archive phrase.
