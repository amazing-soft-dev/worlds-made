'use client';

import { useEffect } from 'react';
import { StateMessage } from '@/components/ui/StateMessage';
import { reportError } from '@/lib/monitoring';

/** Catches a crash in any page below the layout, reports it, and lets the visitor try again. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <StateMessage role="alert" title="Something went wrong" action={{ label: 'try again', onClick: reset }} secondary={{ label: 'back home', href: '/' }}>
      <p>That was our mistake, not yours. We have been told about it.</p>
    </StateMessage>
  );
}
