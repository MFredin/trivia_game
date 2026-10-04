# Question bank audit — October 2026

A quality pass over `backend/src/data/question-bank-full-draft.json` (2,927 questions, the
Phase 1–3 draft bank, not yet the live `SEED_FILE`) before any of it goes live. Looked for
duplicate questions, the correct answer leaking into its own distractor list, malformed rows,
and — using HP book/film knowledge directly, since nothing mechanical can check this —
questions whose stated correct answer is wrong or genuinely ambiguous.

## How this was done

A standalone script, `backend/scripts/question-bank-audit.mjs`, reads the JSON once and checks
every one of the 2,927 rows for: duplicate `id`s; exact-duplicate `question_text` anywhere in
the bank (normalized — lowercased, all punctuation stripped, whitespace collapsed — so this
catches duplicates across categories and across differences in casing/punctuation, not only
byte-identical strings); `correct_answer` reappearing among that question's own `distractors`
(same normalization); and malformed shape (missing/empty required field, `distractors.length
!== 3`, duplicate distractors within one question, `obscurity_tier`/`design_tier`/`canon_tags`
values outside the enums the app actually uses). It is non-destructive — a report, not an
editor — and is kept in `backend/scripts/` as `npm run audit:questions` for reuse as later
phases add more questions.

A second, throwaway pass (not kept) tried fuzzy/near-duplicate detection (Jaccard similarity on
content words, Levenshtein distance between `correct_answer` and each distractor) to catch
typo'd near-matches the exact check would miss. On this bank it produced nothing but false
positives — the bank's own templated question families ("which house's mascot is X," "who
teaches DADA in year N," the per-dragon Triwizard questions) are genuinely similar text with
genuinely different correct answers, which is good design, not a duplicate bug. That script was
discarded rather than shipped as a check nobody should trust; **Sections 1–3 below are all
from the exact/mechanical checks only.**

For the judgment-call category (factual correctness / ambiguity, Section 4), no script can do
this. The approach: extracted every question whose text contains a number, a year, or a
superlative ("first," "only," "youngest," "how many," …) — 285 of the 2,927 — as the highest-risk
subset for AI-drafted factual slips, and checked each against canon. Separately, grepped the
whole bank for every other question asking about the same fact (e.g. every question anywhere
that touches "Percy Weasley" + "job"/"Ministry") to catch the bank contradicting itself, which
is a much stronger signal than my own memory of the books alone. This is not a claim that every
one of the 2,927 questions was individually fact-checked — at this volume that's not a one-pass
job — but every number/superlative question was, and the cross-reference method surfaced two
confirmed, book-contradicted errors that a pure memory-based skim would likely have missed.

## Summary

| # | Check | Found | Fixed directly | Flagged for human review |
|---|---|---|---|---|
| 1 | Exact/near-identical duplicate questions | 0 | — | — |
| 2 | Correct answer also listed as its own distractor | 0 | — | — |
| 3 | Malformed entries (missing fields, wrong distractor count, duplicate distractors, invalid tier/tag enum) | 0 | — | — |
| 4 | Factual-correctness / ambiguity concerns (judgment call, not auto-fixed) | 3 | 0 (by design — see "What to actually change") | 3 |

**No edits were made to `question-bank-full-draft.json`.** Categories 1–3 are the ones this
audit was authorized to fix mechanically, and all three came back clean on this bank — there is
nothing there to fix. Category 4 is explicitly "report, don't fix," so those three findings are
below for a human (likely whoever clears `needs_factcheck`) to resolve.

Also checked and clean, as a side effect of the above: no duplicate `id`s (2,927 unique ids);
every row has exactly 3 distractors, no row has a distractor duplicated within itself; every
`obscurity_tier` and `design_tier` value is one of the four the app recognizes
(`backend/src/lib/difficultyTiers.js`, `backend/src/lib/designTiers.js`); every `canon_tags`
value is one of `book`/`movie`/`both`, which is what `backend/src/lib/featuredChallenge.js`
actually checks for (distinct from the narrower `['book', 'movie']` the player-facing
suggestion form restricts *new* submissions to in `backend/src/routes/suggestions.js` — that's
an input-validation rule for drafts, not the shape of the existing bank, so `['both']` rows
are not a bug). `1,101` rows (37.6%) are `needs_factcheck: true` and `451` (15.4%) are
`divergence: true`; both are pre-existing self-flags from the AI-drafting note at the top of
the file, not new findings of this audit.

No question was deleted or had its `id` changed, so the "does removing a question break
anything" question (the `questions.id` foreign keys from `suggested_questions.approved_question_id`
and `session_questions.question_id` in `backend/src/db/schema.sql`) didn't come up — moot,
since there were no exact duplicates to remove.

## 1–3. Mechanical checks: clean

Ran via `node backend/scripts/question-bank-audit.mjs` (or `npm run audit:questions` from
`backend/`):

```
Question bank audit — backend/src/data/question-bank-full-draft.json
Total questions: 2927
Duplicate ids: 0
Exact duplicate question_text groups: 0 (questions involved: 0)
Correct-answer-as-own-distractor: 0
Malformed entries: 0
```

Worth calling out explicitly, since it's easy to assume a 2,927-row AI-drafted file has these
bugs by default: this bank does not. No two questions share normalized text (even across
categories — e.g. the "Books vs. Movies" category, which restates facts already asked about
directly elsewhere, never restates them verbatim), no `correct_answer` shows up in its own
`distractors` list (checked exact-match and, separately, substring containment both ways — the
13 substring hits that check turned up, e.g. `SPL-005`'s answer "Lumos" against its distractor
"Lumos Maxima", are all genuinely different spells/answers used as deliberately close-sounding
wrong choices, not the same answer twice), and the schema shape is fully consistent across all
2,927 rows.

## 4. Factual-correctness and ambiguity concerns — flagged for human review

These are not auto-fixed, per the audit brief: resolving them is a domain-knowledge judgment
call, not a mechanical edit.

### 4.1 `CHR-033` — Percy Weasley's first Ministry job contradicts the rest of the bank — High confidence

**Question:** "What is Percy Weasley's job when he first starts working at the Ministry of
Magic?"
**Stated correct answer:** "Junior Assistant to Cornelius Fudge"
**Distractors:** Head of the Auror Office / Assistant to Albus Dumbledore / Undersecretary to
the Minister

Canon (confirmed in *Chamber of Secrets* and *Goblet of Fire*) has Percy's first Ministry job as
a junior position in the Department of International Magical Cooperation, working under Mr.
Crouch — not a personal assistant to Fudge. "Junior Assistant to the Minister" is Percy's title
starting in *Order of the Phoenix*, years later, not his first job.

This isn't just my own recollection against the book — **four other questions already in this
same bank give the correct version and contradict `CHR-033` directly**:

- `LOC-208`: "In which Ministry department does Percy Weasley take his first job after leaving
  Hogwarts?" → "The Department of International Magical Cooperation"
- `HIS-097`: "What Ministry position does Percy Weasley take shortly after leaving Hogwarts,
  working under Barty Crouch Sr.?" → "Junior assistant in the Department of International
  Magical Cooperation"
- `DIV-089`: "In the book, what Ministry position does Percy Weasley proudly hold under Mr.
  Crouch during Goblet of Fire?" → "Junior assistant to Barty Crouch Sr., in the Department of
  International Magical Cooperation"
- `HIS-196`: "...which official was he junior assistant to, before that official died partway
  through Goblet of Fire?" → "Barty Crouch Sr."

`CHR-033` is the one outlier among five questions on the same fact, and its own distractor list
includes "Undersecretary to the Minister" (Dolores Umbridge's actual OOTP title) as a wrong
answer, which makes the confusion look like two different real Percy/Ministry-related titles
got conflated into one question. Recommend either correcting `CHR-033`'s `correct_answer` to
match the other four, or removing it as redundant with `LOC-208`/`HIS-097`.

### 4.2 `CHR-146` — Percy's Head Boy year is off by one — High confidence

**Question:** "In which of Harry's school years does Percy Weasley become Head Boy?"
**Stated correct answer:** "Harry's third year"

Canon: Percy becomes Head Boy at the start of *Chamber of Secrets* — Harry's **second** year
(Mrs. Weasley's letter in the opening chapter mentions it directly). This also doesn't square
with this bank's own `CHR-087` ("What special position does Percy Weasley already hold when
Harry begins his first year?" → "Prefect"): Percy holds Prefect, not yet Head Boy, during
Harry's first year, and prefects are named in fifth year and typically hold the title through
graduation — consistent with Head Boy starting the very next year (Harry's second), not the
third. Recommend changing the answer to "Harry's second year."

### 4.3 `SPL-141` — Correct answer doesn't actually answer the question asked — High confidence, different kind of issue

**Question:** "Which curse causes a target's underpants or clothing to shrink uncomfortably,
used humorously among students rather than in serious combat?"
**Stated correct answer:** "The Knickerbocker Glory Jinx is not real; students commonly use
minor jinxes like the Jelly-Legs Jinx for pranks"
**Distractors:** The Jelly-Legs Jinx / Furnunculus / Densaugeo
**Explanation field:** "The Jelly-Legs Jinx makes a target's legs go weak and wobbly, a common
minor jinx among students rather than a serious curse."

This one isn't a "which choice is right" ambiguity — the stated correct answer doesn't name any
curse that shrinks clothing at all, debunking a "Knickerbocker Glory Jinx" that the question
never mentioned in the first place, and the bank's own `explanation` field for this exact row
describes what the Jelly-Legs Jinx actually does (weakens legs — nothing to do with clothing)
rather than explaining the stated answer. Contrast with the bank's other "trick premise"
questions (`SPL-211`, `POT-209`, `POT-251`, `SPL-227`), which are genuinely well-formed: each of
those is phrased as "is X true / does Y exist," and its answer directly debunks that exact
premise. `SPL-141` is phrased as a direct "which curse" question with no trick premise in the
question text itself, so its answer reads as a non-sequitur. This row is already
`needs_factcheck: true`; flagging here that it needs more than a fact-check — it needs a human
to decide what the real answer should be (there's no obvious canon curse that shrinks clothing
to point to instead) or whether to cut the question and its three otherwise-reasonable
distractors.

### Noted but not flagged: lower-confidence items checked and found acceptable

A few items looked suspicious on first read but held up on closer inspection, worth recording so
the same ground isn't re-covered:

- `QDT-120`/`QDT-036` ("Terence Higgs... pushed aside thanks to Lucius Malfoy's donations") —
  checked against *Philosopher's Stone* (Higgs is named as Slytherin's returning Seeker in
  Harry's first year) and *Chamber of Secrets* (Malfoy displaces him via his father's broom
  bribe the following year). The framing holds up; not flagged.
- `SPL-223` ("Luna Lovegood... produces a fully corporeal Patronus on her very first attempt") —
  Luna's Patronus being a hare is confirmed canon (also asked correctly elsewhere in this bank,
  `CHR-248`), but "on her very first attempt" is a specific claim I could not independently
  verify as stated in the books. Low enough confidence that I'm noting it rather than flagging
  it as a finding — worth a second look if whoever clears `needs_factcheck` has the text handy.

## Validation performed

- `node -e "JSON.parse(require('fs').readFileSync('backend/src/data/question-bank-full-draft.json'))"`
  — parses cleanly (file is unmodified by this audit, so this just confirms it was never
  touched incorrectly during review).
- Seeded a scratch database (`trivia_game_qbank`, independent of the shared `trivia_game` DB
  other work may be using) via `SEED_FILE=question-bank-full-draft.json npm run db:seed` against
  `backend/src/db/schema.sql` — all 2,927 rows inserted without error.
- `GET /api/categories` against that scratch DB returns all 11 categories.
- `POST /api/preview/start` returns a real question with exactly 4 choices (1 correct + 3
  distractors, matching `QuestionCard.jsx`'s `LETTERS = ['A','B','C','D']`) and no
  `correct_answer` field in the payload — the anti-cheat token flow works against the full
  draft bank the same as it does against the starter file.
- `npm test` in `backend/`: 30/30 passing (this suite doesn't touch the seeded DB, so it's
  unaffected by which file is seeded).
