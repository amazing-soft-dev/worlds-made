/** First focusable element: lets keyboard users jump past the navigation. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-gold focus:px-4 focus:py-2 focus:font-display focus:text-bg"
    >
      Skip to content
    </a>
  );
}
