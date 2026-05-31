import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Replays uniquement en prod pour économiser le quota
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Ne pas logger les erreurs réseau offline (normales pour un POS offline-first)
  beforeSend(event) {
    if (event.exception?.values?.[0]?.value?.includes('Failed to fetch')) {
      return null
    }
    return event
  },

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
})
