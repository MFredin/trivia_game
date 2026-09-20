# Working in this repo

[`ARCHITECTURE.md`](ARCHITECTURE.md) decides where code goes. [`CONTRIBUTING.md`](CONTRIBUTING.md)
covers how it gets checked and shipped. Both bind agent work the same as human work.

The short version:

- **One feature, one file, at every layer.** A screen brings its own component, stylesheet, API
  module and hook. Never append a feature to a file that other features also append to — that
  is how this repo shipped an unparseable stylesheet.
- **`App.jsx` composes hooks and routes screens.** A feature's state belongs in its own hook
  under `features/`, not in `App.jsx`.
- **Routes are thin; rules live in `lib/` and `services/`** where they can be tested without HTTP.
- **Every route that names a resource by id proves ownership**, and returns 404 rather than 403
  when it is not yours.
- **Nothing that reveals the right answer crosses to the client.** See
  [`docs/anti-cheat-architecture.md`](docs/anti-cheat-architecture.md).
- **A bug that reached a player gets a test before it gets a fix.**
- **`main` is deployed.** Merging is shipping; nothing lands there without a green PR.

Before pushing: `npm test` in `backend/`, then `npm run build` and `npm run audit` in `frontend/`.

## Design constraints

The visual design is an original wizarding-library treatment, not licensed material. Do not add
house crests, house animals, wands, lightning bolts, licensed fonts, or image files — the
ornament is drawn with CSS and inline SVG primitives, and stays that way. Colour goes through
the role tokens in `styles/tokens.css`; pick a token by what it sits on, not by which house it
belongs to, and run `npm run audit:contrast` after any colour change.

The quiz is the product. New features stay optional and light, and must not slow the path from
opening the app to answering question one.
