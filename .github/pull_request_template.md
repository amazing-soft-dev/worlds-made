<!-- Pull requests into dev are normally opened by the "Open pull request" workflow. This is for manual ones. -->

Refs #

## What changed

## How it was checked

- [ ] `npm run lint && npm run typecheck && npm run check:images`
- [ ] `npm run build` (server) and `NEXT_OUTPUT=export npm run build -w frontend` (static)
- [ ] Touches sandboxing, age handling or moderation: security note added
