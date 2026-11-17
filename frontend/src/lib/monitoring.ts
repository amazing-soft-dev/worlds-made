import type * as SentryNs from '@sentry/browser';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

type SentryModule = typeof SentryNs;
let loaded: Promise<SentryModule | null> | null = null;

/** Loads Sentry only when a DSN is configured, so nobody pays for it otherwise. */
function sentry(): Promise<SentryModule | null> {
  if (!dsn) return Promise.resolve(null);
  loaded ??= import('@sentry/browser')
    .then((S) => {
      S.init({
        dsn,
        environment: process.env.NODE_ENV,
        // No personal data: the SDK sends none by default, and beforeSend strips what remains. No replay, no tracing.
        tracesSampleRate: 0,
        beforeSend(event) {
          delete event.user;
          if (event.request) {
            delete event.request.cookies;
            delete event.request.headers;
          }
          return event;
        },
      });
      return S;
    })
    .catch(() => null);
  return loaded;
}

export function initMonitoring(): void {
  void sentry();
}

/** Reports an error that the UI has already handled for the visitor. Never throws. */
export function reportError(error: unknown): void {
  void sentry().then((S) => S?.captureException(error));
}
