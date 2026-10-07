## What and why

<!-- What changed, and the reason it needed to. A reader six months out has the diff; they do not have the reason. -->

## Checks

- [ ] `cd backend && npm run lint && npm test`
- [ ] `cd frontend && npm run lint && npm run build && npm run audit`
- [ ] Browser tests (`cd frontend && npm run e2e`) if a screen's look or behaviour changed
- [ ] A bug that reached a player has a test that failed before the fix
- [ ] Any new route that names a resource by id checks ownership and answers 404, not 403
- [ ] Nothing that reveals a right answer is sent to the client
- [ ] No image files, house crests, wands, lightning bolts or licensed fonts; colour goes through `styles/tokens.css`

## Migration or deploy notes

<!-- A new column or table? Anything to set in Railway? "None" is a fine answer. -->

## Screenshots

<!-- For anything visible, at phone width (390px) as well as desktop. -->
