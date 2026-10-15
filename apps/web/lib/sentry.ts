import * as Sentry from "@sentry/nextjs"

// Set user context after wallet connection
export function setSentryUser(address: string, tier: string) {
  Sentry.setUser({ id: address })
  Sentry.setTag("user.tier", tier)
}

// Capture betting errors with business context
export function captureBetError(
  error: Error,
  context: {
    matchId: string
    odds: string
    amount: string
    phase: string
  }
) {
  Sentry.withScope((scope) => {
    scope.setTag("domain", "betting")
    scope.setTag("bet.phase", context.phase)
    scope.setContext("bet_details", context)
    Sentry.captureException(error)
  })
}

// Clear user context on wallet disconnect
export function clearSentryUser() {
  Sentry.setUser(null)
}

// Capture balance anomaly (fatal level)
export function captureBalanceAnomaly(context: {
  preBalance: string
  postBalance: string
  expectedDelta: string
  operation: "bet" | "deposit" | "withdraw"
}) {
  Sentry.withScope((scope) => {
    scope.setLevel("fatal")
    scope.setTag("domain", "balance")
    scope.setContext("balance_anomaly", context)
    Sentry.captureMessage("Balance invariant violation")
  })
}
