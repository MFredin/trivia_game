# Repository and hosting settings

What GitHub and Railway are set to, and why. Most of these live in a web UI rather than in a file, so this page is the
record to check them against, and the place to look when something about merging or deploying behaves unexpectedly.

## The model

`main` is deployed: Railway builds every service from it on each push. So the two questions are **who can change
`main`** and **what has to be true first**.

- Nobody pushes to `main`, the maintainer included. Every change is a pull request.
- A pull request needs the three CI jobs green (`backend`, `frontend`, `e2e`) and its conversations resolved. It does **not** need an approving
  review: this is a one-person project whose pull requests are opened from the maintainer's own account, and GitHub never lets an author approve their
  own pull request, so a required approval could only be met by bypassing the rules, which the GitHub mobile app cannot do. With none required, the
  maintainer can read the diff and merge from a phone once the checks are green. CODEOWNERS still asks the maintainer for a review on every change, so
  the request and the reading happen; they just do not gate the merge. Raise the count to 1 (and turn on code-owner review) the day a second person can
  merge.
- Outside contributors fork the repository. They have no write access, so they cannot merge anything; their pull request
  needs the maintainer's review like any other.
- The maintainer (repository admin) merges their own pull request, **through a pull request only**. Nothing can bypass the rule against pushing
  straight to `main`.
- Railway only deploys a commit once its checks pass (see "Railway" below), so a bypassed red merge still does not ship.

## GitHub

### Ruleset on `main`

`.github/rulesets/protect-main.json` is the ruleset. **Settings → Rules → Rulesets → New ruleset → Import a ruleset**, then
check it says *Active*. It enforces:

| Rule | Why |
|---|---|
| Restrict deletions, block force pushes | `main` history is what Railway deploys and what a rollback points at |
| Require linear history, squash merge only | One commit per change, easy to revert and to read |
| Pull request required, no approval count, conversations resolved, stale approvals dismissed on push | Nothing reaches production except through a pull request with green checks, and it can be merged from a phone |
| Required checks: `backend`, `frontend`, `e2e` | The names are the job ids in `.github/workflows/ci.yml`; rename one and the ruleset must follow |
| Bypass: repository Admin role, **pull requests only** | A one-person project can still merge its own work |

### Repository settings

| Setting | Value |
|---|---|
| General → Features | Wiki off, Projects off (nothing here uses them). Issues on. Discussions optional |
| General → Pull Requests | Squash merging only; automatically delete head branches (already on); allow auto-merge off |
| General → About | A description and topics (for example `trivia`, `react`, `express`, `postgresql`, `fan-project`) |
| Settings → Actions → General → Fork pull request workflows | **Require approval for all outside collaborators** |
| Settings → Actions → General → Workflow permissions | Read repository contents; do not let Actions create or approve pull requests |
| Settings → Advanced Security | Private vulnerability reporting **on**, Dependabot alerts and security updates **on**, secret scanning and push protection **on** |
| Settings → Collaborators | Nobody has write access unless added on purpose |

### Secrets

Repository secrets: `RAILWAY_TOKEN` only (a project token for production), used by `.github/workflows/railway-config.yml`.
That workflow runs only for pull requests from this repository, never from forks, because a fork's pull request must not
be able to read it. CI itself uses no secrets.

## Railway

| Setting | Value | Why |
|---|---|---|
| Both services → Settings → Source → **Wait for CI** | On | Without it Railway deploys on push without waiting for GitHub's checks, and a merge that bypassed a red check would ship |
| `ALLOWED_ORIGIN` on the API | The frontend's origin, exact | Anything else blocks the site's own requests; see `.railway/railway.ts` |
| Postgres → public TCP proxy | Off unless a person is actively using it | The database is reached over Railway's private network; a public endpoint is exposure for no benefit |
| Postgres → backups | Enabled | The volume is the only copy of every account and score |
| Variables | Set in Railway, never in the repository | `.railway/railway.ts` lists names only, with `preserve()` |
| Optional | `SENTRY_DSN`, `VITE_SENTRY_DSN`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`, `VITE_PARENT_CONTACT_EMAIL` | Password reset email, error tracking and the under-13 contact are off until these are set; see the README's configuration table |

Two things Railway's Infrastructure as Code cannot express yet, so they are dashboard-only: **Wait for CI**, and the
builder (the live builder is Railpack).

## Checking it

After a change to any of the above, open a throwaway pull request: it should show three required checks, a required review,
and a disabled **Merge** button until they pass. Try `git push origin HEAD:main` from a clone; it must be rejected.
