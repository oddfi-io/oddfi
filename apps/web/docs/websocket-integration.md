# WebSocket 接入范式（前端）

> 给后续接入新 WS 服务（账户余额推送 / 赔率推送 / 订单簿等）的同学一份"复制粘贴"模板。
> 首个实现：tx_status（DD-101），代码位于 `lib/ws/`。

---

## 1. 何时该用 WS（不要为推送而推送）

- ✅ 终态广播：服务端有明确终态语义、推送 1–N 条就结束（如交易回执）
- ✅ 低延迟数据流：行情 / 赔率 / 订单簿，每秒数十条以上更新
- ✅ 主动通知：账户余额变更、订单状态翻牌、好友消息

不要用 WS：

- ❌ 查询型 API（一次性返回）→ REST
- ❌ 每分钟少于 1 次的"低频心跳" → REST 轮询 + jitter 反而更稳

---

## 2. 协议形状评估（决定走哪条路）

| 形状                | 例子                      | 模板                                               |
| ------------------- | ------------------------- | -------------------------------------------------- |
| JSON-RPC 风格       | tx_status（DD-101）       | 套用 `lib/ws/client.ts`（auth + 请求-响应 + push） |
| 主题广播            | K 线推送（`useBnbKline`） | 参考 `hooks/useBnbKline.ts`（无 auth、单一主题）   |
| 自定义二进制 / 私有 | 行情 binary frame         | 单独写，但仍按本范式做 lifecycle / 重连 / 鉴权     |

**关键判断**：服务端是否需要鉴权 + 是否半双工请求-响应。两者都是 → JSON-RPC；都不是 → 主题广播；混合 → 套 JSON-RPC 骨架再加 event 字段。

---

## 3. env 命名规则（强制）

```
NEXT_PUBLIC_WS_<SERVICE>_URL
```

例：

| 服务    | env 名                     | dev/local                                                                | prod                      |
| ------- | -------------------------- | ------------------------------------------------------------------------ | ------------------------- |
| K 线    | `NEXT_PUBLIC_WS_KLINE_URL` | `wss://market-api.oddfi.io/ws`                                           | 同 dev                    |
| Tx 状态 | `NEXT_PUBLIC_WS_TX_URL`    | `wss://ws-dev.oddfi.io/ws` ⏳（临时本地 `ws://<SERVER_IP>:19090/ws`） | `wss://ws.oddfi.io/ws` ⏳ |

**缺失值的处理**：必须**显式抛错或返回明确"已禁用"信号**，让消费方走降级。**严禁静默连接**（DD-090 类 bug 的根源）。tx-ws 用 `WsDisabledError`，参考 `lib/ws/config.ts`：

```typescript
import { WsDisabledError } from "@/lib/ws/types";

export function getTxWsConfig(): { url: string } {
  const url = process.env.NEXT_PUBLIC_WS_TX_URL?.trim() ?? "";
  if (!url) throw new WsDisabledError("tx");
  return { url };
}
```

---

## 4. 生产部署 Checklist（wss / nginx / CDN）

参考 DD-101 §6：

- [ ] 浏览器侧必须 `wss://`（HTTPS 页面 Mixed Content 策略硬性禁止 ws://）
- [ ] 反向代理（nginx）配置：
  - `proxy_pass http://<upstream>:<port>`
  - `proxy_http_version 1.1`
  - `proxy_set_header Upgrade $http_upgrade`
  - `proxy_set_header Connection "upgrade"`
  - `proxy_read_timeout 3600s`
  - `proxy_buffering off`
- [ ] **不放在 Cloudflare 强缓存层后面**（会破坏长连接）
- [ ] 域名归属决策：**独立 ws 子域**（业内主流：Binance/Coinbase/OKX/Pusher/Centrifugo 都用独立子域）
  - dev: `wss://ws-dev.oddfi.io/ws` → A 记录指向 `<SERVER_IP>`
  - prod: `wss://ws.oddfi.io/ws` → A 记录指向 prod ws 服务器
  - 优点：故障域清晰、cert/nginx 配置独立、未来多 ws 服务（余额/赔率推送）按路径分包
  - DNS 已配（2026-05-13）；TLS + nginx 待后端落地

---

## 5. 单例 manager + React hook 双层模式

- **底层 manager**（`lib/ws/<service>.ts`）：单例，命令式 API（`subscribe(key)` / `unsubscribe(key)`），返回 Promise。
- **上层 hook**（`hooks/use<Service>.ts`）：包装 manager，4 态状态机 `idle | subscribing | settled | error`，组件订阅 hook，hook 处理 unmount cleanup。

**为什么分两层**：

- 命令式底层可以在非 React 上下文使用（worker / setup 阶段）
- React hook 只负责"绑定到组件生命周期"，不重复实现连接 / 重连 / 鉴权逻辑

模板：`lib/ws/tx-ws.ts` + `hooks/useTxStatus.ts`。

---

## 6. 鉴权约定

复用 REST 的 access_token：

```typescript
import { useAuthStore } from "@/stores/authStore";
import { doRefreshSingleton } from "@/lib/api";

new WsClient({
  url,
  getAccessToken: () => useAuthStore.getState().accessToken,
  onAuthFailed: () => doRefreshSingleton(),
  ...
});
```

**Token 失效自愈两级策略**（client.ts 内置）：

1. **L1**：服务端返回 40103（token expired）→ 调 `onAuthFailed()` 刷新 → 在**原连接**重发 `auth` 覆盖 claims → 重试失败的请求
2. **L2**：L1 任一步失败 → close socket → 走重连流程

40102（invalid）/ 40104（revoked）→ 直接走 L2（用户需重新登录）。

---

## 7. 重连恢复约定（单一发送入口）

- `WsClient` 暴露 `onStateChange((state) => ...)`，每次 `reconnecting → ready` 业务层批量重订阅。
- 业务层（如 `TxWsManager`）维护 `activeSubs: Set<string>`，**所有 subscribe RPC 都走同一个发送入口**（`sendSubscribe`），cold start 和 reconnect 共享，避免并行重复发送（详见 `tx-ws.ts` 注释）。

---

## 8. 测试模板

使用 mock WebSocket（不依赖 jsdom）：

```typescript
// MockWebSocket — 完整模板见 lib/ws/client.test.ts
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent<string>) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new Event("close") as CloseEvent);
  }
  serverOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }
  serverSend(payload: object) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(payload) }));
  }
}

// 注入：
new WsClient({ ..., webSocketCtor: MockWebSocket as unknown as typeof WebSocket });
```

**关键技巧**：

- 使用 `vi.useFakeTimers()` 控制重连退避 / 超时
- **不要**用 `vi.runOnlyPendingTimersAsync()` —— 会同时触发 60s liveness 定时器引起死循环；改用纯微任务 flush：

  ```typescript
  async function flush() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  }
  ```

- 为 manager 暴露 `livenessTimeoutMs` 测试 seam，让 lifecycle 测试可以隔离 liveness 干扰

---

## 9. 运维约定

- **Sentry tag**：`ws.service`（如 `tx` / `kline`）— 排查链路问题时按服务过滤
- **慢消费者日志**：服务端 256 条积压踢连接前的告警，前端 onmessage 内**禁止 await 长任务**（只做 `JSON.parse + dispatch`）
- **断线统计**：通过 `onStateChange` 监听并上报 `reconnecting` 事件数 / 平均重连时长

---

## 10. 反模式速查

| ❌ 反模式                                        | ✅ 正确做法                                           |
| ------------------------------------------------ | ----------------------------------------------------- |
| env 缺失静默回落到默认值                         | 显式抛 `WsDisabledError`，消费方降级                  |
| 在 onmessage 里 `await` 业务逻辑（阻塞）         | 同步 parse + dispatch，业务异步处理                   |
| 每个 hook 自己建连接                             | 单例 manager + hook 包装                              |
| 收到 40103 直接清 session                        | 先尝试 L1 原连接 refresh，失败才走 L2                 |
| 重连后业务层全量重新 mount                       | manager 维护 `activeSubs`，ready 时批量恢复，组件无感 |
| Token 失效 / 服务端拒绝 = 一律重连               | 区分错误码：40103→L1，40102/40104→logout，其他→重连   |
| WS 完全替换 wagmi `useWaitForTransactionReceipt` | Phase 1 并行 A/B 对照，Phase 2 才合并                 |

---

## 11. 参考实现

- `lib/ws/types.ts` — 协议类型 + 错误码常量
- `lib/ws/client.ts` — 通用 WsClient（auth / 重连 / token 自愈）
- `lib/ws/tx-ws.ts` — TxWsManager 单例 + facade
- `lib/ws/config.ts` — env 读取 + WsDisabledError
- `hooks/useTxStatus.ts` — React hook 包装
- 测试：`lib/ws/client.test.ts` / `lib/ws/tx-ws.test.ts` / `hooks/useTxStatus.test.ts`
- 设计文档：`.progress/designs/DD-101-websocket-integration.md`
- 后端协议文档：[【接口文档】ws服务文档](https://ygb8h37py5b.sg.larksuite.com/wiki/BIH5wepWpir7Wfkxma5l7Tl9gWc)
