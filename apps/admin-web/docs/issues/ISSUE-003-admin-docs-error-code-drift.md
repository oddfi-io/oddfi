# ISSUE-003 · admin-backend `docs/` 的 presale 错误码与 web-api 源码脱节

- **状态**：Open
- **严重度**：Medium（文档债，但已导致本前端方案首版写错错误码）
- **类型**：文档 / 契约一致性
- **发现日期**：2026-05-27
- **主要仓库**：`oddfi-admin-backend`（`docs/`）
- **关联**：前端方案 `docs/spa-presale-admin/02-data-layer.md` §4.4（已按源码改正）

## 现象

`oddfi-admin-backend` 的 `docs/api.md` 与 `docs/presale-admin/README.md` 列的若干 presale 错误码，与 `oddfi-backend/web-api` 的实际实现（`gin.H{"code": "..."}`）**不一致**——有的码名拼错，有的码根本不存在。前端 / AI 协作者照 docs 写错误码分支会全部失效（前端按 `code` 字符串硬匹配）。

## 逐条对照（docs 写的 vs web-api 源码真值）

| docs 位置 | docs 写的 | web-api 源码实际 | 证据 |
|---|---|---|---|
| `api.md:573` | `MIGRATE_ROUND_LIMIT_EXCEEDED` | `MIGRATE_LIMIT_EXCEEDED`（**422**） | `web-api/internal/handler/admin/deposit.go:152` |
| `presale-admin/README.md:103` | `BLOCK_TIMESTAMP_NOT_IN_TARGET_ROUND`（422） | `BLOCK_TIMESTAMP_OUT_OF_RANGE`（422） | `deposit.go:156` |
| `presale-admin/README.md:101` | `INVALID_TARGET_ROUND`（400） | **不存在**；「目标轮不存在」裸 error → `INTERNAL_ERROR`（500）（见 ISSUE-002） | service `presale_admin_deposit.go:162` |
| `presale-admin/README.md:102` | `VAULT_ADDRESS_INVALID`（400） | **不存在**；vault 非法 → `INVALID_PARAM`（400，统一映射） | handler `config.go:113` |

> 另外 `presale-admin/README.md §4.1` 用的是**数字码**（`40010` / `40301` 等），而 `api.md §1.x` 和 web-api 实际用的是**字符串码**（`NOTE_REQUIRED` / `INSUFFICIENT_ROLE`）。两套并存也会误导，建议统一为字符串码（与 api.md §1.1「按 code 字符串分支」一致）。

## 影响

- 前端 / 其它 AI 协作者按 docs 写 `errorMap`，运行时永远匹配不上真实 code → 就近报错分支静默失效，用户看到通用错误。
- 本前端方案首版就因抄 docs 写错了这 4 个码，对照源码后才修正——下一个读 docs 的人会重复踩坑。

## 建议修复

1. 把 `api.md` §1.x / §3.10 + `presale-admin/README.md` §3/§4 的 presale 错误码全部对齐 web-api 源码真值（见本目录 `README.md` 附录的"真实错误码全集"）。
2. 数字码统一改成字符串码。
3. 若同时做 ISSUE-002（补 4xx 码），docs 一并补上新码。
4. 建议在两仓库间加一条约定：web-api 改 `internal/handler/admin/*.go` 的 `gin.H{"code"}` 时，同 PR 同步 admin-backend docs（admin-backend 已有 `.claude/rules/api-docs-required.md` 类似机制，可扩展覆盖 presale 转发码）。

## 验收

- [ ] `api.md` / `presale-admin/README.md` 的 presale 错误码与 `web-api/internal/handler/admin/*.go` 逐一对齐（码字符串 + HTTP 状态）。
- [ ] 无数字码残留。
