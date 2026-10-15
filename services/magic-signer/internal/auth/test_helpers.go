package auth

import "context"

// contextWithAuthForTest injects an Authenticated value into ctx so that
// FromContext returns it. Used by tests in this package to bypass the
// Middleware while still exercising RequireOp and downstream handlers.
func contextWithAuthForTest(ctx context.Context, a Authenticated) context.Context {
	return context.WithValue(ctx, callerCtxKey, a)
}
