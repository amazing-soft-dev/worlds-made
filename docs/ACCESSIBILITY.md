# Accessibility

Target: WCAG 2.2 AA. Kids, parents and people using keyboards, switches or screen readers all need to be able to play.

## What is in place

| Area | How |
| --- | --- |
| Landmarks | One `main#main` per page, labelled `nav`s (Main, Footer), a skip-to-content link as the first focusable element |
| Headings | One `h1` per page (the page title), `h2` per section; `SectionTitle` takes the level |
| Keyboard | Every control is a real `button`, `a`, `input`, `select` or `summary`; gallery tabs follow the ARIA tabs pattern with arrow keys; the phone menu is a native `<details>` that closes after navigation |
| Focus | A gold 2px outline on every interactive element (`focus-visible`); the game frame takes focus when it loads so the keyboard works at once |
| Forms | Visible labels tied to controls, hints, errors in `role="alert"`, results in `role="status"` |
| Colour | Text colours checked for 4.5:1 contrast by `npm run check:a11y` in CI; state is never colour alone (labels such as "free", "paid", "current") |
| Motion | The hero slide-in and scroll reveals are skipped under `prefers-reduced-motion`; CSS transitions and smooth scrolling are removed too |
| Games | Every template supports keyboard and touch; "stop and restart" ends a runaway game |
| Images | Every photo has alt text from the manifest; decorative glyphs are `aria-hidden` |
| Live regions | Recommendation results and the daily result announce politely; the countdown is labelled once, not every second |

## Checks

```bash
npm run check:a11y -w frontend   # contrast of the colour tokens
```

Manual pass before launch: tab through every page, use the game maker and a game with the keyboard only, zoom to 200%,
and try a screen reader on the login flow and the gallery tabs.

## Known gaps

- Generated games are written by an AI, so their own contrast and focus handling vary. The template controls are the baseline.
- The ad unit is third-party content that we do not control.
