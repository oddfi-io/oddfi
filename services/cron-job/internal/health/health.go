package health

import (
	"encoding/json"
	"net/http"

	"oddfi-cron-job/internal/logger"
	"oddfi-cron-job/internal/scheduler"
)

// Handler 健康检查处理器
type Handler struct {
	scheduler *scheduler.Scheduler
}

// NewHandler 创建健康检查处理器
func NewHandler(s *scheduler.Scheduler) *Handler {
	return &Handler{
		scheduler: s,
	}
}

// HealthResponse 健康检查响应
type HealthResponse struct {
	Status    string `json:"status"`
	TaskCount int    `json:"task_count"`
	Uptime    string `json:"uptime,omitempty"`
}

// ServeHTTP 处理健康检查请求
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	statusCode := http.StatusOK
	response := HealthResponse{
		Status:    "healthy",
		TaskCount: h.scheduler.GetTaskCount(),
	}

	// 检查调度器是否正常
	if h.scheduler.GetTaskCount() == 0 {
		statusCode = http.StatusServiceUnavailable
		response.Status = "unhealthy"
	}

	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(response)
}

// MetricsHandler 指标处理器（简化版，如果需要可扩展为Prometheus）
type MetricsHandler struct {
	scheduler *scheduler.Scheduler
}

// NewMetricsHandler 创建指标处理器
func NewMetricsHandler(s *scheduler.Scheduler) *MetricsHandler {
	return &MetricsHandler{
		scheduler: s,
	}
}

// ServeHTTP 返回简单的任务统计
func (h *MetricsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	metrics := map[string]interface{}{
		"task_count": h.scheduler.GetTaskCount(),
		"tasks":      h.getTaskNames(),
	}

	json.NewEncoder(w).Encode(metrics)
}

// getTaskNames 获取所有任务名称
func (h *MetricsHandler) getTaskNames() []string {
	registry := h.scheduler.GetTaskRegistry()
	tasks := registry.List()
	names := make([]string, len(tasks))
	for i, t := range tasks {
		names[i] = t.Name()
	}
	return names
}

// StartServer 启动健康检查服务器
func StartServer(port string, s *scheduler.Scheduler) error {
	handler := NewHandler(s)
	metricsHandler := NewMetricsHandler(s)

	mux := http.NewServeMux()
	mux.Handle("/health", handler)
	mux.Handle("/metrics", metricsHandler)
	mux.Handle("/", http.DefaultServeMux) // 根路径返回简单信息

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	logger.Infof("Health check server starting on %s", server.Addr)

	// 在goroutine中启动服务器
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Errorf("Health check server error: %v", err)
		}
	}()

	return nil
}
