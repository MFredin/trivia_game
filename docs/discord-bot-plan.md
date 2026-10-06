# Discord bot — plan and scaffold

> **Status: tabled.** This is a plan, not a build. Nothing in the app depends on it, and nothing here has been implemented.

The roadmap has carried "Discord bot tie-in" as *dropped for now, needs bot credentials*. That
description was wrong in a way that matters: **almost all of the work needs no credentials**, and the
design below is chosen so that nothing about it adds an always-on process, a privileged permission,
or a review that blocks the first release. This document answers, in order: what it would do, how to
build it, how to get it live, which review processes exist and which of them apply, and what it costs
to keep running.

Not legal advice. Discord's policies change; section 9 lists what to re-check on the day.

## 1. How much of this is verified

The research for this plan was done from a sandbox that **cannot reach discord.com, docs.discord.com
or support-dev.discord.com**, so none of the official pages could be read directly. What follows is
tagged by how well each claim is established:

| Tag | Meaning |
|---|---|
| **Confirmed** | Seen in search results quoting Discord's own documentation or support pages, and consistent across sources. |
| **Secondary** | Stated only by third-party write-ups or open-source projects. Plausible, not proven. |
| **Recall** | From general knowledge of the platform, not re-checked. Treat as a to-do to verify. |

Every claim that a decision rests on is listed again, with its tag, in section 9. **Before any
work that depends on a number, read the live Discord page for it.**

## 2. What the bot would do, and what it would not

The rule from Phase 5 holds: the quiz is the product, and anything new stays optional and light.
A Discord bot is the easiest feature in the repo to turn into a retention machine (pings, streak
reminders, "your friend just beat you"). It does none of that.

**It does**
- Answer slash commands a member chooses to type: standings, a profile card, this week's challenge,
  how to start a duel.
- Optionally, post a short weekly message to one channel that a server admin picked.
- Optionally, let a player link their Discord account so a server can give them a role for their
  house or milestones (Linked Roles).

**It does not**
- Show a question and accept the answer in Discord (see Phase 3 below: deferred on purpose).
- Send direct messages, ever.
- Read messages. It subscribes to no gateway events and needs no privileged intent.
- Post unprompted anything other than the one opt-in weekly message.
- Reveal anything the web app wouldn't. The commands read the same public views the website serves.

## 3. Decisions to make first

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Receive interactions over **HTTP**, or hold a **gateway** connection? | **HTTP.** | No second always-on process, no reconnect logic, no intents. It runs inside the existing API service. See section 5. |
| D2 | Who owns the Discord application? | A **team** whose owner is you, created from the start. | Verification (later) asks the team owner for an identity document; an app owned by a personal account is harder to hand over. |
| D3 | What is the bot called? | A **neutral name that does not contain a Harry Potter trademark.** | Discord's App Directory content policy says an app's name, description and commands must not contain IP-violating content (**Confirmed**). The repo's own [`ip-risk-notes.md`](ip-risk-notes.md) says to keep the project low-profile. A listing is far more visible than the app. Ask an attorney before choosing, since "The Restricted Section" is itself a phrase from the books. |
| D4 | Public bot from day one, or private to your own community first? | **Private first**, public later. | Under 75 servers there is no verification, no ID check and no review at all (section 6). Prove it with real members first. |
| D5 | Ship "play in Discord" (Phase 3)? | **No, not in the first release.** | It puts the answer path on a surface the anti-cheat model doesn't cover. See Phase 3. |
| D6 | Do we want the app listed in Discord's App Directory? | **Optional, after verification.** | Not needed to use the bot. Needs a support server, a privacy policy and terms (section 6). |

## 4. Phases

Each phase is independently shippable and independently revertible.

### Phase 0: groundwork (no Discord app needed)

Everything here can start today, and none of it touches production behaviour.

- `backend/src/lib/discordSignature.js`: verify an interaction's Ed25519 signature with Node's
  built-in `crypto`, no dependency (snippet below, tested).
- `backend/src/lib/discordConfig.js`: read the environment variables; export `discordEnabled()`.
  Every route below answers `404` when it is false, the same pattern Sentry and the mailer use
  ("inert until configured").
- `backend/scripts/discord-simulator.mjs`: signs interaction payloads with a throwaway test keypair and posts
  them to the local endpoint. This is how CI and a developer exercise the bot **without Discord,
  a tunnel, or credentials**.
- Legal: add Discord to the privacy-policy drafts (section 8). This has a lead time, so start it now.

```js
// lib/discordSignature.js: the whole verification, no dependency. Tested against a generated keypair:
// valid -> true, tampered body -> false, garbage signature -> false.
import crypto from 'node:crypto';

// An Ed25519 public key is 32 raw bytes; Node wants it wrapped in an SPKI header.
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function verifyDiscordSignature({ publicKeyHex, signatureHex, timestamp, rawBody }) {
  try {
    const key = crypto.createPublicKey({
      key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(publicKeyHex, 'hex')]),
      format: 'der',
      type: 'spki',
    });
    // Discord signs the timestamp header followed by the exact raw bytes of the body.
    return crypto.verify(null, Buffer.concat([Buffer.from(timestamp), rawBody]), key, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false; // malformed hex or key: never throw out of a request handler
  }
}
```

### Phase 1: read-only slash commands (the MVP)

Members type a command; the bot answers from data the website already publishes.

| Command | Answers with | Reads |
|---|---|---|
| `/standings` | Top 10 for This Week, All Time, or the House Cup (option) | the leaderboard and House Cup queries |
| `/profile <username>` | A compact card: house, title, best score, accuracy, streak | the same `userView` the profile page uses, **respecting its privacy settings and blocks** |
| `/weekly` | This week's themed challenge, with a link that opens it in the app | `featuredChallengeSpec` (the weekly sibling of the Daily) |
| `/duel` | How to challenge someone, with a link; no duel is created from Discord | static |
| `/help` | The list, the link to the app, the non-affiliation line | static |

Design rules:
- Replies are **ephemeral** (only the caller sees them) unless the option `share: true` is passed,
  so the bot never clutters a channel on its own.
- Every reply sets `allowed_mentions: { parse: [] }`. **Usernames and bios are user-generated**; without this,
  a player named `@everyone` would make the bot ping a whole server on someone else's behalf.
  Names are also escaped for Discord markdown.
- Slow queries answer with a **deferred response** and then edit it. Discord requires an
  acknowledgement within three seconds, and the follow-up token lasts fifteen minutes (**Confirmed**).
- The handlers are pure functions `(interaction, deps) -> response`, so they are unit-tested without HTTP.

### Phase 2: account linking, Linked Roles, and the weekly post

Both pieces are optional, and each needs the player (or the server admin) to opt in.

**Account linking** ties a Discord user to a player account.
- Starts in **Settings → Privacy** ("Connect Discord"), only when signed in.
- `GET /api/discord/link` returns an authorize URL for the `identify` scope with a signed `state` (user id,
  nonce, 10-minute expiry, signed with the existing token HMAC helpers).
- `GET /api/discord/callback` verifies `state`, exchanges the code, reads `GET /users/@me` **once**, stores the
  Discord user id, and **discards the access token**. The app never keeps a Discord token.
- Stored: only `discord_user_id`. Not the username, avatar, email or guild list.
- **Unlink** is one button, and deleting the account deletes the row (add it to `accountDeletion.js`).

**Linked Roles** (the high-value one for a community): a server admin can require, say, "bound in
Gryffindor" or "50 games played" to hold a role. The app pushes a few numbers per linked player.
- Scope `role_connections.write` (**Confirmed** in the OAuth2 scope list). This does keep an OAuth token, because
  the app must update metadata later. Store it **encrypted at rest** (a new `DISCORD_TOKEN_KEY`), or skip
  Linked Roles in the first release and ship linking without it. Recommendation: **skip it at first.**
- Metadata fields (types **Recall**: Discord supports integer, boolean and datetime comparisons, so a house
  is encoded as an integer 1 to 5): `house`, `games_played`, `best_score`, `achievements`, `duel_wins`.

**Weekly post** (opt-in per server).
- `/trivia subscribe` and `/trivia unsubscribe`, restricted by `default_member_permissions` to members who can
  Manage Server.
- The bot needs the **Send Messages** permission in that one channel, and nothing else. Keep the permission
  integer minimal in the install link.
- Stored: `guild_id`, `channel_id`, who enabled it, when. A sweep (the same `setInterval` pattern as
  `retention.js`, guarded by a Postgres advisory lock) posts once per ISO week, using the stored
  `last_posted_week` so a restart cannot double-post.
- If Discord answers 403 or 404 (channel deleted, permission removed), **disable the subscription** and stop
  retrying; do not loop.

### Phase 3: play in Discord (deferred; reasons, not a plan)

Serving a question as a message with answer buttons is tempting and is **not recommended for the first
release**:
- The anti-cheat model ([`anti-cheat-architecture.md`](anti-cheat-architecture.md)) is built around a
  server-issued, single-use, session-bound token and server-clock timing. A Discord button press arrives with
  Discord's timestamp, not ours, and a message in a public channel is visible to everyone who might answer.
- Scores from there would need a separate, non-ranked mode, and the 3-second acknowledgement rule fights the
  server-side timing.
- It competes with the app, which is the product.

If you want to revisit it, scope it as an **unranked "question of the day" in a subscribed channel**, answered
with ephemeral buttons, with no score. That is cheap and cheat-proof by construction because nothing is at stake.

## 5. How to build it

### Architecture

```
Discord ──HTTPS POST /api/discord/interactions──▶ existing API service (Railway)
                                                     │  verify Ed25519 signature on the RAW body
                                                     │  route by command name → pure handler
                                                     ▼
                                                 Postgres (same database)
Discord ◀── HTTPS (REST, only for the weekly post and Linked Roles) ── existing API service
```

One service, one deployment, no gateway. This is Discord's "interactions endpoint URL" model. It receives
HTTP POSTs, requires the `X-Signature-Ed25519` and `X-Signature-Timestamp` headers to be verified against the
app's public key, answers a `PING` (type 1) with a `PONG`, and needs no gateway connection
(**Confirmed**, several sources).

### Files (one feature, one file, per [`ARCHITECTURE.md`](../ARCHITECTURE.md))

```
backend/src/
  lib/discordConfig.js            env vars, discordEnabled()
  lib/discordSignature.js         verifyDiscordSignature (above)
  lib/discordCommands.js          the command definitions (also what the register script pushes)
  lib/discordReplies.js           escape(), safeReply() (allowed_mentions: none), ephemeral(), embed helpers
  routes/discord.js               POST /interactions, GET /link, GET /callback, DELETE /link
  services/discordInteractions.js dispatch + one pure handler per command
  services/discordLinks.js        link / unlink / lookup
  services/discordWeekly.js       the weekly post sweep (Phase 2)
backend/scripts/
  discord-register-commands.mjs   bulk-overwrite the commands (npm run discord:register)
  discord-simulator.mjs           signs and posts fake interactions locally
backend/test/
  discordSignature.test.js        valid / tampered / garbage / stale timestamp
  discordInteractions.test.js     each handler, with a mock deps object
  discordRoute.test.js            signature required, PING answered, bad body is 401 not 500
frontend/src/
  api/discord.js
  components/DiscordConnect.jsx   the Settings → Privacy row
  features/account/useDiscordLink.js
```

### The one Express detail that will bite

The signature is computed over the **exact raw bytes** of the body. `app.js` mounts `express.json()` at line 47
for every route, which parses and discards the raw bytes. Mount the interactions route **before** it with
`express.raw({ type: 'application/json' })`, or use `express.json({ verify })` to keep the raw buffer on the request. Do
the verification first, parse second, and answer `401` (not `500`) for a bad or missing signature.
Discord probes this deliberately: when you save the endpoint URL it sends a request with an invalid signature
and expects a 401 (**Recall**; Discord's docs describe this check).

### Environment variables (all optional; the bot is inert without them)

| Variable | Used for |
|---|---|
| `DISCORD_APPLICATION_ID` | Registering commands; building the install link |
| `DISCORD_PUBLIC_KEY` | Verifying interaction signatures |
| `DISCORD_BOT_TOKEN` | Phase 2 only: posting the weekly message and Linked Roles metadata registration |
| `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` | Phase 2 only: the OAuth2 code exchange |
| `DISCORD_TOKEN_KEY` | Only if Linked Roles are built: encryption key for stored tokens |

Phase 1 needs only the first two, and **neither is a secret that can sign anything**: the public key only
verifies. The bot token is the dangerous one and is not needed until Phase 2.

### Registering commands

`npm run discord:register` does a **bulk overwrite** of the global commands from `lib/discordCommands.js`
(**Confirmed**: it creates new ones, updates changed ones and deletes the ones omitted). Facts that shape how we use it:
- An app can have up to **100 global chat-input commands** (**Confirmed**). We need about six.
- Genuinely new commands count toward a **daily limit of 200** creates (**Confirmed**); a re-run that changes nothing
  does not.
- Global command changes can take **up to an hour** to appear in every server (**Confirmed**). While developing,
  register to **one guild** instead; those update instantly.

### Local development and testing

1. `discord-simulator.mjs` for everything day to day. Needs no Discord account.
2. To try the real thing: create a **separate development application** and a private test server, expose
   the local API with a tunnel (cloudflared or ngrok) and paste the tunnel URL into the app's Interactions
   Endpoint URL. Discord validates it on save, so the signature check must already work.
3. Never point the production application at a tunnel, and never share one application between dev and prod.

### Security checklist

- Verify the signature before parsing; reject timestamps more than five minutes old (replay).
- `allowed_mentions: { parse: [] }` on every message; escape markdown in user-generated names.
- Never log interaction bodies or any token; add the Discord variables to Sentry's scrubbing list.
- Rate limit the endpoint (it is unauthenticated by design) and keep handler queries on indexed columns.
- Handlers read through the **same view functions the website uses**, so privacy settings, blocks and the
  moderation holds that hide a profile apply identically. Do not write a second query that "just returns the stats".
- A moderator action that hides or renames a player takes effect in Discord on the next command, because
  nothing is cached on the bot side.
- OAuth `state` is signed and expires; the callback is the only unauthenticated write, and it only inserts a link
  for the user inside the verified `state`.
- Treat a leaked bot token as an incident: reset it in the Developer Portal, redeploy, and check the audit log.

## 6. How to get it live, and the review processes

There are **three separate processes** that people tend to blur into one. At the scale you are likely to start
at, **none of them is required.**

| Process | What it is | Needed when | Applies to us |
|---|---|---|---|
| **No review (private use)** | Create an app, install it in servers you control. | Always the first step. | Yes: this is where we start. |
| **App Verification** | Discord checks that the developer is real. The team owner submits an identity document through Discord's ID partner (Stripe). The support article that says documents from people under 16 do not qualify is dated 2021 (**Confirmed, but old**: re-read it). | **Required to grow past 100 servers.** You can apply from about 75 (**Confirmed**: "bots begin qualifying at 76 servers; required to join over 100"). | Only if we grow past ~75 servers. |
| **Privileged Intent review** | Separate approval for the gateway intents that expose member lists, presences and message content. | Reported as **required once an app that has any privileged intent reaches 10,000 unique users**, applied for within 90 days, re-applied for yearly (**Secondary**: third-party sources, plus a Discord docs page title seen in search but not readable). | **No.** We use no gateway and no privileged intent. |
| **App Directory listing ("Discovery")** | Optional public listing in Discord's directory. | Never required. | Optional, later. |

### The App Directory listing, specifically

Requirements (**Confirmed** from Discord's documentation and support pages as quoted in search results):
- The app must already be **verified** (identity and application verification).
- A **support server** (a Discord server whose invite link you give them).
- An app description, and a **publicly available privacy policy and terms of service** connected to the app.
- No age-restricted content, and nothing that is IP-violating in the name, description or commands.
- You click **"Enable Discovery"** in the Developer Portal once the checklist is complete. Discord can still
  **reject** a listing for violating its terms or guidelines, so there is a human or policy review behind the button.

**Our two risks here are both about naming and content**, not code: the Harry Potter trademarks in an app
name or description (D3), and the privacy policy and terms still being drafts that need an attorney.

### Other bot lists (top.gg, discord.bots.gg and similar)

These are **third-party sites, not Discord**, each with its own submission queue and rules, none of which was
researched here. They are optional and not needed for anything above. If you want one, read its current
submission rules first; most expect the bot to be public and some run vote or promotion mechanics that conflict
with this project's "nothing pushes" rule.

### The path to live, as a checklist

**A. Prepare (no code, can start now)**
1. Decide the name (D3) and write the short description. Have an attorney look at both.
2. Create a Discord **team** and the application under it (D2). Add a 512px icon that is **your own** artwork,
   not film art or house crests.
3. Create a **support server** (also required later for Discovery). Put the rules, a link to the app and the
   non-affiliation line in it.
4. Publish URLs for the **privacy policy and terms of service**. They exist as drafts in `docs/legal/`
   and are not published; they must be reviewed first (section 8).
5. Create a **second, development** application and a private test server.

**B. Build and prove locally** (Phase 0 and 1 above, simulator only). No Discord needed.

**C. Private launch**
1. Set `DISCORD_APPLICATION_ID` and `DISCORD_PUBLIC_KEY` on the Railway backend service.
2. Run `npm run discord:register` once against production.
3. In the Developer Portal set the **Interactions Endpoint URL** to
   `https://<backend-domain>/api/discord/interactions`. Discord sends a probe; the save only succeeds if the
   signature check is right.
4. Build the install link: scopes `applications.commands` (and `bot` only when Phase 2 needs the weekly post).
   Keep requested permissions to the minimum, ideally none in Phase 1.
5. Install it in your own server, then a few friendly ones. Keep **"Public Bot"** off until you want strangers
   adding it.

**D. Open to the public**: turn on Public Bot. You are now outside any review until about 75 servers.

**E. At about 75 servers**: apply for verification (identity document from the team owner, who per the 2021 article must be 16 or over),
make sure the privacy policy and terms are published and attorney-reviewed, and note that **at 100 servers the bot
stops being able to join more until it is verified.**

**F. Optional**: Enable Discovery (needs verification, support server, policies).

## 7. Operating it

- **Cost**: nothing extra; same service, same database. No new process to supervise.
- **Failure mode**: if the API is down, commands fail ("application did not respond"). The weekly post is a
  sweep, so it catches up on the next tick without double-posting.
- **Rate limits**: Discord enforces a global limit and per-route limits (**Recall**). The weekly post sends one message
  per subscribed server per week, so this is not a constraint at any plausible size; if it ever is, honour
  `Retry-After` and spread the posts.
- **Support**: the support server and the in-app Submit Feedback link. Add a one-line "Discord" section to
  `docs/monitoring.md` covering where to look when an interaction fails (Sentry breadcrumb with the command
  name only, never the body).
- **Moderation**: bot output is generated from the same data as the website, so the existing report, block and
  hold machinery already covers it. A player who asks to be removed is handled by **Unlink** and by the
  existing account deletion.
- **Kill switch**: unset `DISCORD_PUBLIC_KEY` and the whole feature goes inert on the next deploy.

## 8. Privacy, legal and policy changes

Touching `docs/legal/` means an attorney review. Prepare the edits, do not publish them.

- **Privacy policy**: Discord becomes a service the app talks to. State what is stored (a Discord user id, and
  for Phase 2 the server and channel id of a subscription), what is not (no Discord token if Linked Roles are skipped,
  no messages, no guild lists), what the bot reads (public profile data only), and how to unlink.
- **Retention** ([`retention.js`](../backend/src/services/retention.js)): link rows live until unlink or account deletion; a subscription
  row until `/trivia unsubscribe` or until Discord reports the channel gone.
- **Age**: the app already enforces 13 and over. Discord's own developer policy says apps must not be directed at
  people under 13 or the local minimum age (**Confirmed**, Discord Developer Policy effective 8 July 2024). Both agree.
- **Account deletion**: add the link row to [`accountDeletion.js`](../backend/src/services/accountDeletion.js) and its test.
- **Data requests**: Discord's policy expects apps to honour user data deletion requests (**Recall**: confirm the exact
  wording). Unlink plus account deletion covers it for our data.
- **IP**: add a bullet to [`ip-risk-notes.md`](ip-risk-notes.md) about app name, description and icon.

## 9. What to re-check on the day (with tags)

| Claim | Tag | Where to look |
|---|---|---|
| HTTP interactions: verify `X-Signature-Ed25519` and `X-Signature-Timestamp`, answer `PING` with `PONG` | Confirmed | Developer docs, "Interactions Overview" |
| Acknowledge within 3 seconds; follow-up token valid 15 minutes | Confirmed (3s) / Recall (15 min) | same |
| Up to 100 global chat-input commands; bulk overwrite; 200 daily creates; up to 1 hour to propagate | Confirmed | Developer docs, "Application Commands" |
| Verification required to join more than 100 servers; can apply from about 75 | Confirmed | Discord support article on bot verification |
| Verification: identity document via Stripe; document holder 16 or over | Confirmed, but the source is from 2021 | same; check for a newer version |
| Privileged Intent review now keyed to **10,000 users**, with a 90-day window and yearly renewal | **Secondary** | Developer docs, "Getting Started with Privileged Intent Review". **Read this one in full before relying on it.** It is irrelevant to us while we use no intents. |
| App Directory: needs verification, support server, description, privacy policy and terms, no IP-violating content | Confirmed | Developer docs, "Enabling Discovery"; support article "App Directory Inclusion Guidelines" |
| Scopes: `identify`, `applications.commands`, `bot`, `role_connections.write` | Confirmed | Developer docs, "OAuth2 and Permissions" |
| Linked Roles metadata comparison types | Recall | Developer docs, "Application Role Connection Metadata" |
| Developer Policy: not directed at under-13s; data deletion on request | Confirmed (age) / Recall (deletion) | Developer Policy (effective 8 July 2024; check for a newer version) |
| Discord's interaction timestamp and rate-limit specifics | Recall | Developer docs, "Rate Limits" |
| Third-party bot lists' rules | Not researched | Each site |

## 10. Delivery: PRs, sizes, acceptance

Sizes are rough: S under a day, M one to two days, L three to five, for one person who knows the repo.

| PR | Contents | Size | Acceptance |
|---|---|---|---|
| **D-1** | Phase 0: signature lib, config, simulator, route with `PING` only, tests | S | The simulator gets `PONG`; tampered and stale requests get 401; feature inert when unconfigured. |
| **D-2** | Phase 1: command definitions, register script, handlers for `/standings`, `/profile`, `/weekly`, `/help`, `/duel`, reply helpers | M | Each handler unit-tested; a player named `@everyone` produces no mention; blocked or hidden profiles are not shown. |
| **D-3** | Phase 2a: account linking (Settings row, callback, unlink, deletion), legal edits drafted | M | Link and unlink round-trip in the simulator-backed test; stored data is a user id only; deleting an account removes the row. |
| **D-4** | Phase 2b: weekly post subscription and sweep | M | Posts once per ISO week even across restarts; disables itself on 403 and 404. |
| **D-5** | Phase 2c (optional): Linked Roles | M | Only if wanted; needs token encryption. |
| **Admin track** | Section 6 checklist A and C, done by you in parallel | n/a | Dev application, support server and install link exist. |

Recommended order: **D-1 and the admin track together, then D-2.** D-3 onward only after real use of D-2.

## 11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Listing or name is rejected or reported over Harry Potter IP | Medium | Neutral name, own artwork, attorney review (D3); the bot works without any listing. |
| The Linked Roles token is a new secret to protect | Certain if built | Skip it at first; if built, encrypt at rest. |
| A user-generated name is abused through the bot (mass ping, markdown injection) | High without a fix | `allowed_mentions: none`, escaping, tested. |
| Scope creep into "play in Discord" | Medium | D5 and Phase 3. |
| Discord changes thresholds and policies | High over time | Section 9 is the re-check list; nothing here depends on a number at our scale. |
| An unauthenticated endpoint is hit hard | Low | Signature check first, rate limit, cheap rejection before any query. |

## 12. Open questions for you

1. The name and the description (D3). Is a neutral name acceptable?
2. Private-first (D4), or open to the public from the start?
3. Who should own the team, given the identity-document requirement at verification time?
4. Linked Roles: wanted, or leave for later?
5. Do you want a support server now, or only when verification approaches?
