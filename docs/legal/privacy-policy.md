# Privacy Policy — DRAFT

> **⚠️ THIS IS A DRAFT, NOT A LEGAL DOCUMENT. DO NOT PUBLISH OR LINK FROM THE LIVE APP YET.**
>
> This document was drafted by an AI coding assistant (Claude) as a starting point, at the
> request of the project's non-lawyer founder, by reading this app's actual database schema
> and source code — not from a generic template. **It is not legal advice, and no attorney has
> reviewed it.** It must be reviewed, corrected, and approved by a licensed attorney in the
> operator's jurisdiction before it is relied upon, published, or linked from the live
> application. Several sections below are explicitly flagged as placeholders, open questions,
> or gaps in what the app can currently actually do — see the "Flagged for attorney review /
> product gaps" list at the end of this document before doing anything else with it.

**Last updated:** DRAFT — not yet published. Date to be set upon attorney review and launch.

---

## 1. Who this covers

This Privacy Policy describes how The Restricted Section ("the Service," "we," "us") handles
personal data for players who use the Service. The Service is, as disclosed in the app
itself, an unofficial Harry Potter fan trivia project, not affiliated with Warner Bros.,
Pottermore, or J.K. Rowling.

## 2. What we actually collect

This section is written directly from the application's database schema and source code, not
from a generic list of "things apps usually collect." If you add a field to the `users` table
or a new data-collecting feature, this section needs to be updated to match.

**Account information** (`users` table):
- **Username** — public, shown on leaderboards, to friends, and in duels.
- **Email address** — used to log in and (if we ever add it) to contact you about your
  account. Not shown to other players.
- **Password** — we never store your actual password. We store a one-way hash: your password
  is run through Node's `scrypt` key-derivation function with a unique random salt per
  account, and only that salt+hash is stored (`backend/src/lib/passwords.js`). We cannot look
  up or recover your plaintext password, and comparing a login attempt is done by re-hashing
  and comparing, not by decrypting anything.
- **Chosen house theme** — a cosmetic color-theme preference (e.g. a house binding, or the
  default "monochrome"), stored against your account so it follows you across devices.
- **Admin flag** — whether your account has moderator/admin rights to review submitted
  questions. Only applies to a small number of accounts we grant this to directly.
- **Invite code** — a code tied to your account that lets you invite other players; when
  someone signs up through it, we record a friendship between you and them.
- **Account creation timestamp.**

**Gameplay data** (`game_sessions` and `session_questions` tables): every quiz run you play —
mode (Classic, Daily Challenge, Blitz, Survival, Gauntlet, Live Duel, shared Challenge),
category and difficulty filters chosen, score, streak, which lifelines were used, and,
per question, which answer you picked, whether it was correct, whether you timed out, and how
long you took to answer. This is what lets us compute your score server-side (see our
[anti-cheat architecture](../anti-cheat-architecture.md)) and show you your own history and
personal bests.

**Friends and social data** (`friendships`, `duels`, `challenges` tables): who you've sent or
accepted friend requests with, head-to-head duel matchups and their results, and any
player-created challenge codes you've made or joined.

**Activity feed** (`activity_events` table): small events tied to your account, such as
beating a personal best, that are shown only to your friends on a "Friends" activity tab — we
never push these as notifications.

**Achievements** (`user_achievements` table): which in-game achievements your account has
unlocked, and when.

**Suggested questions** (`suggested_questions` table): if you use the question-suggestion
feature, we store the question text, answer, and distractors you wrote, tied to your account,
plus the review status and any admin review note once it's been looked at.

**Feedback submissions**: if you use the in-app "Submit Feedback" button, we send your message,
chosen category, the page you were on, and — if you were logged in — your username, to our
issue tracker. Feedback can also be submitted without an account.

**What we do *not* store in our database:** We do not store your IP address. Our server uses
your IP address only transiently, in memory, to rate-limit login, registration, and feedback
requests against abuse (e.g., capping repeated attempts in a 15-minute window); that in-memory
counter is never written to the database and is discarded on its own after a short window or
on server restart. We do not collect your real name, physical address, phone number, payment
information, or precise location. We do not use any third-party analytics or advertising
trackers. 🚩 *If this changes — for example, if a future anti-cheat or anomaly-detection
feature starts persisting IP addresses or device fingerprints to the database — this section
must be rewritten to say so before that feature ships, not after.*

## 3. Why we collect it

- **Account info** — to let you log in, identify you to other players by username, and
  (email) to secure and recover your account.
- **Gameplay and session data** — to run the game itself (server-authoritative scoring is a
  deliberate anti-cheat measure, not incidental data collection), to show you your own stats
  and history, and to power leaderboards, duels, and shared challenges.
- **Friends and activity data** — to provide the friends, duel, and activity-feed features you
  opt into by sending or accepting a friend request.
- **Suggested questions** — to run the player-question-submission and admin-review feature.
- **Feedback** — to receive and act on bug reports and ideas.

We do not sell your personal data to third parties, and we do not share it with third parties
for their own advertising or marketing purposes.

## 4. Where data goes outside our database

- **Feedback submissions** are sent to a GitHub repository's issue tracker via the GitHub API,
  so GitHub stores that content (your message, category, page, and username if logged in) as
  well as we do.
- We do not otherwise share personal data with third-party services. We do not use third-party
  analytics, ad networks, or tracking pixels.

## 5. What's stored on your device (cookies / local storage)

We checked the actual frontend code for this rather than describing a generic cookie policy.
As of this writing, the app stores exactly one thing in your browser's `localStorage`: your
**login session token**, under the key `trivia_auth_token`. This is what keeps you logged in
between visits; it is removed from your browser when you log out or when the server tells the
app your session is invalid. We do not use advertising or analytics cookies. We do not store
your theme/house preference in browser storage — that preference is saved to your account on
our server instead, which is why it follows you if you log in on a different device.

## 6. Children's privacy

🚩 *[See flagged item below.]* This Service is themed around a popular book/film franchise
and, realistically, may attract players under the age of 13. We have not implemented, and this
draft does not claim, specific COPPA-compliant handling (such as age screening, verifiable
parental consent, or restricted data collection for known-underage users). **We are not
representing, in this draft, that the Service currently complies with COPPA or equivalent
children's-privacy laws elsewhere.** This needs direct attorney review, and likely product
changes, before publication — see Section 2 of the Terms of Service for the paired flag.

## 7. Data retention and account deletion

We retain account and gameplay data for as long as your account exists, so that
features like history, achievements, and leaderboards keep working correctly.

🚩 **Gap, stated plainly:** as of this writing, the app has **no self-service account-deletion
feature** — there is no "delete my account" button or API endpoint anywhere in the codebase.
If you want your account or data removed today, your only option is to contact us through the
method in Section 9 and ask us to do it manually. **We believe this is a real gap that should
be closed — by building an actual deletion feature — before this Privacy Policy is published
and makes retention/deletion promises to real users**, since a policy that describes rights
the product cannot yet fulfill is worse than no policy.

## 8. Your rights

Depending on where you live, you may have rights to access, correct, or request deletion of
your personal data, or to object to or restrict certain processing. Today, you can exercise
these informally by contacting us (Section 9); as noted in Section 7, deletion specifically
requires a manual process on our end right now rather than a self-service one. 🚩 A lawyer
should confirm what specific rights (e.g., GDPR, CCPA/CPRA, or other regional rights) actually
apply based on where the operator is based and where players are located, and whether this
section needs to name them specifically and commit to response timeframes.

## 9. Contact

Questions about this Privacy Policy, or a request to access, correct, or delete your data, can
be sent using the in-app **Submit Feedback** feature (the feedback button in the app's
footer), which files your message directly to the project's issue tracker. We do not currently
publish a separate privacy or support email address; if that changes, this section will be
updated.

## 10. Changes to this policy

We may update this Privacy Policy as the Service changes — particularly as flagged throughout
this draft (e.g., if account deletion is built, or if any feature starts persisting IP
addresses or other new data). If we do, we will update the "Last updated" date above.

---

## Flagged for attorney review / product gaps

1. **Children's privacy / COPPA (Section 6).** No age screening exists; this needs real legal
   review given the likely audience, paired with the same flag in the Terms of Service.
2. **Account-deletion gap (Section 7).** No deletion feature exists in the product today. This
   is a product gap, not just a wording gap — closing it should arguably happen before this
   policy is published, since the policy currently has to admit the gap rather than promise a
   working right.
3. **Applicable regional privacy law (Section 8)** (GDPR, CCPA/CPRA, etc.) depends on where the
   operator and its players are located — needs attorney confirmation, likely tied to the same
   governing-law placeholder left in the Terms of Service.
4. **Future IP-address / device-fingerprint persistence.** The anti-cheat design doc discusses
   possible future anomaly detection (e.g., flagging many accounts from one IP). As of this
   draft, no IP address is persisted anywhere in the schema — only used transiently in memory
   for rate-limiting. If that changes, this policy's Section 2 must be updated before such a
   feature ships.
