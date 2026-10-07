# Contrast audit — Second Edition, all five bindings (2026-09)

Run it yourself: `cd frontend && npm run audit:contrast` (exits non-zero on any failure).

## Why this audit exists

The Second Edition design system binds one set of *role* tokens per house — `--rubric`,
`--cloth`, `--tooling`, `--leaf-*`, `--onbg`, `--gilt` — and every component derives its
colours from those roles rather than naming a house. That is what let Phases B–E ship five
bindings for the price of one. It is also the exact thing that makes contrast bugs easy to
miss: the *same* CSS rule resolves to a different colour pair in each binding, so a
component that reads perfectly in Gryffindor can be unreadable in Hufflepuff.

Eyeballing screenshots caught one of these (Hufflepuff's spine labels, during Phase C).
Computing the ratios caught **eleven more** that five rounds of visual QA had missed.

## Method

`frontend/scripts/contrast-audit.mjs` parses `src/styles/tokens.css` and
`src/constants/houses.js`, resolves every role token per binding (following `var()`
indirection), composites any alpha layers onto their real backdrop, and computes WCAG 2.1
relative-luminance contrast ratios for each pairing the app actually renders — 210 gated
pairings across the five bindings.

Thresholds: **4.5:1** normal text, **3:1** large text (≥24px, or ≥18.66px bold) and
graphics that carry meaning.

## Result

**210 gated pairings pass, 0 fail.**

## What the audit found and what changed

| # | Pairing | Was | Now | Fix |
|---|---|---|---|---|
| 1 | Hufflepuff house name + device on parchment (House Cup, Profile) | **1.25:1** | 9.14:1 | New `ink` field on `HOUSES` — the data-side twin of `--rubric`. Hufflepuff's `brass` is gold, fine as a *fill*, invisible as *text*. |
| 2 | Seal ring text on the gold leaf — **all five bindings** | 1.43–3.47:1 | 6.09–11.62:1 | Was `--leaf-edge` (the seal's own border tone). Now `--leaf-text`, the role already calibrated to read on leaf. |
| 3 | Hufflepuff Ex Libris footer on cloth | **2.51:1** | 4.92:1 | Cream on light mustard. Now `--tooling`, like everything else printed on cloth. |
| 4 | Resting spine labels on cloth — four of five | 2.91–4.44:1 | 4.92–11.50:1 | The label carried `rgba(--tooling, .72)`; the fade cost ~2 points of contrast. Now full strength; resting vs hover is told apart by the lift and a brightness step instead of opacity. |
| 5 | Active spine label on the rubric fill | 2.86–4.13:1 | 4.98–13.29:1 | Was `--onbg` (calibrated for the dark *page*, not the rubric fill). Now `--parchment-100`, matching `.seg.is-active`. |
| 6 | Hufflepuff tooling on its own cloth | 4.29:1 | 4.92:1 | `--tooling` darkened `#2a221d` → `#1c1613`. Hufflepuff is the one house with a *light* cloth, so everything on it needs a near-black. |
| 7 | Ravenclaw tooling on its own cloth | 4.36:1 | 5.95:1 | `--tooling` brightened `#b98d52` → `#d2a86a`. Same rule as #6, opposite direction. |
| 8 | Ravenclaw button label at the gradient foot | 3.83:1 | 5.08:1 | `--leaf-lo` `#946b2d` → `#ab7f3e`. The label cleared AA against the middle of the gradient but not its foot. |
| 9 | Ledger rank numerals on parchment — all five | 3.65:1 | 4.89:1 | A bare `rgba(18,21,28,.55)`; now the established `--text-muted-on-surface`. |
| 10 | Folio ✓ marks on parchment — four of five | **2.71:1** | 5.89:1 | New `--success-ink` (`#2a5449`): the on-parchment twin of `--verdigris-400`, which is calibrated as a *fill* and too light as a mark. The ✓/✗ strip is the run's per-question record, so it is a meaningful graphic. |
| 11 | Correct-answer letter and tick on their tint | 4.41:1 | 5.09:1 | Same `--success-ink`. |

Items 9–11 predate this overhaul; the audit simply reached them for the first time.

## Deliberate exemptions

Four ornament pairings sit below 3:1 in some bindings and are **left alone**, listed by the
script under "tracked but not gated":

| Ornament | Range | Why exempt |
|---|---|---|
| Dial bezel ring | 1.57–9.14:1 | The timer's *information* is its scarlet arc (passes everywhere) and its centre numeral (passes). The bezel is a decorative gold hairline. |
| Plate corner brackets | 1.57–9.14:1 | Pure ornament; no information depends on them. |
| Gilt double rule | 2.94–10.78:1 | A decorative section rule. |
| Rubric double rule | 4.98–13.29:1 | Passes anyway; listed for completeness. |

WCAG 1.4.11 applies to UI boundaries needed to *identify a control* and to graphics needed
to *understand content*. These are neither. Forcing a gilt hairline to 3:1 would mean
darkening `--gilt` until it stopped reading as gold leaf — destroying the one thing it is
there to do, to satisfy a rule that does not apply to it.

## The rule this leaves behind

When adding anything that puts a colour on a colour, pick the token by **what it sits on**,
not by which house it belongs to:

| Sitting on… | Use | Never |
|---|---|---|
| Parchment (plates, cards, leaves) | `--rubric`, `--text-ink`, `--text-muted-on-surface`, `--success-ink` | `--onbg`, `--tooling`, a raw house `brass` |
| The dark page | `--onbg`, `--text-on-bg`, the silver chrome | `--rubric` |
| Cloth (spines, boards, spine strips) | `--tooling` | `--onbg`, `--rubric` |
| The rubric fill | `--parchment-100` | `--onbg` |
| The gold leaf | `--leaf-text` | `--leaf-edge` |
| Another player's house, on parchment | `house.ink` | `house.brass` |

Then run `npm run audit:contrast` before you push.
