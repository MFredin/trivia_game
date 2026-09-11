# Harry Potter Trivia — Design Brief v2
*Visual system, architecture, model allocation, and phased delivery plan*

## 0. Recap: Why This Exists
Existing HP trivia (listicles, Sporcle, official site, TriviaCube, TriwizardTrivia) is either single-session with no competitive layer, or blends books/movies into one undifferentiated pool. The whitespace: **canon-source as a real mechanic** (with dedicated books-vs-movies divergence questions), **two-axis difficulty** (obscurity + question trickiness), and a **proper competitive layer** (validated accounts, segmented leaderboards, daily challenge). Everything below is designed in service of that gap.

---

## 1. Visual Design System

### Direction: "The Restricted Section"
Not a theme-park pastiche of the films, and not the generic warm-cream/serif "AI-generated" default either. The concept: this looks like a rare, slightly dangerous reference archive — the kind of place a serious student goes to actually get quizzed, not a cheerful welcome-to-Hogwarts landing page. Confident, a little severe, built for people who take the trivia seriously.

**Avoid on purpose:** official wand-and-lightning-bolt iconography, house-crest-style shields, the broken-script "magical" font cliché, and (per house style) the current AI-design defaults — warm cream + terracotta backgrounds, SaaS rounded-card kits, tracked-out all-caps eyebrows, middle-dot metadata strings.

### Color
| Token | Hex | Role |
|---|---|---|
| `ink-900` | `#12151C` | Primary background — near-black with a cold blue cast, not pure black |
| `parchment-100` | `#EDE6D6` | Card/content surface — aged paper, used sparingly (not the whole page) |
| `brass-500` | `#B8923D` | Primary accent — muted brass/gold, correct-answer highlight, active states |
| `oxblood-600` | `#5C1A2B` | Secondary accent — wrong-answer state, danger, Survival-mode chrome |
| `verdigris-400` | `#4E8C7C` | Tertiary accent — success/streak states, rare use only |
| `ash-300` | `#8A8D96` | Muted text, borders, disabled states |

### Type
- **Display**: a sturdy old-style serif with real weight contrast (e.g. *Fraunces* or *Canela*-adjacent) — used only for the wordmark, category headers, and score reveals. It should feel carved/printed, not decorative-fantasy.
- **Body/UI**: a humanist sans (e.g. *Inter* or *Public Sans*) for questions, buttons, and leaderboard tables — legible under time pressure, since a chunk of this game is timed.
- Two families only. No third "accent" font for labels.

### Layout Concept
Question screens read like an index-card / catalog-drawer, not a chat bubble or a SaaS card stack:

```
┌─────────────────────────────────────┐
│  N.E.W.T · Spells & Magic            │  ← tag, not a decorative eyebrow —
│                                       │    it's real metadata (tier · category)
│  Which incantation was modified      │
│  after its original creator          │
│  discovered an unintended use?       │
│                                       │
│  [A] ...                             │
│  [B] ...                             │
│  [C] ...                             │
│  [D] ...                             │
├───────────────────────────────────── │
│  ⧗ 0:14          streak: 6           │
└─────────────────────────────────────┘
```
Left-aligned text throughout (serif display can break this rule for the score-reveal moment only). One deliberate motion moment: the answer-reveal flip/settle — not hover animations scattered across every element.

### Key Components to Design First
1. Question card (above) — the most-seen surface in the product.
2. Difficulty/canon-source tag system — small, precise, always visible (players should never be unsure what mode they're in).
3. Leaderboard table — dense, sortable, real data, not a padded card list.
4. Result/streak reveal — the one animated moment.

---

## 2. Systems & Architecture

| System | What it does | Key design decision |
|---|---|---|
| **Canon-Source Engine** | Filters/weights the question pool by Books / Movies / Combined | Combined mode isn't a simple union — it up-weights `divergence`-flagged questions so the hardest content surfaces more often |
| **Category & Difficulty Tagger** | Every question carries category, obscurity tier, design tier, canon tags | Obscurity and trickiness are stored as independent fields, not one blended "difficulty" number |
| **Question Bank & Content Pipeline** | Stores, versions, and serves questions; keeps answer keys server-side only | Client never receives the full answer set — only the current question's choices, to prevent devtools inspection |
| **Game Engine** | Runs the modes (Classic, Blitz, Survival, Daily Challenge) | Each mode is a scoring/timing config layered on the same question-serving core, not a separate codebase |
| **Scoring & Anti-Cheat** | Computes score server-side from server-held timestamps and answer keys | Client submits *answers*, never scores; server is the only source of truth for points |
| **Accounts & Auth** | Login, profile, stats history | Discord OAuth2 (reuse your Daybreak pattern) + email/password fallback |
| **Leaderboard Service** | Global / per-category / per-difficulty / per-canon-source / daily / friends | Precomputed and cached per segment — don't recompute rankings on every page load |
| **Content Ops Pipeline** | How new questions get written, fact-checked, and approved | See Section 3 — this is where AI models actually do the heavy lifting |

---

## 3. Model Allocation — Which Claude Model for What

The build has two very different kinds of AI-assisted work: **content production** (writing and fact-checking hundreds of trivia questions) and **software construction** (the actual app). They call for different models.

| Task | Recommended model | Why |
|---|---|---|
| Drafting the bulk question bank (first pass, high volume) | **Claude Sonnet 5** | Strong general knowledge and writing quality at a cost point that works for hundreds of questions; the safe default for most of this content work |
| Books-vs-movies divergence fact-checking (the highest-stakes content — these get disputed by sharp players) | **Claude Opus 5** | This is the one place where a wrong answer actively damages trust in the whole product; worth the heavier reasoning for nuanced canon cross-referencing |
| Bulk tagging/classification (assigning category, obscurity tier, canon tags to an existing question) | **Claude Haiku 4.5** | High-volume, low-ambiguity classification work — fast and cheap is the right trade here, not flagship reasoning |
| Generating distractor (wrong-answer) options at scale | **Claude Sonnet 5** | Needs to be plausible-but-wrong, which takes more judgment than pure classification but doesn't need Opus-level depth |
| App code (backend, frontend, Discord OAuth integration) via Claude Code | **Claude Sonnet 5** as daily driver | Matches your existing Daybreak workflow; reserve Opus for specific hard problems below |
| Gnarly architecture decisions (anti-cheat/score-validation design, leaderboard-caching strategy) | **Claude Opus 5** | Worth escalating specifically when a wrong design decision is expensive to unwind later |
| Evocative flavor copy (loading messages, empty states, Daily Challenge blurbs) — optional polish pass | **Claude Fable 5.1** | Marketed specifically for creative/narrative voice; only worth the premium for the small amount of copy where voice really matters, not bulk content |
| Phase 3: moderating user-submitted questions | **Claude Haiku 4.5** for first-pass filtering, escalate ambiguous cases to **Sonnet 5** | Classic cheap-filter-then-escalate pattern — don't run everything through a heavy model |

General principle: **Haiku for volume, Sonnet as the default workhorse, Opus reserved for the specific moments where being wrong is expensive.** Exact current pricing and context-window limits are worth double-checking against Anthropic's docs before you commit to a pipeline, since these numbers shift between model generations.

---

## 4. Phased Plan

### Phase 1 — MVP / Pilot
**Goal**: prove the core loop and the canon-source/difficulty mechanic are actually fun, with a small enough scope to ship fast and get real players on it.

- **Categories**: 3–4 to start (Characters, Spells & Magic, Plot & Events, Books vs. Movies) rather than the full 11 — enough to prove the mechanic without needing the full question bank up front.
- **Modes**: Classic Quiz + Daily Challenge only. Blitz and Survival wait for Phase 2 — they're scoring-config variants on the same engine, so they're cheap to add later but not needed to validate the core idea.
- **Difficulty**: all four tiers present, since two-axis difficulty *is* the differentiator being tested.
- **Accounts**: real accounts and persistent stats from day one (per your earlier call) — Discord OAuth + email fallback.
- **Leaderboards**: Global + Daily Challenge only. Per-category/per-difficulty/friends segmentation comes in Phase 2 once there's enough traffic to make segmented boards meaningful.
- **Question bank**: ~300–500 questions across the pilot categories, produced via the Sonnet-draft → Opus-fact-check-on-divergence → Haiku-tag pipeline, human-reviewed by you before launch.
- **Infra**: Node/Express + Postgres on Railway, React frontend, matches your existing stack — no need to over-build for scale yet.
- **Success criteria to define before launch**: e.g. daily active players, average session length, Daily Challenge completion rate, qualitative feedback on whether the difficulty actually feels "genuinely hard" to your target players (worth recruiting a handful of serious Potterheads to pilot-test specifically for this).

### Phase 2 — Full Launch
**Goal**: the complete vision from the original brief, built on validated learnings from the pilot.

- **Categories**: full set of 11.
- **Modes**: add Blitz, Survival; evaluate Head-to-Head based on pilot engagement data.
- **Leaderboards**: full segmentation (per-category, per-difficulty, per-canon-source, friends).
- **Question bank**: scale to a much larger pool per category/difficulty combination so repeat players don't exhaust content — this is where the content pipeline in Section 3 needs to run at real volume.
- **Content ops**: if question volume outpaces what you can personally review, introduce a lighter human-review sampling process rather than reviewing every single question.
- **Discord tie-in**: leaderboard commands / Daily Challenge pings via bot, natural fit given Daybreak infrastructure already existing.
- **Infra scaling**: revisit whether Postgres/Railway still fits at the traffic level the pilot revealed; add caching layer for leaderboard reads if not already in place.
- **Phase 3 candidates (beyond this brief's scope)**: user-submitted questions with moderation queue, achievements, seasonal events.

---

## 5. Open Risks to Track
- **Canon disputes**: books-vs-movies questions will get argued about by players no matter how careful the fact-checking is — plan for a lightweight "report a question" flow early rather than retrofitting one.
- **IP exposure**: original visual identity and factual (non-quoted) trivia content is the safe lane; avoid reproducing exact book/script text in questions or explanations, and avoid official logos/crests/fonts in the visual system.
- **Score integrity**: the anti-cheat design in Section 2 needs to be right before Phase 1 leaderboards go public — a leaderboard that's known to be gameable kills the competitive hook this whole product is built around.
