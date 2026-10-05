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
**Draft revision:** 3 — brought up to date with the app as of October 2026 (the 13+ age gate, moderator
role, retention periods, password reset and the public deletion page). See "Revision history" at the end.

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
- **Username** — public. Shown on leaderboards, in the member directory, to friends, and in
  duels. Other players can find you by it.
- **Email address** — used to log in, and to send you a link if you ask to reset your password or to
  delete your account (we send no other email). Not shown to other players. (If a player is banned, a
  one-way hash of the address is kept; see "Reports and moderation" below.)
- **Password** — we never store your actual password. We store a one-way hash: your password
  is run through Node's `scrypt` key-derivation function with a unique random salt per
  account, and only that salt+hash is stored (`backend/src/lib/passwords.js`). We cannot look
  up or recover your plaintext password.
- **Chosen house theme** — a cosmetic preference, stored against your account.
- **Staff role** — whether your account is a moderator or an administrator. Only a small number of accounts.
  Moderators can review reports and take some actions; administrators can do everything, including bans.
  See "Reports and moderation" below for who sees what.
- **Age confirmation** — a timestamp showing that, when you registered, you told us you were 13 or over. **We
  do not keep your date of birth**: the month and year you enter are checked on the spot and discarded.
- **Invite code** — a code tied to your account that lets you invite other players.
- **Account creation timestamp.**

**Your profile** (`users` table). All optional, all visible to any signed-in player, and all
chosen by you:
- **Avatar** — a symbol or your initial, and how you have dressed it (shape, colour, pattern,
  frame, corner mark), chosen from fixed lists. **Nothing is uploaded: the app does not accept
  photos or images.**
- **Bio** — up to 140 characters of plain text you write. It is checked automatically (no links,
  email addresses, handles or phone numbers, and a list of blocked words) and can be reported to
  and removed by a moderator.
- **Favourite book and favourite subject**, chosen from fixed lists.
- **Pinned achievements** — up to three of your earned achievements to show on your profile.
- **Title** — a short label from a fixed list (earned through play, or given by an administrator) shown beside
  your name; you choose whether to wear one.
- **Who can see your friends list** — friends only (the default), everyone, or only you.
- **Owl Post and challenge settings** — who may message you or invite you to a duel: everyone (the
  default), friends only, or no one.

**Gameplay data** (`game_sessions` and `session_questions` tables): every quiz run you play —
mode (Classic, Daily Challenge, Blitz, Survival, Gauntlet, Live Duel, shared Challenge),
category and difficulty filters chosen, score, streak, which lifelines were used, and,
per question, which answer you picked, whether it was correct, whether you timed out, and how
long you took to answer. This is what lets us compute your score server-side (see our
[anti-cheat architecture](../anti-cheat-architecture.md)) and show you your own history and
personal bests. A run that looks automated may be marked "flagged for review" with a short
note (`flagged_for_review`, `flag_reason`) and held off the leaderboards until a person looks.

**Friends and social data** (`friendships`, `duels`, `challenges`, `blocks`, `activity_events`
tables): who you have sent or accepted friend requests with; duel matchups and results; challenge
codes you have made or joined; **who you have blocked** (visible only to you); and small events
about you — such as beating a personal best, unlocking an achievement or winning a duel — shown to
your friends on the Community screen's Activity tab. We never push these as notifications.

**Achievements** (`user_achievements` table): which achievements you have unlocked, and when.

**Owl Post messages** (`messages` table): short plain-text messages between two players. By default
any player can send you one (you can restrict this to friends only, or switch Owl Post off, in Settings),
though someone who is not your friend can send only one until you answer. For each message we store its text, an optional subject, who sent it and to whom, when,
and whether and when it was read. Messages are **not** end-to-end encrypted: they sit in our
database in readable form. We do not read them as a matter of course — **moderators have no way to
browse anyone's inbox** — but they can be seen in two situations: (1) when a player reports a
conversation and chooses to include the recent messages, the last 20 messages of that conversation
(including the ones written by the other person) are copied into the report for a moderator to
read; (2) as needed to respond to a legal obligation or a serious safety concern. Messages are
deleted automatically **90 days** after they are sent. "Delete for me" hides a message from you
only; the other person keeps their copy until the 90 days are up.

**Reports and moderation** (`reports`, `moderation_actions`, `banned_emails` tables): if you
report another player, we store who you are, who you reported, the reason you chose, your optional
note (up to 500 characters) and, if you chose to include them, the recent Owl Post messages. The
player you report is never told who reported them. If a moderator acts on a report about you
(a warning, a forced rename, clearing your bio, resetting your avatar, holding your scores off the
leaderboards, muting, suspending or banning you), we store what was done, when, by which
moderator, and the note written to you explaining why. If you are **banned**, we also keep a
SHA-256 hash of your email address (not the address itself) so the same address cannot be used to
register again; the hash is removed if the ban is lifted.

**Who sees a report.** Reports are read by moderators and administrators. A moderator sees the report, the
reason and note, and any messages attached to it, and can warn, rename, clear a bio or avatar, hold scores off
the leaderboards, mute or suspend for up to 7 days, or send the report up to an administrator; only an
administrator can ban, suspend for longer, or act on another member of staff. Neither can browse anyone's
inbox. Every action is recorded with who took it. The reported player is never told who reported them.

**Password-reset and deletion links** (`email_tokens`, `email_token_log` tables): when you ask for a link, we
store a one-way hash of the random code in it (never the code), which account it is for, and when it expires
(60 minutes) or is used, and we count the messages sent to an address per day to limit abuse. Used and expired
codes are deleted. The address is entered only to look up an account; if it has none we send nothing and say
the same thing, so the form cannot be used to find out who is registered.

**Suggested questions** (`suggested_questions` table): if you use the question-suggestion
feature, we store the question text, answer, and distractors you wrote, tied to your account,
plus the review status and any review note once it has been looked at.

**Feedback submissions**: if you use the in-app "Submit Feedback" button, we send your message,
chosen category, the page you were on, and — if you were logged in — your username, to our
issue tracker. Feedback can also be submitted without an account.

**What we do *not* store in our database:** We do not store your IP address. Our server uses
your IP address only transiently, in memory, to rate-limit login, registration, and feedback
requests against abuse; that in-memory counter is never written to the database and is discarded
on its own after a short window or on server restart. We do not collect your real name, physical
address, phone number, payment information, precise location, photos, or contacts. We do not use
any third-party analytics or advertising trackers. 🚩 *If this changes — for example, if a future
anti-cheat or anomaly-detection feature starts persisting IP addresses or device fingerprints to
the database — this section must be rewritten to say so before that feature ships, not after.*

## 3. Why we collect it

- **Account info** — to let you log in and to identify you to other players by username.
- **Profile** — because you chose to make one; it is shown to other players so the game feels
  like a community. You can change or clear it at any time.
- **Gameplay and session data** — to run the game itself (server-authoritative scoring is a
  deliberate anti-cheat measure), to show you your own stats and history, and to power
  leaderboards, duels, and shared challenges.
- **Friends, blocks and activity data** — to provide the friends, duel, Owl Post and activity
  features you opt into, and to keep a player you have blocked away from you.
- **Owl Post messages** — to deliver them, and to let you report abuse with evidence.
- **Reports and moderation records** — to keep the Service safe: to review reports, apply and
  explain sanctions, make sure repeated behaviour is recognised, and keep a banned player from
  returning. Kept for the periods in Section 7.
- **Age confirmation** — to keep the Service to players aged 13 and over (Section 6).
- **Email for reset and deletion links** — so that someone who cannot log in can still get back in or delete
  their account.
- **Suggested questions** — to run the player-question-submission and review feature.
- **Feedback** — to receive and act on bug reports and ideas.

We do not sell your personal data to third parties, and we do not share it with third parties
for their own advertising or marketing purposes.

## 4. Where data goes outside our database

- **Hosting.** The Service runs on a hosting provider (Railway) and its database, which therefore
  store everything described above on our behalf. 🚩 *Attorney: confirm whether a data-processing
  agreement and a statement about where the data is stored are needed.*
- **Email.** If an operator turns it on, password-reset and account-deletion links are sent through an email
  provider (Resend), which therefore sees the recipient's address and the message. Nothing else is emailed.
  Without it nothing is sent and the app says so. 🚩 *Attorney: provider terms and where it processes data.*
- **Feedback submissions** are sent to a GitHub repository's issue tracker via the GitHub API,
  so GitHub stores that content (your message, category, page, and username if logged in) as
  well as we do. 🚩 *Confirm whether that repository's issues are public; if they are, a
  feedback message and username are public too, and the feedback form should say so.*
- **Error reports (Sentry), only if switched on.** The app can send crash and server-error
  reports to Sentry. It is off unless an operator configures it. When on, a report can include
  the address of the request that failed — and some addresses contain a username (for example a
  profile or an Owl Post conversation). 🚩 *This should be either scrubbed in code or disclosed
  here before Sentry is turned on in production.*
- We do not otherwise share personal data with third-party services, and we do not use
  third-party analytics, ad networks, or tracking pixels.

## 5. What's stored on your device (cookies / local storage)

We checked the actual frontend code for this rather than describing a generic cookie policy.
As of this writing, the app stores two things in your browser's `localStorage`:

- your **login session token**, under the key `trivia_auth_token`. This is what keeps you logged in between
  visits; it is removed when you log out or when the server tells the app your session is invalid. Session
  tokens last 30 days and cannot be cancelled early, even by changing the password. 🚩 *Fixable in code; say so
  here until it is fixed.*
- **a timestamp, under `trivia_age_gate`, set only if someone enters an age under 13** at registration. It stops
  the same browser immediately trying again with an older age for 24 hours, and holds no date of birth.

Both are strictly necessary to run the Service as described (staying signed in; keeping the age rule), so a
consent banner is probably not needed for them 🚩 *attorney to confirm for the jurisdictions that matter*. We do
not use advertising or analytics cookies. Your theme preference is saved to your account on our server, not in
the browser.

## 6. Children's privacy

🚩 *[See `docs/legal/coppa-options.md`; the decision below is the founder's and an attorney must confirm it.]*
**The Service is for players aged 13 and over.** Registration begins with a neutral question — the month and
year of birth, with no hint of the cut-off — before any email address, username or password is asked for. If
the answer shows the person is under 13, nothing is stored, no account is created, and they are told the
Service is not available to them; the same browser is stopped from trying again with a different answer for 24
hours (Section 5). If the answer shows 13 or over, registration continues, and all that is kept is the fact
that they confirmed it (Section 2) — not the date. The server makes this check itself, before it reads
anything else in the request.

If we learn that an account belongs to someone under 13, we will delete it. Parents who think their child has
an account can use the contact method in Section 9, and the in-app deletion or the public page in Section 7.
There is no parent-approved mode for younger players; whether to offer one later is open (`coppa-options.md`,
Option B).

Limits, stated plainly: an age question that is answered honestly is the only check; accounts that existed
before it was added were never asked; and **we are not representing that the Service complies with COPPA or
equivalent laws elsewhere** — whether a Harry Potter-themed service counts as "directed to children", and what
follows from that, is a question for the attorney. Some countries set a higher age of digital consent than 13.

## 7. Data retention and account deletion

**You can delete your account yourself** (Settings → Delete account; it asks for your password and
your username typed out). Deleting is **anonymising**, not erasing a row, because other players'
history points at your account (the other side of a duel, a challenge leaderboard). When you
delete:

- **Removed or overwritten at once:** your username (replaced by a random `deleted-…` name), email
  address, password hash, avatar, bio, favourites, pinned achievements, invite code, house theme,
  friends and pending friend requests, blocks, achievements, activity, **and all Owl Post messages
  you sent or received.** Your username and email can then be used to register again.
- **Kept, without your name:** your game runs and scores, and duel and challenge history that other
  players are part of; where these are shown, you appear as **"Deleted player."**
- **Moderation records are kept for a fixed time, then deleted** (below), linked only to the anonymised
  account in the meantime, so that a safety decision can be explained and a pattern recognised.
- **If you were banned,** the one-way hash of your email address is kept after deletion, on
  purpose, so the ban cannot be avoided by deleting and re-registering.
- **Backups.** 🚩 *The hosting provider's database backups are outside the app's control; a
  statement about how long they last is needed.*

If you do not delete your account, we keep your data for as long as the account exists. Owl Post
messages are deleted after 90 days regardless.

**Safety records** are removed automatically (checked hourly), whether or not the account still exists:

- the **copy of messages attached to a report** — 90 days after the report is closed;
- **a closed report** (reason, note, outcome) — 1 year after it is closed;
- **what was done to a player** (warning, forced rename, suspension, ban and the note sent with it) — 1 year
  after it stopped mattering: after it was applied, for a one-off action; after it ended or was lifted, for a
  suspension or mute; after it was lifted, for a ban.

**Open reports and sanctions still in force are never removed**; a ban's record, and the hash of the email behind
it, last as long as the ban. 🚩 *Attorney: are these periods defensible? Is a longer period needed for a
particularly serious report?*

**Reset and deletion links** are valid for 60 minutes and can be used once; expired ones are deleted.

**Deleting without logging in.** The footer of every page has a "Delete your account" link (also reachable as
`/?delete-account`, for an app-store listing). It explains what deletion does, and, where email is switched on,
sends a one-hour link to the address on the account; opening it shows which account it is and deletes it only
when the button is pressed. A forgotten password can likewise be reset by emailed link. 🚩 *Where email is not
set up, the page says so and a request has to go through Section 9 and be handled by hand.*

## 8. Your rights

Depending on where you live, you may have rights to access, correct, or request deletion of
your personal data, or to object to or restrict certain processing. You can correct most of your
data in the app (profile, avatar, theme, privacy settings) and delete your account as described
above. For anything else, contact us (Section 9). 🚩 A lawyer should confirm what specific rights
(e.g., GDPR, CCPA/CPRA, or other regional rights) actually apply based on where the operator is
based and where players are located, whether "anonymise and keep scores without a name" satisfies
those rights, and whether this section needs to name them and commit to response timeframes.

## 9. Contact

Questions about this Privacy Policy, or a request to access, correct, or delete your data, can
be sent using the in-app **Submit Feedback** feature (the feedback button in the app's
footer), which files your message directly to the project's issue tracker. We do not currently
publish a separate privacy or support email address; if that changes, this section will be
updated. 🚩 *A public issue tracker is a poor place for a request that contains personal
information; a private contact address is needed before publication.*

## 10. Changes to this policy

We may update this Privacy Policy as the Service changes. If we do, we will update the
"Last updated" date above.

---

## Flagged for attorney review / product gaps

1. **Children's privacy / COPPA (Section 6).** The founder has chosen 13 and over, enforced by a neutral age
   question. Attorney to confirm that this is sufficient for this app (is it "directed to children"?), whether
   any country needs a higher age, and the wording for people who registered before the question existed. A
   parent-approved mode is deferred, not ruled out.
2. **Retention periods (Section 7).** 90 days / 1 year / 1 year are the engineering proposal. Attorney to confirm
   or change; the numbers live in `backend/src/lib/retention.js`.
3. **Applicable regional privacy law (Section 8)** (GDPR, CCPA/CPRA, etc.) depends on where the
   operator and its players are located — needs attorney confirmation, tied to the governing-law
   placeholder in the Terms of Service.
4. **Messages are stored readable (Section 2).** Confirm the disclosure about when they can be
   seen, and whether keeping the other person's messages inside a report is acceptable.
5. **Sentry and request addresses (Section 4)** and **whether feedback issues are public.** Both are
   fixable in code; decide before turning either on in production.
6. **Hosting provider, email provider, processor terms and backups (Sections 4 and 7).**
7. **A private contact address (Section 9)** is still needed; the issue tracker is public.
8. **Session tokens cannot be cancelled (Section 5)** — a password change or reset does not sign out other
   devices for up to 30 days. A code fix is straightforward; until then this must be disclosed.
9. **Future IP-address / device-fingerprint persistence.** No IP address is persisted anywhere in the
   schema — only used transiently in memory for rate-limiting. If that changes, Section 2 must be
   updated before such a feature ships.

## Revision history

- **Revision 1** — first draft, written when the app had accounts, gameplay, friends, duels,
  achievements, suggested questions and feedback, and no way to delete an account.
- **Revision 2 (October 2026)** — adds profiles (avatar, bio, favourites, pinned achievements,
  friends-list visibility), blocking, reporting and moderation records, the banned-email hash,
  Owl Post (messages, subject, 90-day retention, report evidence), self-service account deletion
  (which replaces the old "no deletion" statement), the activity feed's new location, and the new
  open items above.
- **Revision 3 (October 2026)** — records the founder's decision to serve players 13 and over, with the age
  question, the `age_confirmed_at` timestamp and the `trivia_age_gate` device flag; the moderator role and who
  sees reports; titles and the open Owl Post and challenge settings (already described, now stated as the
  default); retention periods for reports, evidence and moderation actions; password reset and the public
  deletion page, with the email data they use and the email provider; the 30-day token limitation. Closes the
  "public deletion page" and "no retention period" items and reframes the COPPA item as a decision to confirm.
