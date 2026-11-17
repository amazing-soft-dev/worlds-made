# Kids, privacy and copyright

Kids are a core audience, so COPPA applies. The FTC's amended COPPA Rule has been in force since April 22, 2026 and requires
separate parental consent before sharing a child's data with third parties for targeted ads. The simplest safe V1 is to
**collect no personal data from under-13s at all**. **Get a lawyer's review before launch.** The public pages (`/parents`,
`/legal/*`) are drafts that describe what the product does today.

## What the code enforces

| Case | V1 rule | Where |
| --- | --- | --- |
| Age gate | Neutral question, year of birth only, remembered in a signed cookie so a retry cannot change it | `backend/src/routes/age.ts`, `LoginFlow.tsx` |
| Under 13 wants to build | No account. They can play the daily challenge and gallery anonymously | `services/age.ts` (`canHaveAccount`) |
| Under 13 plays | No sign-in, no free text, no leaderboard name, only a random anonymous id for the streak | `services/anon.ts`, `routes/dailyScores.ts` |
| Ads on kid-facing pages | Child-directed treatment for under-13 and unknown ages | `frontend/src/lib/ad-treatment.ts` |
| Ads for 13 to 17 | Under-age-of-consent treatment, no personalised ads | same |
| Paid plan | Adults only; teens see "ask a parent" | `services/billing/billing.ts` |
| EEA and UK | Accounts require 16+ (GDPR Art. 8 varies 13 to 16 by country) | `services/age.ts` (`REGIONS_16_PLUS`) |
| Data retention | Anonymous data 180 days, inactive accounts 730 days, published on the privacy page | `services/retention.ts`, `LIMITS` |
| Analytics | Cookie-light only, no ad pixels, no cross-site tracking | `frontend/src/app/layout.tsx` |
| Moderation | Prompts, game text, titles, descriptions and tags; reports hide a game at 3 | `services/moderation`, `services/community` |

## Copyright and IP

| Case | V1 rule |
| --- | --- |
| User asks for "Mario" or "Pokémon" | The prompt filter swaps franchise names for an original stand-in and tells the user |
| Clone of a whole game's look | Genres and mechanics are allowed; names, characters, logos, music and level copies are not |
| Who owns a generated game | The user owns what they contribute and grants a licence to host, show and promote it; AI output copyright is uncertain so the terms promise nothing |
| Gallery licence | The creator picks one on publish; shown on the play page and in downloads |
| Takedowns | DMCA page, removal within a short time, records kept |
| Our own brand | No Poki, Steam or RAWG logos in a way that suggests a partnership |

## Open items that are not code

- [ ] Lawyer review of `/parents`, `/legal/terms`, `/legal/privacy`, `/legal/dmca`.
- [ ] Register a **DMCA designated agent** with the US Copyright Office and put the name and address on `/legal/dmca`.
- [ ] Replace the placeholder controller name, address and email on `/legal/privacy`.
- [ ] Verify the exact AdSense child-directed and under-age-of-consent tag names against the current AdSense documentation
      before turning ads on (`NEXT_PUBLIC_ADS_ENABLED`). The mapping lives in one place, `ad-treatment.ts`.
- [ ] Supply slurs and hate terms for the moderation blocklist (`MODERATION_EXTRA_TERMS`); they are deliberately not committed.
- [ ] Decide on a parent-consent flow for under-13 accounts (a V2 decision) and a classroom mode.
- [ ] Remove the matching Supabase Auth user when the retention job deletes an inactive account.
