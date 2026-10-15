export type AppErrorOptions = {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly traceId?: string;
  readonly cause?: unknown;
};

/**
 * 调用流程：跨层传递基础设施或编程错误，并携带重试与 trace 元数据。
 * 入参：稳定错误码、可读错误信息、是否可重试、可选 traceId 和原始 cause。
 * 出参：供 HTTP、配置、LLM、迁移等适配器统一处理的 Error 子类。
 */
export class AppError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly traceId: string | undefined;
  override readonly cause: unknown;

  /**
   * 调用流程：构造应用错误，同时保留原始异常原因。
   * 入参：AppErrorOptions。
   * 出参：带 code、retryable、traceId 字段的 AppError 实例。
   */
  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.traceId = options.traceId;
    this.cause = options.cause;
  }
}
