// Package metrics provides a Prometheus registry and helper methods for the
// magic-signer service.
package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Registry wraps prometheus registry + collectors.
type Registry struct {
	reg                 *prometheus.Registry
	requestsTotal       *prometheus.CounterVec
	requestDuration     *prometheus.HistogramVec
	magicAPIDuration    *prometheus.HistogramVec
	magicAPIErrors      *prometheus.CounterVec
	jwtCacheHits        *prometheus.CounterVec
	jwtCacheMisses      *prometheus.CounterVec
	addrCacheHits       *prometheus.CounterVec
	addrCacheMisses     *prometheus.CounterVec
	activeUsers         *prometheus.GaugeVec
}

// NewRegistry constructs a Registry with all collectors registered.
func NewRegistry(env string) *Registry {
	reg := prometheus.NewRegistry()
	r := &Registry{
		reg: reg,
		requestsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "magic_signer_requests_total",
			Help: "Total HTTP requests handled, by caller / op / status / env.",
		}, []string{"caller", "op", "status", "env"}),
		requestDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "magic_signer_request_duration_seconds",
			Help:    "Request duration in seconds.",
			Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5},
		}, []string{"caller", "op", "env"}),
		magicAPIDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "magic_signer_magic_api_duration_seconds",
			Help:    "Upstream Magic API duration in seconds.",
			Buckets: []float64{0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10},
		}, []string{"op", "env"}),
		magicAPIErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "magic_signer_magic_api_errors_total",
			Help: "Magic API errors by error_code.",
		}, []string{"error_code", "env"}),
		jwtCacheHits: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "magic_signer_jwt_cache_hits_total",
			Help: "JWT cache hits.",
		}, []string{"env"}),
		jwtCacheMisses: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "magic_signer_jwt_cache_misses_total",
			Help: "JWT cache misses (mints).",
		}, []string{"env"}),
		addrCacheHits: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "magic_signer_address_cache_hits_total",
			Help: "Address cache hits.",
		}, []string{"env"}),
		addrCacheMisses: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "magic_signer_address_cache_misses_total",
			Help: "Address cache misses (Magic calls).",
		}, []string{"env"}),
		activeUsers: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "magic_signer_active_users",
			Help: "Number of users with addresses cached in memory.",
		}, []string{"env"}),
	}

	reg.MustRegister(
		r.requestsTotal,
		r.requestDuration,
		r.magicAPIDuration,
		r.magicAPIErrors,
		r.jwtCacheHits,
		r.jwtCacheMisses,
		r.addrCacheHits,
		r.addrCacheMisses,
		r.activeUsers,
	)
	return r
}

// HTTPHandler returns the /metrics endpoint http.Handler.
func (r *Registry) HTTPHandler() http.Handler {
	return promhttp.HandlerFor(r.reg, promhttp.HandlerOpts{})
}

// ─── Counter / observer helpers (called from handlers) ───

func (r *Registry) AddrCacheHit(env string)  { r.addrCacheHits.WithLabelValues(env).Inc() }
func (r *Registry) AddrCacheMiss(env string) { r.addrCacheMisses.WithLabelValues(env).Inc() }
func (r *Registry) JWTCacheHit(env string)   { r.jwtCacheHits.WithLabelValues(env).Inc() }
func (r *Registry) JWTCacheMiss(env string)  { r.jwtCacheMisses.WithLabelValues(env).Inc() }

func (r *Registry) ObserveMagicLatency(env, op string, seconds float64) {
	r.magicAPIDuration.WithLabelValues(op, env).Observe(seconds)
}

func (r *Registry) MagicAPIError(env, code string) {
	r.magicAPIErrors.WithLabelValues(code, env).Inc()
}

func (r *Registry) SetActiveUsers(env string, n int) {
	r.activeUsers.WithLabelValues(env).Set(float64(n))
}
