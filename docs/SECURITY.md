# Security model for generated games

Every generated game is **untrusted code**: an AI wrote it from a stranger's prompt. It must never run with access to
the main site's logins, cookies or data. Six layers, each tested:

| # | Layer | Where | What it stops |
| --- | --- | --- | --- |
| 1 | **Separate origin** | `GAME_ORIGIN` must be a different registrable domain from the site. `/g/:versionId` answers only on that host (404 anywhere else) and never sets cookies. | A game reading the site's cookies or storage |
| 2 | **Sandboxed iframe** | `sandbox="allow-scripts"` only: no `allow-same-origin`, `allow-forms`, `allow-popups` or `allow-top-navigation` (frontend, issue #57). | Navigation, popups, form posts, same-origin access |
| 3 | **Strict CSP** | `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; frame-ancestors <site>; base-uri 'none'` | Any network request, any external resource, framing by other sites |
| 4 | **Narrow messaging** | The parent accepts only `{type:"score"}` and `{type:"error"}`, checks `event.source` is its own frame, ignores the rest (`shared/src/score-message.ts`). | Spoofed or extra messages |
| 5 | **Static scan** | `backend/src/services/scanner.ts` before a version is stored, again before it is served, and before download. Rejects external URLs, `fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, `Function`, storage and cookie APIs, window escapes, computed global access and files over 200 KB. | The obvious attacks, early and cheaply |
| 6 | **Downloads** | Same scan, plus a header comment telling people to open the file only in a browser. | Surprises on the player's own machine |

## Access to a game

The game origin has no logins. The API (`GET /api/games/:id/play-url`) returns a link with a signed token that is
bound to one version and expires after 10 minutes. Published games are open to everyone; drafts only to their owner.

## Other rules

- **Moderation** runs on prompts (before the model), on a game's visible text (after), and on gallery titles, descriptions and tags.
- **Under-13s** get no account, no free text and no leaderboard name; only a random anonymous id is stored.
- **Secrets** are never logged (the logger redacts authorization, cookies and Stripe signatures) and never committed.
- **Scheduled jobs** require `Authorization: Bearer $CRON_SECRET`.
- **Row-level security** is on for every table; the backend's service role is the only writer of moderated state.

## Known limits

- The rate limiter and the one-build-at-a-time gate are per server instance. The daily allowance is exact (database).
- The scan is conservative, not a proof. The sandbox, CSP and separate origin are the real boundary.
- Slurs and hate terms are not committed; supply them with `MODERATION_EXTRA_TERMS`.
