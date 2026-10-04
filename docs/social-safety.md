# Profiles, blocking and account deletion

What the social and safety features do, and the decisions behind them — for whoever reviews this
for a store listing, writes the privacy policy, or changes it later.

## Avatars

An avatar is the id of one of 24 generic sigils (`backend/src/lib/avatars.js`, drawn in
`frontend/src/constants/avatarSigils.js`) on a disc in the owner's house colours, or the player's
initial until they choose. **Nothing is uploaded.** CLAUDE.md rules out image files, and an upload
would make every profile a moderation surface. A backend test fails if the two lists drift.

## Who can see what

| | Visible to |
|---|---|
| Username, avatar, house, member-since, online marker | any signed-in player (the member directory is open by decision) |
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

- **Removed or overwritten:** username (becomes `deleted-<id>-<random>`), email, password, avatar,
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
- Whether "scores kept, un-named" satisfies the privacy law that applies to the operator is a
  question for the attorney reviewing `docs/legal/` (PR #46), not something this code decides.
