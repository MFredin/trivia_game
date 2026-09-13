# IP risk notes

Not legal advice — a practical, engineering-level read of what's actually in this repo,
done because Warner Bros / Pottermore own the Harry Potter IP and this project uses it
without a license. Revisit this file (and get an actual lawyer's opinion) before ever
monetizing, before any large PR push, or if anyone at WB/Pottermore reaches out.

## What was actually checked (2026-09)

- **Full question bank (2,927 questions)**: scanned for quoted spans of 25+ characters in
  `question_text`, `explanation`, and `correct_answer`. Every hit was a short, unprotectable
  phrase — a spell incantation ("I solemnly swear that I am up to no good"), an epitaph, a
  book title, a riddle answer, a Ministry decree name. No paragraph- or page-length excerpts
  of Rowling's prose or the films' scripts anywhere. Facts and plot events aren't
  copyrightable, only the specific expression is — this bank describes events in original
  language rather than reproducing text.
- **Visual assets**: zero image files in the repo (`find . -iname '*.png' -o -iname '*.jpg' -o
  -iname '*.svg'` returns nothing). No house crests, no wand/lightning-bolt iconography, no
  official fonts — the whole book/library visual identity (parchment plates, corner brackets,
  house color tokens, Google-licensed type) is original, matching the design brief's explicit
  instruction to avoid "official wand-and-lightning-bolt iconography, house-crest-style
  shields... official logos/crests/fonts."
- **Branding/naming**: package names are neutral (`trivia-game-backend/frontend`), the git repo
  is `trivia_game`, and no UI text or docs claim official status, licensing, or WB/Pottermore
  affiliation (`grep`'d for "official", "licensed by", "endorsed", "affiliated" — every hit was
  an in-universe usage like "Ministry official," not a real-world claim).

## Where the exposure actually is

1. **Trademarked terms used throughout** (Hogwarts, house names, Quidditch, spell names).
   This is unavoidable for a trivia app about the subject — it's the same nominative use every
   pub quiz, Sporcle quiz, and fan trivia night makes. Low enforcement risk at hobby scale.
2. **No non-affiliation disclaimer anywhere in the app.** Cheap to add, meaningfully reduces
   both actual confusion risk and how an IP holder is likely to react if they ever notice the
   project — "unofficial fan project, not affiliated with or endorsed by Warner Bros." is
   standard practice across the fan-content space.
3. **Monetization is the single biggest lever.** Everything above assumes this stays a free,
   ad-free hobby project. Ads, paid tiers, or merchandise would meaningfully change the risk
   calculus — WB has sent cease-and-desists to fan projects specifically once they started
   generating revenue or drawing a large audience. If that ever becomes the plan, get an actual
   IP attorney's opinion first.

## Standing guardrails (keep doing these)

- Describe events in original language; never reproduce book/script prose beyond an
  unavoidable short phrase (a spell, a title, a motto).
- No official artwork, crests, logos, or licensed WB fonts — CSS/typography only.
- No claim of official status, license, or WB/Pottermore endorsement anywhere in the app.
- Keep it free. Revisit this file the moment that changes.
