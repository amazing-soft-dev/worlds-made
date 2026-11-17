# Static export

`NEXT_OUTPUT=export` builds plain HTML into `frontend/out/`. It exists so the export stays valid; the
production site is the server build that Vercel deploys.

```bash
npm run images -w frontend                       # responsive WebP into public/images/w640|w1080|w1600
NEXT_OUTPUT=export npm run build -w frontend     # writes frontend/out/
npm run check:static -w frontend                 # asserts the export is complete
```

## What the export has

- HTML for every route in `src/content/routes.ts` (the sitemap and the check both read it), plus `404.html`.
- `sitemap.xml`, `robots.txt`, `llms.txt`, the favicon and the Open Graph image.
- Each manifest photo as 640, 1080 and 1600 pixel WebP, served by `src/lib/image-loader.ts`.

## What it cannot have

- **No `/api`.** There is no server, so `out/api` must not exist (the check fails if it does). Forms and anything
  that calls the backend cannot work in the export.
- **No dynamic data pages.** Pages that load by id, such as `/play/[id]`, ship a client-side shell in the export
  and cannot resolve unknown ids. They are only meaningful on the server build.
- **No image optimizer.** Images use the pre-built WebP files instead.

Add a route to `ROUTES` only when its page exists as static HTML.
