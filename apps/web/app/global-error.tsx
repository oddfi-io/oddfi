"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-primary">
          <div className="text-center">
            <h2 className="mb-4 text-xl font-semibold text-primary">Something went wrong</h2>
            <button
              onClick={reset}
              className="min-h-[44px] rounded-8 bg-fn-brand px-6 py-3 text-static-black"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
