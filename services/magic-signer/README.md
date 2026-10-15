# magic-signer

Internal-only signing service + Go SDK wrapping Magic TEE Express.

Two artifacts in one repo:

| Artifact      | Path                | Purpose                                                              |
| ------------- | ------------------- | -------------------------------------------------------------------- |
| **Service**   | `cmd/server/`       | HTTP server. One deployment per environment (prod, test).            |
| **Client SDK**| `client/`           | Go package other services import (`magic-signer/client`) to call it. |

See [`DESIGN.md`](./DESIGN.md) for the full architecture rationale, constraints, and API spec.

---

## Quick start (local development)

```bash
# 1. Copy the template and fill in real values.
cp .env.example .env
# edit .env: set MAGIC_API_KEY, MAGIC_OIDC_PROVIDER_ID, OIDC_PRIVATE_KEY_PEM, CALLER_TOKEN_*

# 2. Run the service.
go run ./cmd/server
#   {"level":"info","msg":"magic-signer starting","env":"test","listen":":8443",...}
#   {"level":"info","msg":"listening","addr":":8443"}

# 3. Hit it.
curl -X POST http://localhost:8443/v1/wallet/address \
  -H "Content-Type: application/json" \
  -H "X-Service-Auth: Bearer <raw-token-matching-CALLER_TOKEN_*-sha256>" \
  -d '{"user_id":"alice"}'
```

## Using the SDK in another service

```bash
go get github.com/Crypto-Barrett/oddfi-magic-client/client
```

```go
import (
    "context"
    "log"
    "os"
    "time"

    magicclient "github.com/Crypto-Barrett/oddfi-magic-client/client"
)

func main() {
    cli, err := magicclient.New(magicclient.Config{
        BaseURL:   os.Getenv("MAGIC_SIGNER_URL"),     // e.g. https://magic-signer.svc.cluster.local
        AuthToken: os.Getenv("MAGIC_SIGNER_TOKEN"),   // raw token (not sha256)
        Timeout:   10 * time.Second,
    })
    if err != nil {
        log.Fatal(err)
    }

    addr, err := cli.WalletAddress(context.Background(), "user-123")
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("magic address: %s", addr.Hex())

    var digest [32]byte
    copy(digest[:], []byte("32-byte digest goes here..."))
    sig, err := cli.SignDigest(context.Background(), "user-123", digest)
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("signature: 0x%x", sig)
}
```

The `Client` implements `Signer`:

```go
type Signer interface {
    WalletAddress(ctx context.Context, userID string) (common.Address, error)
    SignDigest(ctx context.Context, userID string, digest [32]byte) (Signature, error)
}
```

So you can inject it anywhere a `Signer` is expected (e.g. into `contracts-business-layer`'s relay).

---

## API surface

| Method | Path                  | Auth required | Description                                   |
| ------ | --------------------- | ------------- | --------------------------------------------- |
| POST   | `/v1/wallet/address`  | ✅            | Lookup / create Magic EOA for `user_id`       |
| POST   | `/v1/wallet/sign`     | ✅            | Sign 32-byte digest with `user_id`'s key      |
| GET    | `/healthz`            | ❌            | Liveness + upstream Magic reachability        |
| GET    | `/version`            | ❌            | git_sha + build_time + env                    |
| GET    | `/metrics`            | ✅            | Prometheus metrics                            |

Auth header on all authenticated endpoints:

```
X-Service-Auth: Bearer <raw-token>
```

See `DESIGN.md` § 7 for full request/response formats and error codes.

---

## Hard requirements

- **Environment isolation**: `APP_ENV=prod` requires `MAGIC_API_KEY` to start
  with `pk_live_`; `APP_ENV=test` requires `pk_test_`. The service refuses to
  start otherwise. This is the last-line defense against deploying the wrong
  Magic app to the wrong environment.
- **Internal only**: bind to an internal interface, fronted by a K8s `ClusterIP`
  Service + NetworkPolicy. Do not expose to public load balancers.
- **Caller auth**: every business request must carry `X-Service-Auth: Bearer
  <token>` where the sha256 of `<token>` matches a `CALLER_TOKEN_*` env var.
- **Per-environment deployment**: one prod deployment + one test deployment.
  Do NOT try to multi-tenant within a single binary.

---

## Logging

Every request emits a single structured JSON log line on stdout containing:

```
ts, level, svc, env, request_id, caller, caller_ip, method, path,
status, duration_ms, user_id, op, digest_prefix, magic_latency_ms,
magic_status, cached, result, error_code
```

What we DON'T log (sensitive):

- ❌ OIDC JWT contents
- ❌ Full ECDSA signatures (only `digest_prefix` is logged, never sig bytes)
- ❌ Magic API key
- ❌ `X-Service-Auth` token

---

## Running tests

```bash
# Unit tests (all packages):
go test ./... -race -cover

# Integration tests (end-to-end with fake Magic + real client SDK):
go test ./integration_test/... -race -v
```

The integration tests are critical for verifying:

1. **Environment isolation**: same `user_id` in `prod` vs `test` produces
   different addresses.
2. **Signature recoverability**: signatures returned by the service can be
   `ecrecover`-ed back to the user's address.
3. **Auth flow**: missing / wrong tokens are rejected with 401.

---

## Building the container

```bash
docker build \
  --build-arg GIT_SHA=$(git rev-parse HEAD) \
  --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  -t magic-signer:dev .
```

---

## Deployment

See `deploy/k8s-prod.yaml` (and `k8s-test.yaml`) for K8s manifests with:
- `ClusterIP` service (internal-only)
- `NetworkPolicy` limiting ingress to known caller pods
- `APP_ENV` hardcoded into the Deployment spec (not configurable per pod)
- Secret-mounted Magic API key + OIDC private key + caller tokens

---

## License

Internal use only.
