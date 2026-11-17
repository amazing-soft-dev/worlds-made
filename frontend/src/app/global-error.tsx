'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/monitoring';

/** Last resort when the root layout itself fails, so it renders its own html and body with no site styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: '#070c09', color: '#e8ede5', fontFamily: 'Georgia, serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, textAlign: 'center' }}>
        <div role="alert">
          <h1 style={{ fontWeight: 400 }}>Something went wrong</h1>
          <p>Please try again in a moment.</p>
          <button onClick={reset} style={{ background: '#ecd08a', color: '#070c09', border: 0, padding: '10px 30px', fontSize: 16, cursor: 'pointer' }}>
            try again
          </button>
        </div>
      </body>
    </html>
  );
}
