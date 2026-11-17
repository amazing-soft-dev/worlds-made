'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { useEffect } from 'react';
import { initMonitoring } from '@/lib/monitoring';

/**
 * Cookie-light Vercel Web Analytics and Speed Insights, plus Sentry when configured. Production only: nothing here
 * runs in development or in tests, and there are no ad pixels or cross-site trackers.
 */
export function Monitoring() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') initMonitoring();
  }, []);

  if (process.env.NODE_ENV !== 'production') return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
