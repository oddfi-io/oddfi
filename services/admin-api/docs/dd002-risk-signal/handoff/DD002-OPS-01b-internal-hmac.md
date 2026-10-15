# DD002-OPS-01b · 核实/合并 web-api internal HMAC 骨架

> 方案：[`../DD.md`](../DD.md) §1.1 / C-Arch-1
> 索引：[`../process/README.md`](../process/README.md)
> 前置：无
> 下游：OPS-01c（五端点挂在此骨架下）
> ⚠️ 仓库：`~/work/oddfi-backend/web-api`（C 端侧协作交付）

## 目标

review 发现：admin-backend 依赖的 internal HMAC 校验中间件 `service_auth.go` **只存在于未合并的 worktree** `web-api/.claude/worktrees/presale-impl/`，主干 dev 分支 `internal/middleware/` 无此文件、router 无 `/internal/admin/*` 注册。OPS-01c 之前必须把骨架立起来。

## 操作步骤

1. **核实**：presale internal（DD-003 B6 改造对应的 web-api 侧）当前到底在哪个分支/是否已部署？
   - 已合并/已部署 → 本 task 仅登记结论即关闭
   - 未合并 → 走第 2 步
2. 把 presale-impl worktree 中的最小骨架合入主干：`middleware/service_auth.go`（HMAC-SHA256 验签：`payload = ts:path:idempotencyKey:hex(sha256(body))`，与 admin-backend `webapi.go:237-243` ComputeServiceSig 逐字对齐）+ `/internal/admin` 路由组注册 + `service_token` 配置项
3. 验签失败统一 401；时间戳容差、重放窗口按 presale-impl 既有实现
4. Nginx/安全组确认：`/internal/*` 仅放行 admin-server IP（<SERVER_IP>），公网不可达

## 验收 checklist

- [ ] 主干分支存在 service_auth 中间件 + `/internal/admin` 路由组
- [ ] 用 admin-backend client 实发一条带签请求 → 200；篡改 body / 过期 ts / 错 secret → 401
- [ ] 公网直接 curl `/internal/admin/*` → 不可达（Nginx 404 或安全组拒绝）
- [ ] presale internal 端点（若同批合并）回归不破

## 注意

- secret 配置走环境变量/yaml，**不进 git、不进日志**
- 若 presale-impl worktree 与主干已漂移，以主干为基底 cherry-pick，不整支合并
