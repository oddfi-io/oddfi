// Package client is the HTTP SDK for the magic-signer service.
//
// Other services (web-api, contracts-business-layer's relay, admin-svc,
// batch-job, etc.) import this package, construct a single *Client per
// process, and invoke WalletAddress / SignDigest. The client implements the
// Signer interface, so it can be injected anywhere a Signer is expected.
//
// Configuration:
//
//	cli, err := client.New(client.Config{
//	    BaseURL:   "https://magic-signer.svc.cluster.local",
//	    AuthToken: os.Getenv("MAGIC_SIGNER_TOKEN"),
//	    Timeout:   10 * time.Second,
//	})
//
// Behaviour:
//   - Does not cache addresses (service-side cache is authoritative)
//   - Does not retry by default (service already retries against Magic);
//     network-layer failures get one retry
//   - Auto-generates X-Request-ID if caller did not provide one
//   - All errors wrap one of the sentinel values defined in errors.go
package client
