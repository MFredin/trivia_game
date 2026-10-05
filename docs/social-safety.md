# Profiles, blocking and account deletion

What the social and safety features do, and the decisions behind them — for whoever reviews this
for a store listing, writes the privacy policy, or changes it later.

## Avatars

An avatar is a sigil (one of 24 generic objects drawn in `frontend/src/constants/avatarSigils.js`) or
the player's initial, on a disc they have dressed in five layers: **shape** (circle, rounded square,
hexagon, octagon), **colour** (their house, or one of nine fixed colours), **pattern**, **frame** and a
**corner mark** — roughly 20,000 combinations. **Nothing is uploaded**: CLAUDE.md rules out image
files, and an upload would make every profile a moderation surface. Everything is drawn as SVG from
fixed lists (`backend/src/lib/avatarStyle.js` is the allow-list; a backend test fails if it drifts from
the frontend's), and every colour pair is in the contrast audit.

A few patterns, frames and marks are **earned**: an achievement unlocks them (`AVATAR_UNLOCKS`).
Colours and the basics of every layer are always free. The server refuses a locked choice, but never
refuses to keep one a player already wears, so retiring an achievement cannot lock someone out of
saving.

## Bio and profile fields

Players can also pick a favourite book (of the seven) and a favourite subject (a question category),
pin up to three earned achievements to show instead of the most recent, and write a **bio**. Only the
bio is free text, so it is the one field with a filter and a removal path:

- **140 characters, plain text.** Whitespace is collapsed and control characters removed.
- **No links, email addresses, handles or phone numbers** (`lib/bioFilter.js`) — harmful whatever the
  words, and how a profile becomes an advert or a way to pull someone off the platform.
- **A blocklist** of common profanity and slurs, checked through the usual disguises (`sh1t`, `f.u.c.k`,
  `fuck!`) but by whole word, so "class" and "assassin" are fine. The built-in list is stored obscured
  (rot13) so the repository does not hold a plain list of slurs; extend it on the service with the
  `BIO_BLOCKLIST_EXTRA` environment variable (comma-separated). **This is a first line of defence, not a
  guarantee** — it cannot recognise every way to be unpleasant, which is what the next two points are for.
- **Report reason "Offensive bio"**, and the admin Reports screen shows the bio being judged with a
  **Clear bio** action (only when marking a report *action taken*; dismissing never changes anything).
- Saving a profile is rate limited per player (40 an hour), so the filter cannot be probed by script.
- A blocked player's bio is hidden with the rest of their profile, and deleting an account clears it.

Free text from young players also touches the age / COPPA question flagged for the attorney reviewing
`docs/legal/`; if that is unresolved, the bio is the first thing to switch off.

## Who can see what

| | Visible to |
|---|---|
| Username, avatar, bio, favourites, pinned achievements, house, member-since, online marker | any signed-in player (the member directory is open by decision) |
| Lifetime stats, achievements, duel record | any signed-in player |
| Friends list (and its count) | **friends only by default**; the owner can change it to everyone or only themselves |

A viewer who may not see a friends list gets `200 { visible: false }`, never a 404 (which would
read as a missing profile) and never the count.

## Blocking

A block is **one row, mutual in effect**. Only the blocker has the row, so only they can lift it
and the blocked player cannot tell it exists. While it stands, neither can see the other in
search, the member directory, profiles, friends lists (a mutual friend's included), friend
requests, duel invites or duel reactions. Blocking also ends any friendship or pending request and
withdraws a duel invite waiting between the two.

- Friend requests and duel invites to someone who blocked you return the same `404 user_not_found`
  as an unknown name, so they cannot be used to find out who blocked you.
- A duel **already running** is left to finish. The reaction relay (the only message one player can
  send another) stops carrying anything between them.
- **Leaderboards are not filtered by block.** They are cached for everyone and are public by
  design; per-viewer filtering would defeat the cache. An abusive username there is a report.
- Unblocking does not restore a friendship.

Enforcement lives in `backend/src/services/blocks.js` (`notBlockedSql`, `isBlockedEitherWay`,
`blockUser`) and is tested in `backend/test/blocks.test.js`.

## Reporting and moderation

Five-plus-one fixed report reasons (offensive name, offensive bio, harassment, impersonation, cheating,
other) plus an optional 500-character note; ten reports an hour per player; one open report per reporter
per player. The reported player is never told who reported them.

A report on the admin **Reports** screen shows the player's record — standing now, how many earlier
reports ended in action (last 180 days), suspensions, other open reports — and a **suggested** next step
from a ladder per report type (`backend/src/lib/moderation.js`): a first offence is usually a warning plus
a fix, a repeat a suspension (1 → 7 → 30 days as they accumulate), a further repeat a ban. It is a
suggestion; the moderator ticks what they want. Every action says what it does on the screen.

| Action | Effect |
|---|---|
| Warn | A notice the player must acknowledge before using the app again. |
| Force rename | Neutral name now; the player must choose a new one (the only time the app allows a rename). |
| Clear bio / Reset avatar | Removes the bio / puts the avatar back to default. |
| Remove scores | Holds every completed run off the leaderboards (the existing review flag). Nothing is deleted. |
| Mute 1 / 7 / 30 days | Stops them sending Owl Post. They can still play and read. |
| Suspend 1 / 7 / 30 days | Locks out every way in at once; the login screen shows the moderator's note and the end date. |
| Ban | Locks out until lifted, and the email can no longer register (see below). |
| Dismiss | Closes the report with no action. |

Every action needs a **note written for the player** (prefilled from the report type and the actions,
editable) — nothing is applied silently — and is recorded in `moderation_actions`, with who, when and
why. A suspension or ban can be **lifted** from the Action log; overlapping suspensions are recomputed,
so lifting one leaves the other. Admins cannot be moderated, and nobody can moderate themselves.

**Ban evasion.** Deleting an account normally frees its email. For a banned account a SHA-256 hash of the
email is kept (`banned_emails`) and survives deletion, so the address cannot be registered again; a
registration attempt gets the same "already in use" answer as any collision. The hash is removed if the
ban is lifted. This is the one place the app keeps something past account deletion, which the privacy
policy needs to say.

Not here: **appeals** beyond the existing Submit Feedback form, and automatic sanctions — the suggestions are advice, never actions.

## Owl Post

Short messages between **friends**, and nobody else. The largest safety surface in the app, so it is
the most constrained.

- **Friends only, one to one.** A stranger, a blocked player, a player who has Owl Post off, and an
  unknown name are all the same `404 user_not_found`, so the routes cannot be used to find out who has
  blocked you or who has an account. Blocking ends the friendship and so ends the conversation for both.
- **Plain text, 500 characters**, through the same filter as bios (`lib/bioFilter.js`): no links, emails,
  handles or phone numbers, and the blocklist through the usual disguises. Line breaks are collapsed.
- **A new owl is addressed to a friend, by name.** The Owl Post screen has a form (to, an optional
  subject, the message) whose "to" is picked from your friends list; a name that is not a friend is
  turned back in the form, and the server gives the same `404 user_not_found` as ever. This does not
  widen who can be written to: opening Owl Post to anyone would change the safety model, not just the UI.
- **The subject** is optional, 60 characters, through the same filter as the message, and is copied into
  report evidence with the message.
- **Rate limited per sender:** 20 a minute and 300 a day, and the same message to the same person twice
  within a minute is refused.
- **A switch.** Each player can turn Owl Post **off** in Settings: they cannot send or receive, and their
  old conversations stay readable. (This is per player. There is no operator-wide kill switch yet.)
- **Retention: 90 days.** Messages are deleted by an hourly sweep after that, wherever they sit. "Delete
  for me" hides a message from one player only, since the other still has their copy.
- **Deleting an account removes its messages**, both those it sent and those it received.
- **Live delivery** over the existing WebSocket (`owlpost:message`), to the recipient only. The unread
  count is also re-read every minute so a dropped socket cannot leave it wrong.

**What moderators can see.** Nothing, by default. Moderators do not browse inboxes. A player reporting
from inside a conversation can choose (on by default) to **include the last 20 messages**, which are
copied into the report at that moment (`reports.evidence`) — both sides, whatever either has deleted for
themselves — and shown to the moderator with the report. That is the only way a private message reaches
a moderator, and it is the reporter's choice. The privacy policy should say exactly this.

**Mute.** A moderator action (1, 7 or 30 days) that stops a player *sending* Owl Post. They can still
play and still read. Harassment's ladder is warn → mute → suspend → ban. A mute is lifted from the Action
log like a suspension.

**The age question.** Free-text messaging between young players is a larger COPPA concern than bios. If
the attorney review (`docs/legal/`) has not settled a minimum age, hold Owl Post back at launch rather
than ship it.

## Deleting an account

Deletion **anonymises**: the row stays, with everything that identifies the player removed, because
other players' history points at it. In one transaction:

- **Removed or overwritten:** username (becomes `deleted-<id>-<random>`), email, password, avatar and its style, bio, favourites, pinned achievements,
  invite code, house, admin flag, friendships, blocks, achievements, activity.
- **Rewritten in other people's rows:** the "won a duel against ___" activity line.
- **Kept, without a name:** game runs and scores, challenge and duel history, submitted question
  drafts. Everywhere they are shown the account reads **"Deleted player"** (`lib/displayName.js`).
- **Withdrawn:** pending duel invites to or from the account.
- **Freed:** the username and email can be registered again; the names `deleted-…` and
  "Deleted player" cannot.

Auth tokens are stateless, last thirty days and cannot be revoked, so `requireAuth`,
`optionalAuth` and the WebSocket upgrade also check that the account is live; open sockets are
closed on deletion. Deleting requires the password as well as a valid token, and the dialog asks
for the username typed out.

### Not done yet

- **A public web page for requesting deletion** — Google Play requires one in addition to the
  in-app flow.
- **Password reset** — there is no email sending, so a forgotten password cannot be recovered.
- **Bio moderation beyond the filter** (a human reviewing every bio, or an external moderation service) —
  the filter and the report path are the minimum, not a substitute for a policy.
- Whether "scores kept, un-named" satisfies the privacy law that applies to the operator is a
  question for the attorney reviewing `docs/legal/` (PR #46), not something this code decides.
