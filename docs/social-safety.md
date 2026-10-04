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

## Reporting

Five fixed reasons plus an optional 500-character note; ten reports an hour per player; one open
report per reporter per player. Admins review them on the Reports screen (avatar menu) and mark
them *action taken* or *dismissed*. **There is no automatic sanction** — "action taken" records
that an admin did something (for example setting `is_admin`/deleting through the database); the
app has no suspend feature. The reported player is never told.

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
