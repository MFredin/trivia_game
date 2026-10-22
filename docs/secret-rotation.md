# Secrets: what is at risk if the host's environment is read, and how to rotate them

Everything the API knows that is not in the repository lives in Railway's environment variables. If Railway (or anyone with access to a project)
may have read them, treat each as seen, and rotate: changing the value is the only thing that makes a copy worthless. This page says what each
one would have let someone do, what rotating it costs the players, and how.

**What this page is built from.** The variable names come from `.railway/railway.ts` (the list the file keeps in step with the dashboard) and from
what the code reads (`process.env`). The dashboard is the authority: if it shows a variable that is not below, it needs the same treatment.

## What each one is worth to an attacker, and how to rotate it

| Variable (where) | What holding it allows | Rotate by | What players notice |
|---|---|---|---|
| `AUTH_TOKEN_SECRET` (API) | **Signing in as any player, an admin or moderator included.** A sign-in token is only an HMAC over a user id and a small number that starts at 0 and is easy to guess; whoever has the secret can make one | A new value from `npm run secrets:generate`, on the API service, then a redeploy | Everyone is signed out once and signs in again |
| `QUESTION_TOKEN_SECRET` (API) | Answering questions that were never served, and choosing when they were served, for a bigger time bonus (needs an account; breaks score integrity, not account security) | Same, the second value the script prints | A question that was on screen at the moment of the redeploy needs to be started again |
| `DATABASE_URL` (API; a reference to the Postgres service) | **Everything in the database**: email addresses, the scrypt hashes of passwords, Owl Post messages, reports, scores, and the power to write: for example `UPDATE users SET is_admin = true`. | The Postgres password (below), then the new URL on the API service | The API restarts; nothing else |
| `GITHUB_FEEDBACK_TOKEN` (API) | Creating and editing issues and comments on this repository as the maintainer (a fine-grained token with *Issues: write* on this one repository, nothing else) | GitHub → Settings → Developer settings → Fine-grained tokens: revoke it, make a new one with the same single permission, set it | The feedback form answers 503 until the new one is set |
| `RESEND_API_KEY` (API, only if email is on) | Sending mail from the verified domain: phishing that looks like it is from the game | Resend → API keys: delete it, make a new **sending-only** key limited to the domain, set it | Reset and deletion emails stop until it is set |
| `SENTRY_DSN` (API, only if error tracking is on) | Sending fake error reports. It is not a credential for reading anything | Sentry → Client Keys: rotate it | None |
| `RAILWAY_TOKEN` (**GitHub** Actions secret, not Railway) | Reading and changing the production project's variables and deployments, which is everything on this page | Railway → project → Settings → Tokens: delete it, make a new project token for production, put it in GitHub → Settings → Secrets → Actions | The Railway config workflow cannot run until it is replaced |

Not secrets, nothing to rotate: `ALLOWED_ORIGIN`, `APP_URL`, `MAIL_FROM`, `NODE_ENV`, `VITE_API_URL`, `GITHUB_FEEDBACK_REPO`, `PORT`, and the `RAILWAY_*` values
Railway sets itself.

## The order

1. **Make the two signing secrets.** `cd backend && npm run secrets:generate` prints a fresh `AUTH_TOKEN_SECRET` and `QUESTION_TOKEN_SECRET`. They are not
   stored anywhere; paste them straight into Railway and close the terminal. The server now refuses to start in production with a secret under 32
   characters, one that looks like the placeholder in `.env.example`, or the same value for both, so an old weak one cannot be kept by accident.
   (It cannot tell whether a long one is *old*: that is yours to change.)
2. **Rotate the Postgres password** (below), then **the other variables** in the table.
3. **Set the new values on the API service and redeploy.** The redeploy restarts the process, which also closes any WebSocket that was open.
4. **If you cannot redeploy yet**, end every session now with `npm run sessions:revoke -- --yes` (it needs `DATABASE_URL`, for example through
   `railway run`). It raises every account's `token_version` and deletes every emailed reset or deletion link. It signs everyone out, like rotating
   `AUTH_TOKEN_SECRET`, but it does not replace the secret, so it is a stopgap and not a substitute.
5. **Look for damage** (below).

### The database password

Changing the `POSTGRES_PASSWORD` variable on Railway's Postgres service does not change the password of a database that already exists: the volume keeps the
old one. Connect with the current credentials and set a new one yourself, then change the variable to match and redeploy, so a restart does not disagree:

```sql
ALTER USER postgres WITH PASSWORD '<a new long random value>';
```

(Use Railway's own "regenerate credentials" option instead if the dashboard offers it for your plan, and check its documentation for what it does to an existing
volume.) Then make sure the service's **public TCP proxy is off**: the database should only be reachable over Railway's private network, as
`docs/repository-settings.md` says. Consider Railway's *sealed variables* for the secrets in the table: a sealed value cannot be read back through the
dashboard or the API, which narrows who and what can see it afterwards. It does not make a value that has already been seen safe.

## What the code does about it

| | |
|---|---|
| `lib/secretPolicy.js`, `lib/secrets.js` | The two signing secrets are checked at start-up (length, placeholder, different from each other). A deployment with a bad one fails its health check, and Railway keeps serving the previous one |
| `lib/socketTickets.js`, `POST /api/auth/socket-ticket` | The sign-in token used to travel in the WebSocket URL, which every proxy and log between the player and the server writes down. It no longer does: the socket opens with a ticket good for **one connection within 30 seconds**, signed under a different label so neither can stand in for the other. A line found in a log afterwards opens nothing |
| `npm run secrets:generate` | Makes the two secrets, stores nothing |
| `npm run sessions:revoke -- --yes` (`services/sessionRevocation.js`) | Ends every sign-in and every emailed link at once, with no deploy |
| `npm run audit:exposure` (`services/exposureReport.js`) | Lists every admin and moderator and what moderators did lately, so an account that should not be there shows |

Already in place before this: a password change or reset raises that account's `token_version`, so older tokens stop working (`repo/users.js`);
emailed links are stored only as hashes (`services/emailTokens.js`); passwords are salted scrypt; and a deleted, suspended or banned account's token stops
working on the very next request.

## Looking for damage afterwards

`cd backend && npm run audit:exposure -- --days 60` (needs `DATABASE_URL`) prints:

- every **admin and moderator**, with when the account was made. Roles are given by hand in the database and nothing records who gave them, so the
  check is yours: is every name on the list a person you appointed? An admin or moderator made recently, or one you do not recognise, is the thing to
  look for. Demote it (`UPDATE users SET is_admin = false, is_moderator = false WHERE id = ...`) and look at what that account did.
- what each moderator did in the window (`moderation_actions`), and how many accounts were made, so a flood of new ones shows.

Also look at: Railway's own activity log and deployment history for changes you did not make; GitHub's security log and the token's last-used time for
`GITHUB_FEEDBACK_TOKEN`; and issues or comments on the repository that you did not write.

## If the database itself may have been read

Then what is in it was seen: email addresses, password hashes (salted scrypt, so they have to be cracked one at a time, but a weak password falls to a
patient attacker), Owl Post messages and reports. A rotation does not take that back. Passwords people reuse elsewhere are the real risk, so a notice to
players that says what was exposed and tells them to change a reused password is the honest thing to send; if a regulator or the privacy policy
(`docs/legal/`, drafts, not reviewed by a lawyer) puts a clock on telling people, that clock starts when you learned of it. The decision to notify is
yours and, ideally, a lawyer's.

## What this page cannot tell you

Whether anyone *did* read a given value. That is Railway's to say, and the only safe reading of "may have" is "did". Rotating is cheap and one-off; the
players' cost is one sign-in.
