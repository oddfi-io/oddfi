// 后端统一响应信封 + 错误类型（契约：02-data-layer.md §1，api.md §1.1）。
// 铁律：按 `code` 字符串分支，不按 HTTP 状态码。code === 0（数字）成功；否则按 UPPER_SNAKE 字符串处理。

export interface ApiResponse<T> {
  code: number | string;
  message: string;
  data: T | null;
}

// 分页响应形状。page/size 各资源命名不同（presale 用 size，admin-users 用 page_size），
// 这里两种可选键都列出，dataProvider 只取 list/total。
export interface Paginated<T> {
  list: T[];
  total: number;
  page?: number;
  size?: number;
  page_size?: number;
}

// 统一业务/网络错误。前端按 errorCode（后端 code 字符串）分支处理。
// 注：tsconfig 开了 erasableSyntaxOnly，不能用构造器参数属性简写，需显式声明字段。
export class ApiError extends Error {
  errorCode: string; // 后端 code 字符串（UPPER_SNAKE）
  statusCode: number; // HTTP 状态
  requestId?: string; // X-Request-ID，报错时给用户做追踪号

  constructor(errorCode: string, statusCode: number, message: string, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}
