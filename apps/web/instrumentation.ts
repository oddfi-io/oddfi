import * as Sentry from "@sentry/nextjs";

// Next.js 15 onRequestError hook — captures Server Component / Route Handler errors
export const onRequestError = Sentry.captureRequestError;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      enabled: process.env.VERCEL_ENV === "production",
      tracesSampleRate: 0.5,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      enabled: process.env.VERCEL_ENV === "production",
      tracesSampleRate: 0.5,
    });
  }
}
