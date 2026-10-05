# Under-13 players: the options — DRAFT for attorney review

> **Not legal advice.** Written by an AI coding assistant for the project's non-lawyer founder, to
> frame a decision and to give the reviewing attorney a head start. It describes how US children's
> privacy law (COPPA, 16 CFR Part 312) is generally understood, from general knowledge and not from a
> source checked today; **the rule was amended in 2025 and an attorney must confirm current
> requirements, dates and approved methods.** The FTC's own COPPA FAQ and "Complying with COPPA"
> guide are the primary sources.

## Where the app stands

- **Registration asks for no age.** Email, username and password only. There is no age screen.
- **Information that would be a child's personal information if the player were under 13:** the
  username (it is public, searchable and works as an online identifier), the email, the gameplay
  history, the bio (free text), who they are friends with, and Owl Post messages. Under COPPA, a
  username that lets others contact a child is itself personal information, and so is making
  anything of a child's available to the public.
- **Public by design:** leaderboards, the open member directory, profiles, the activity feed to
  friends. Free text (bio, Owl Post subject and message) is filtered but not reviewed by a person
  unless reported.
- **The audience is plausibly mixed.** Harry Potter trivia is not aimed at children as such, but it
  appeals to them; whether a service is "directed to children" is a facts-and-circumstances test
  the FTC applies, and an attorney has to judge it. Independently, **actual knowledge** that a
  particular user is under 13 brings COPPA into play for that user, however the service is aimed.

## The idea: let a parent request an exception

*"When someone under 13 tries to register, then on submit, give their parents a way to email us or
submit an issue to approve their child's access."*

**Short answer: it is the right shape, but a parent replying "yes" to an email does not by itself
count, and the order of steps matters. Done carefully it can be part of a compliant design; done as
described it would not be.**

### 1. Order of events — don't collect first

If the child has already typed an email, username and password and pressed submit before we learn
their age, we have collected personal information from a child with no consent. The age question has
to come **first**, before any other field, and under-13 players must not be asked for anything else.
The only thing that may be collected from them is what is needed to ask the **parent** — and that is
the parent's email address, not the child's. COPPA allows collecting a parent's email for exactly
this purpose, but it must be used only to request consent, and deleted if the parent does not respond
within a reasonable time (set a short limit, e.g. a few days, and delete it).

### 2. The age screen has to be neutral

Ask for a birth date (or an age) with no hint of the cut-off ("You must be 13 to play" above the
field invites a lie), start with no default, and remember a failed attempt (a short-lived cookie or
local-storage flag) so pressing Back and re-entering an older age doesn't work. This is the standard
the FTC describes for mixed-audience services. It is not foolproof and doesn't need to be.

### 3. "Verifiable" parental consent is a defined thing

Consent has to be **verifiable**: a method *reasonably calculated, in light of available technology,
to ensure that the person giving consent is the child's parent.* An emailed "yes" can be sent by the
child. Methods the FTC recognises include (current list to be confirmed): a signed form returned by
post, fax or scan; a **credit/debit card transaction** that notifies the account holder; a call to
trained staff; a video call; checking a **government ID** against a database (and deleting it
promptly); and a few newer ones (knowledge-based questions, facial-match against ID).

**"Email plus"** is the lighter method: the parent's email, plus one more confirming step (a
follow-up email or call after a delay, or a confirming letter). It is accepted **only when the
operator uses the child's data internally and does not disclose it** — and it is **not available if
the child's information is made public or shared** (a public username on a leaderboard, a profile, a
bio, chat or messages all count). That rules it out for the app as it is today.

### 4. "Submit an issue" is the wrong channel

Feedback and issues go to a GitHub issue tracker. Taking a child's or parent's details there puts
personal information with a third party, possibly in public, and there is no way to verify who wrote
it. The parent flow needs its own private form and mailbox.

### 5. Consent has to be specific, and the child's experience limited

A parent must be told what is collected and be able to refuse, review and delete it. Under the 2025
amendments (to be confirmed) disclosure to third parties needs its own separate consent, and a written
retention policy and a security program are expected. A child with a parent's approval would still
need the **social and public features handled separately** — see below.

## What the options really are

### Option A — 13 and over only *(recommended)*

The Service says it is for players 13 and over (and the local age of digital consent where that is
higher). Mechanically:

1. A **neutral age screen** is the first step of registration, before email, username or password.
2. Under the age: nothing is stored, a **short "this isn't available" screen** is shown, a flag
   stops an immediate retry, and a **"for parents"** note explains why and how to reach us.
3. Over: registration continues exactly as today.
4. Terms of Service and Privacy Policy say 13+, and the app now enforces it.
5. If we later learn an account belongs to a child (a report, a parent's email), we delete it. A small
   process for that goes in the privacy policy.

**Why:** it is the most common approach among general-audience services (most major social, chat and
gaming platforms set 13 as the floor), it collects the least, and it needs no payment or ID vendor. It
does **not** make COPPA disappear — if the service is judged *directed to children*, an age gate alone
is not enough — but with a general-audience theme and a neutral gate it is the standard, defensible
position. An attorney should confirm it for this app.

### Option B — a parent-approved "junior" experience

Allow under-13 players with verifiable parental consent, and in exchange take away everything public:

- Pseudonymous, system-assigned display name (no chosen username shown anywhere);
- No bio, no Owl Post, no member directory listing, no friends, no activity feed, no suggested
  questions, no feedback form with their name;
- Leaderboards that show only their own rank, or none;
- Parent dashboard to review, export and delete.

Consent via a recognised method (the practical choices for a small team are a **small card charge**
through a payment provider, or an **ID check** through a vendor — either has cost and its own privacy
obligations). This is a **second product** more than a feature: the safest version of the app is the
one with the least in it, and building and verifying it is a large piece of work for a free fan
project. Not recommended unless there is a clear reason to serve children.

### Option C — the "parent exception" as described, without the above

Under-13s may register if a parent emails back approval, and then get the normal app. **Not
recommended:** the approval isn't verifiable, and the child's information would be public. This is
the version that fails.

## Is a parent-request flow "industry practice"?

- The **neutral age gate with a hard stop under 13** is very common (it is what most large platforms
  do).
- **Parent-initiated consent for under-13s** is practised by services that set out to serve children
  (kid-focused games, and the "family" or "supervised account" features of the large platforms),
  nearly always with **card or ID verification**, a parent account, and a restricted child mode —
  not a reply-to-this-email form. A bare email is generally considered too weak except under "email
  plus" for internal-only data.

## Related, outside the US

The UK/EU's rules ask for parental consent below an age between 13 and 16 depending on the country
(13 in the UK), and expect age-appropriate design. A 13+ floor with a neutral gate is workable in
the UK; where a higher consent age applies (e.g. 16 in some EU countries) the same mechanism is
needed with a different number. An attorney should say which countries matter.

## What would be built for Option A (about a day of work)

- An age step before the registration form, using a birth month and year, with the failed-attempt
  flag.
- A "not available" screen and a "for parents" note, with a private contact address (not the public
  issue tracker).
- The same neutrality for the Google sign-in or any future sign-in method (none today).
- A line in the Terms and Privacy Policy, and a short internal runbook for removing an account found
  to belong to a child.
- Tests: no account or data is created for an under-age entry; a retry in the same browser is
  refused.

## Decisions needed

1. Option A, B or neither (and, with the attorney, whether the app is "directed to children").
2. A **private** contact address for parents and privacy requests.
3. The minimum age to state, and whether any country needs a higher one.
4. If Option B is ever wanted: the consent method and who pays for it.
