# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Use GitHub's private reporting instead:
**Security tab → Report a vulnerability** on this repository. That reaches the maintainer only.

Include what you found, how to reproduce it, and what an attacker could do with it. You will get an
acknowledgement within a few days. This is a hobby project run by one person: there is no bug bounty, but
credit in the fix is yours if you want it.

## What is in scope

The code in this repository and the deployed game built from it. The areas that matter most:

- **Score integrity.** The client must never learn a right answer early or influence a score; see
  [`docs/anti-cheat-architecture.md`](docs/anti-cheat-architecture.md).
- **Accounts and sessions.** Registration, sign-in, password reset, token revocation, the age gate.
- **Ownership checks.** Any route that names a resource by id must refuse it (with a 404) when it is not yours.
- **Moderation and messaging.** Reports, Owl Post, roles (admin, moderator), and anything that exposes
  another player's data.

## Please do not

- Test against other players' accounts or data. Make your own accounts.
- Run load or denial-of-service tests against the deployed site.
- Publish details before a fix is out.

## Supported versions

Only `main`, which is what is deployed. There are no release branches.
