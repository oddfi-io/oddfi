# 02 · 数据层 · api client / dataProvider / 错误码映射 / idempotency

> 契约：api.md §1.1（信封）、§1.2–§1.4（错误码）、§6.2（错误路由）、presale-admin §3（presale 错误码）、DD-003 §3.3/§4.3/§4.5（idempotency）。
> 规则：`.claude/rules/api-conventions.md`（请求收敛到 `lib/api.ts`、金额 string）。

---

## 1. 统一响应信封

api.md §1.1：所有响应 `{ code: 0 | "ERROR_STRING", message, data }`。

```ts
// src/types/api.ts
export interface ApiResponse<T> { code: number | string; message: string; data: T | null; }
export interface Paginated<T> { list: T[]; total: number; page?: number; page_size?: number; }

export class ApiError extends Error {
  constructor(
    public errorCode: string,   // 后端 code 字符串（前端按它分支，api.md §1.1）
    public statusCode: number,  // HTTP 状态
    message: string,
    public requestId?: string,  // X-Request-Id，报错时给用户
  ) { super(message); this.name = "ApiError"; }
}
```

**铁律**（api.md §1.1）：**按 `code` 字符串分支，不按 HTTP 码**。`code === 0`（数字）成功；否则按 UPPER_SNAKE 字符串处理。

---

## 2. ky client（`src/lib/api.ts`）

```ts
import ky from "ky";

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_BASE ?? "/", // dev: Vite proxy；prod: Nginx 同源
  timeout: 15000,
  retry: { limit: 2, methods: ["get"] }, // 只重试 GET；mutation 的重试由 idempotency 保证安全
  hooks: {
    beforeRequest: [
      (req) => {
        const token = localStorage.getItem("oddfi_admin_jwt");
        if (token) req.headers.set("Authorization", `Bearer ${token}`);
        // 串联前后端日志（api.md §4.4）
        if (!req.headers.has("X-Request-ID")) req.headers.set("X-Request-ID", crypto.randomUUID());
        // X-Idempotency-Key 不在这里设 —— 由调用方按 form 生命周期传入（见 §6）
      },
    ],
    afterResponse: [
      async (_req, _opts, res) => {
        // 兜底 401（Refine 流程外的请求，如 getIdentity 自身）
        if (res.status === 401) {
          localStorage.removeItem("oddfi_admin_jwt");
          if (!location.pathname.startsWith("/login")) window.location.href = "/login";
        }
      },
    ],
  },
});

// 统一拆信封：code!==0 抛 ApiError（dataProvider / hooks 都走这个）
export async function unwrap<T>(promise: Promise<Response>): Promise<T> {
  const res = await promise;
  const reqId = res.headers.get("X-Request-ID") ?? undefined; // 后端统一 X-Request-ID（header 名大小写不敏感）
  const replayed = res.headers.get("X-Replayed") === "true";   // 幂等重放标记（§4.5）
  const body = (await res.json()) as ApiResponse<T>;
  if (body.code !== 0) {
    throw new ApiError(String(body.code), res.status, body.message, reqId);
  }
  return body.data as T;
}
```

> `unwrap` 同时处理 HTTP 4xx/5xx（ky 默认对非 2xx throw `HTTPError`，需在 `unwrap` 外层 catch 转 `ApiError`；实现时统一封一个 `request<T>()` 包住 try/catch，把 `HTTPError` 的 body 也解析成 `ApiError`）。**不要**写 `res?.data?.list ?? []` 这种链式兜底（code-quality.md 禁止）。

---

## 3. dataProvider（信封 + 分页适配）

Refine 的 `@refinedev/simple-rest` **不认** `{code,message,data}` 信封，必须自定义。核心是**按 resource 适配分页参数名**（§README 偏差 4）。

```ts
// src/providers/dataProvider.ts
import type { DataProvider } from "@refinedev/core";
import { api, unwrap } from "@/lib/api";

// 分页参数名差异：admin-users 用 page/page_size；presale 用 page/size
const PAGE_PARAM: Record<string, { page: string; size: string }> = {
  "admin-users": { page: "page", size: "page_size" },
  // presale 资源默认 page/size
};
const sizeKeyOf = (r: string) => PAGE_PARAM[r] ?? { page: "page", size: "size" };

// resource → 后端路径段
const PATH: Record<string, string> = {
  rounds: "admin/presale/rounds",
  deposits: "admin/presale/deposits",
  anomaly: "admin/presale/anomaly",
  audit: "admin/presale/audit",
  "admin-users": "admin/admin-users",
};

export const dataProvider: DataProvider = {
  getList: async ({ resource, pagination, filters }) => {
    // ⚠️ Refine 6 的 Pagination 字段是 currentPage（不是 current）；用错永远停第 1 页。
    const { currentPage = 1, pageSize = 20 } = pagination ?? {};
    const pk = sizeKeyOf(resource);
    const searchParams = new URLSearchParams();
    // rounds 后端返回全部 6 轮、不分页（client/types.go ListRoundsResponse 无 page/size）→ 不传分页参数
    if (resource !== "rounds") {
      searchParams.set(pk.page, String(currentPage));
      searchParams.set(pk.size, String(pageSize));
    }
    // filters → query（round_id / status / operator / action / from_ts / to_ts ...，按 endpoint 文档）
    for (const f of filters ?? []) {
      if ("field" in f && f.value != null && f.value !== "") searchParams.set(f.field, String(f.value));
    }
    const data = await unwrap<{ list: any[]; total: number }>(
      api.get(PATH[resource], { searchParams }),
    );
    return { data: data.list, total: data.total };
  },

  getOne: async ({ resource, id }) => {
    // rounds/:id、anomaly/:id、admin-users 无 getOne；deposits/:txHash（id 即 txHash）
    const data = await unwrap<any>(api.get(`${PATH[resource]}/${id}`));
    return { data };
  },

  // admin-users create（POST），其它 presale 资源无 create
  create: async ({ resource, variables }) => {
    const data = await unwrap<any>(api.post(PATH[resource], { json: variables }));
    return { data };
  },

  // admin-users delete（DELETE /:lark_user_id）
  deleteOne: async ({ resource, id }) => {
    const data = await unwrap<any>(api.delete(`${PATH[resource]}/${id}`));
    return { data };
  },

  // 所有非 CRUD mutation（状态机/migrate/resolve/config/role）走 custom（见 hooks）
  custom: async ({ url, method, payload, headers }) => {
    const fn = (api as any)[method]; // post / patch
    const data = await unwrap<any>(fn(url, { json: payload, headers }));
    return { data };
  },

  getApiUrl: () => import.meta.env.VITE_API_BASE ?? "/",
  update: async () => { throw new Error("use useCustomMutation for presale mutations"); },
};
```

**presale config 单行资源**：不走 getList，用 `useCustom({ url: "admin/presale/config", method: "get" })`；PATCH 用 `useCustomMutation`（[`03-pages.md`](./03-pages.md) config 页）。

**mutation hooks 形态**（以 pause 为例，封装 idempotency + note）：

```ts
// src/hooks/useRoundActions.ts
import { useCustomMutation } from "@refinedev/core";

export function useRoundAction(roundId: string) {
  const { mutateAsync, mutation } = useCustomMutation();
  const run = (action: "pause"|"resume"|"reopen"|"close", note: string, idempotencyKey: string) =>
    mutateAsync({
      url: `admin/presale/rounds/${roundId}/${action}`,
      method: "post",
      values: { note },
      config: { headers: { "X-Idempotency-Key": idempotencyKey } },
    });
  return { run, loading: mutation.isLoading };
}
```

---

## 4. 错误码 → UI 提示映射表（全覆盖）

覆盖 api.md §1.2–§1.4 + presale-admin §3/§4.1 + DD-003 §4.5。**前端按 `code` 字符串分支**。建议集中到 `src/lib/errorMap.ts`，dataProvider/hooks 的 catch 统一查表。

> 文案为**中文 UI 提示**（内部工具中文界面）；**运行时 `console`/`Error` 用英文**（code-quality.md）。

### 4.1 鉴权 / 通用（api.md §1.2）

| code | HTTP | UI 动作 | 中文提示 |
|---|---|---|---|
| `0`(int) | 200 | 正常处理 data | — |
| `INVALID_PARAM` | 400 | 表单内联报错（不弹全局） | 「参数有误，请检查输入」+ 具体字段 |
| `INVALID_BODY` | 400 | 同上（web-api bind 错误，已确认见 round.go） | 「请求体格式有误」 |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | 不该发生（前端必带）；记日志 | 「请求缺少幂等键，请刷新重试」 |
| `UNAUTHORIZED` | 401 | 清 token → 跳 /login | 「登录已失效，请重新登录」 |
| `TOKEN_EXPIRED` | 401 | 清 token → 跳 /login | 「登录已过期，请重新登录」 |
| `TOKEN_INVALID` | 401 | 清 token → 跳 /login | 「登录凭证无效，请重新登录」 |
| `INSUFFICIENT_ROLE` | 403 | notification.error，**不跳转**，路由守卫切回 Dashboard | 「无权限执行此操作」 |
| `RATE_LIMITED` | 429 | 退避重试（指数，最多 3 次）+ 提示 | 「操作过于频繁，请稍候重试」 |
| `INTERNAL_ERROR` | 500 | 通用错误，附 `X-Request-Id` | 「服务异常，请稍后重试（追踪号：{reqId}）」 |

### 4.2 Lark OAuth（api.md §1.3，在 /login 页展示，来自 `#error=`）

| code | UI 动作 | 中文提示 |
|---|---|---|
| `NOT_ADMIN` | 展示「未授权」页，**不重试** | 「你的 Lark 账号不在运营后台白名单，请联系超级管理员添加」 |
| `LARK_STATE_MISMATCH` | 跳 /login，提供「重新登录」 | 「登录会话已过期，请重新发起登录」 |
| `LARK_EXCHANGE_FAILED` | 提供「重试」按钮 | 「Lark 授权服务异常，请重试」 |
| `LARK_USER_INFO_FAILED` | 提供「重试」按钮 | 「获取 Lark 用户信息失败，请重试」 |

### 4.3 admin-users CRUD（api.md §1.4）

| code | HTTP | UI 动作 | 中文提示 |
|---|---|---|---|
| `ADMIN_USER_EXISTS` | 400 | create 表单内联报错 | 「该 Lark 用户已是管理员」 |
| `ADMIN_USER_NOT_FOUND` | 404 | notification + 刷新列表 | 「目标管理员不存在（可能已被删除）」 |
| `LAST_SUPER_ADMIN` | 400 | 模态内报错，禁止提交 | 「不能降级/删除最后一个超级管理员」 |
| `CANNOT_REMOVE_SELF` | 400 | 删除按钮对自己禁用 + 报错 | 「不能删除当前登录的自己」 |

### 4.4 presale 业务（✅ 已从 web-api 源码核对真实 code 字符串）

> ⚠️ **admin-backend `docs/api.md` / `docs/presale-admin/README.md` 的几个 presale 错误码与 web-api 实现不符**（已逐行确认）。文档写的 `INVALID_TARGET_ROUND` / `VAULT_ADDRESS_INVALID` / `BLOCK_TIMESTAMP_NOT_IN_TARGET_ROUND` / `MIGRATE_ROUND_LIMIT_EXCEEDED` 在源码里**不存在或叫别的名字**。下表用**源码真值**（`oddfi-backend/web-api/internal/handler/admin/*.go` 的 `gin.H{"code"}`）。前端按字符串分支，码字必须与此一致。**联调时务必抓真实 4xx/5xx 响应再次校准，不要信 docs。**

| code | HTTP | 源 | UI 动作 | 中文提示 |
|---|---|---|---|---|
| `NOTE_REQUIRED` | 400 | admin-backend noteValidatorMW | 前端 AntD Form 校验应先拦；模态内报错 | 「操作备注至少 10 个字符」 |
| `INVALID_BODY` | 400 | web-api bind 失败 | 模态内就近报错（同 INVALID_PARAM） | 「请求体格式有误」 |
| `INVALID_PARAM` | 400 | web-api（含 **vault 地址非法**：UpdateConfig 所有 error 统一映射此码） | 表单/模态内联报错 | 「参数有误」/ vault 场景：「金库地址非法」 |
| `ROUND_NOT_FOUND` / `DEPOSIT_NOT_FOUND` / `ANOMALY_NOT_FOUND` | 404 | web-api | notification + 返回列表 | 「记录不存在或已变更」 |
| `INVALID_STATE_TRANSITION` | 409 | web-api round.go | 模态内报错 + 刷新轮次状态 | 「当前状态不允许此操作（如已结束的轮次不能暂停）」 |
| `MIGRATE_LIMIT_EXCEEDED` | **422** | deposit.go:152 | migrate 模态内报错，禁止再迁 | 「该入账迁移次数已达上限」 |
| `BLOCK_TIMESTAMP_OUT_OF_RANGE` | **422** | deposit.go:156 | migrate 模态内报错 | 「该入账区块时间不在目标轮次时间窗内（含容差），不能迁入」 |

**⚠️ 后端暂无专属码、会落 500 的 2 类失败**（已确认源码，前端靠预校验规避）：
- **migrate「目标轮不存在」**：web-api 返裸 error → `INTERNAL_ERROR`(500)。规避：`targetRoundId` 用下拉只列合法轮，不让手填。
- **anomaly「resolution 非法」**：同上 → `INTERNAL_ERROR`(500)。规避：`resolution` 固定单选枚举。
- 这两类「无专属 4xx 码」已列入 [`06-acceptance-and-tasks.md`](./06-acceptance-and-tasks.md) §4 缺口，建议给 backend 提 issue 加码。

### 4.5 idempotency（DD-003 §4.5，薄壳透传 web-api 内部码）

| code | HTTP | UI 动作 | 中文提示 |
|---|---|---|---|
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | 不该发生（前端必带）；记日志 + 通用错误 | 「请求缺少幂等键，请刷新重试」 |
| `IDEMPOTENCY_BODY_MISMATCH` | 409 | **轮换 idempotency_key** 后允许重试（§6） | 「请求内容已变更，请重新提交」 |

> **重放响应形状**（✅ 源码确认 `web-api/internal/middleware/idempotency.go:163,244`）：命中幂等缓存时，web-api 既 set header `X-Replayed: true`，**又往响应 JSON body 顶层注入 `_replayed: true` 和 `_original_request_id`**。
> - 前端解析响应时**容忍多出的 `_replayed`/`_original_request_id` 顶层字段**（TS interface 不做运行时严格校验，自然忽略多余字段即可）——重放恰好发生在「5xx/超时原样重试」路径（§6 主打场景）。
> - `unwrap`/`request` 层除了 `X-Request-Id` 也读一下 `X-Replayed`，命中时静默当成功（结果一致），可选 toast「该操作已执行过」。

**内部 5xx 码族**（web-api 基础设施错误，已确认存在）：`NO_TX` / `AUDIT_NO_TX` / `AUDIT_INSERT_FAILED` / `AUDIT_LINK_FAILED` / `IDEM_NO_TX` / `IDEM_LOOKUP_FAILED` / `IDEM_INSERT_FAILED` / `COMMIT_FAILED` / `BODY_READ_FAILED` / `SERVICE_SIG_INVALID`。前端**统一归 `INTERNAL_ERROR` 通用错误文案 + reqId**，不逐个写文案。

---

## 5. 全局 vs 局部错误展示原则

- **401/403/429/500/网络错** → 全局 `notification`（Refine `notificationProvider` 已配）。
- **业务校验错**（`INVALID_PARAM`、`*_NOT_FOUND`、`INVALID_STATE_TRANSITION`、idempotency、migrate 类）→ **就近**展示在触发它的模态/表单里，不弹全局（用户正在该上下文操作）。
- `INTERNAL_ERROR`/未知 code → 通用错误页/toast，**必须带 `X-Request-Id`** 供用户报障。

---

## 6. idempotency_key 生成 + 表单生命周期（DD-003 §3.3 反作弊核心）

**为什么**：薄壳 admin-backend 把请求转发给 web-api internal endpoint，web-api 用 `X-Idempotency-Key` 做"同一操作只执行一次"。key 还参与 admin-backend → web-api 的 HMAC 签名（DD-003 §4.2.1），所以 **key 与 body 绑定**：同 key 不同 body → web-api 返 `IDEMPOTENCY_BODY_MISMATCH`。

**生命周期规则**（DD-003 §3.3，**逐条照做**）：

| 时机 | 动作 |
|---|---|
| **表单/模态渲染时** | `useRef(crypto.randomUUID())` 生成一次，绑定本次 form session |
| **提交成功** | key 作废；form 重置/关闭，下次打开重新生成 |
| **提交失败 4xx**（用户要改 body 重试） | **轮换**：`ref.current = crypto.randomUUID()`。否则改了 body 用旧 key → 409 BODY_MISMATCH |
| **提交失败 5xx / 网络超时**（body 没变，安全重试） | **保持同 key** 重试 → 命中 web-api 幂等缓存，绝不重复执行 |

```ts
// src/hooks/useIdempotencyKey.ts —— 封装生命周期
import { useRef, useCallback } from "react";

export function useIdempotencyKey() {
  const keyRef = useRef<string>(crypto.randomUUID());
  const rotate = useCallback(() => { keyRef.current = crypto.randomUUID(); }, []);
  const get = useCallback(() => keyRef.current, []);
  return { get, rotate };
}
```

```ts
// 在 ConfirmMutationModal 提交里（要点示意，完整组件见 04-components.md）
const { get, rotate } = useIdempotencyKey();
async function submit(note: string) {
  try {
    await action(note, get()); // 带 X-Idempotency-Key: get()
    onSuccess();               // 成功 → 关闭模态（下次打开 useRef 重新生成）
  } catch (e) {
    const err = e as ApiError;
    if (err.statusCode >= 400 && err.statusCode < 500) {
      rotate();                // 4xx：用户会改 body → 轮换 key
    }
    // 5xx / 超时：不轮换，保持同 key（用户原样重试即命中幂等缓存）
    showInlineError(err);
  }
}
```

**反模式**（DD-003 明确禁止）：
- ❌ 每次点提交都 `crypto.randomUUID()` —— 破坏 5xx/超时重试的幂等保护，可能重复执行。
- ❌ 整个 app 共用一个 key —— 不同操作互相串扰。
- ❌ 把 key 放进 body —— 它是 header（`X-Idempotency-Key`），且参与 HMAC，必须 header 传。
