# 接口模糊测试规约（V3 · 模型 B）

> 契约源真值：[02-api-contract.md §2](../02-api-contract.md)（错误码）、[02-api-contract.md §5](../02-api-contract.md)（限流）、[03-admin-api-contract.md §2](../03-admin-api-contract.md)（RBAC 矩阵）。
> V3 砍掉：`/order/create`、`/claim`、`/claim/nonce`、`/tx/list`（改 `/deposit/list`）；邀请系统路径改为 `/api/v1/referral/*`。
> 工具：Go fuzz（`testing.F`）+ `httpexpect`；admin 角色 fuzz 用笛卡儿积脚本。
> 用例 ID 格式：`FUZZ-<接口>-<seq>`。

---

## 通用约束（每个接口必过）

| 维度 | 测试点 | 期望 |
|---|---|---|
| Content-Type | 非 JSON / 缺失 / `text/plain` | 400 |
| Body | 空 body / 单字节 `x` / 1MB 随机 / 嵌套 100 层 JSON | 400 / 413 |
| JSON 格式 | 重复 key / 异常 unicode（`\uD800`） / BOM 头（`\xEF\xBB\xBF`） | 400 |
| 必填字段 | 缺字段 / `null` / 空字符串 `""` | 400 |
| 数字字段 | 负数 / 0 / `Infinity` / `NaN` / 科学计数法 `1e100` / 极小 `0.000000000000000001` | 400 |
| 字符串长度 | 超长 1MB / 含 null byte `\x00` / 控制字符 / unicode 4 字节（emoji） | 400 |
| Headers | 缺 Authorization / 伪造 JWT / 过期 JWT / 重复 header | 401 / 400 |
| 注入 | SQL 注入 `' OR 1=1 --` / XSS `<script>alert(1)</script>` / 路径穿越 `../../../etc/passwd` / log4j `${jndi:ldap://...}` | 400；DB 0 写入；无 panic |
| 限流 | 超过 QPS 限制 | 429 |
| 响应 | 任何输入不得返回 5xx / panic / DB error log | — |

---

## §FUZZ-REPORT-TX：POST /api/v1/presale/deposit/report-tx

> 参见 [02-api-contract.md §3.2](../02-api-contract.md)；限流 10 req/min/user。

### 字段 corpus

| ID | 字段 | 测试输入 | 期望 |
|---|---|---|---|
| FUZZ-RT-01 | `txHash` | 空字符串 `""` | 400 |
| FUZZ-RT-02 | `txHash` | 65 字符（少 1） | 400 |
| FUZZ-RT-03 | `txHash` | 67 字符（多 1） | 400 |
| FUZZ-RT-04 | `txHash` | 66 字符但前缀非 `0x` | 400 |
| FUZZ-RT-05 | `txHash` | `0x` + 64 位大写 HEX | 后端 RPC 查不到 → `40006 INVALID_TX` |
| FUZZ-RT-06 | `txHash` | `0x` + 64 位非 hex 字符（含 `ZGH`） | 400 |
| FUZZ-RT-07 | `txHash` | `0x` + 64 位 `' OR 1=1 --` 补零 | 400；DB 0 写入 |
| FUZZ-RT-08 | `txHash` | `0x` + 64 位 `<script>alert(1)</script>` 截断 | 400 |
| FUZZ-RT-09 | `txHash` | null | 400 |
| FUZZ-RT-10 | `txHash` | 1MB 随机字符串 | 413 / 400 |
| FUZZ-RT-11 | `expectedRoundId` | 不存在的 round（`"unknown_round"`） | 后端仍处理（字段可选）；实际入账后 anomaly `round_mismatch` |
| FUZZ-RT-12 | `expectedRoundId` | `' OR 1=1 --` | 400 或正常处理（GORM 参数化，无注入） |
| FUZZ-RT-13 | `expectedRoundId` | null / 缺字段 | 正常处理（可选字段）；无 anomaly 触发（仅用于辅助检测） |
| FUZZ-RT-14 | `expectedAmountUsdt` | `"0"` | 400（金额不合理） |
| FUZZ-RT-15 | `expectedAmountUsdt` | `"-1"` | 400 |
| FUZZ-RT-16 | `expectedAmountUsdt` | `"NaN"` | 400 |
| FUZZ-RT-17 | `expectedAmountUsdt` | `"Infinity"` | 400 |
| FUZZ-RT-18 | `expectedAmountUsdt` | `"1e100"`（超大数） | 400 |
| FUZZ-RT-19 | `expectedAmountUsdt` | `"1000.0000000000000000001"`（精度极高） | 接受并截断到 USDT 精度；不 panic；用 `Decimal.Cmp` 比较 |
| FUZZ-RT-20 | `expectedAmountUsdt` | null / 缺字段 | 正常处理（可选字段） |
| FUZZ-RT-21 | 整体 | 并发 11 req/min（超限流 10） | 第 11 个 429；前 10 个正常处理 |
| FUZZ-RT-22 | 整体 | 无 JWT / 伪造 JWT | 401 |

### Go fuzz 示例

```go
//go:build fuzz

func FuzzReportTx(f *testing.F) {
    f.Add("0x" + strings.Repeat("a", 64), "seed", "1000")
    f.Add("", "", "")
    f.Add("0x" + strings.Repeat("z", 64), "' OR 1=1 --", "-1")
    f.Fuzz(func(t *testing.T, txHash, roundId, amount string) {
        req := map[string]any{
            "txHash":             txHash,
            "expectedRoundId":    roundId,
            "expectedAmountUsdt": amount,
        }
        resp := httpClient.POST("/api/v1/presale/deposit/report-tx").
            WithJSON(req).WithHeader("Authorization", validJWT).Expect()
        if resp.Raw().StatusCode >= 500 {
            t.Fatalf("5xx: txHash=%s roundId=%s amount=%s", txHash, roundId, amount)
        }
    })
}
```

跑：`go test ./internal/handler -fuzz=FuzzReportTx -fuzztime=5m -tags=fuzz`

---

## §FUZZ-BIND：POST /api/v1/referral/bind

> 参见 [02-api-contract.md §3.7](../02-api-contract.md)；限流 5 req/min/user。

| ID | 字段 | 测试输入 | 期望 |
|---|---|---|---|
| FUZZ-BIND-01 | `code` | 空字符串 | 400 |
| FUZZ-BIND-02 | `code` | 1 字符 `"A"` | `40404 INVALID_CODE`（格式不符）或 400 |
| FUZZ-BIND-03 | `code` | 6 字符（缺 `0x` 前缀） | `40404 INVALID_CODE` |
| FUZZ-BIND-04 | `code` | 8 字符合法格式 `"0xH7K9X2"` 但不存在 | `40404 INVALID_CODE` |
| FUZZ-BIND-05 | `code` | 66 字符（超长） | 400 |
| FUZZ-BIND-06 | `code` | `"' OR 1=1 --"` | 400；DB 0 写入；无 SQL 执行异常 |
| FUZZ-BIND-07 | `code` | `"<script>alert(1)</script>"` | 400（XSS 输入不存储不反射） |
| FUZZ-BIND-08 | `code` | `"%00"` / null byte | 400 |
| FUZZ-BIND-09 | `code` | 含换行 `"0xH7K\nINSERT ..."` | 400 |
| FUZZ-BIND-10 | `code` | 含 unicode 中文 `"0x中文XX"` | 400 |
| FUZZ-BIND-11 | `code` | 大写 `"0xH7K9X2"`（正确格式） | 若存在则绑定；若不存在 `40404` |
| FUZZ-BIND-12 | `code` | 小写 `"0xh7k9x2"`（大小写归一） | 后端 toUpper 后查询，结果同上 |
| FUZZ-BIND-13 | `source` | `"link"` / `"manual"` | 正常 |
| FUZZ-BIND-14 | `source` | `"evil"` / `""` / null / `123` | 接受（仅埋点字段）或 400；不影响业务 |
| FUZZ-BIND-15 | `business` | `"presale"` | 正常 |
| FUZZ-BIND-16 | `business` | 超长 1000 字符 | 400 |
| FUZZ-BIND-17 | 整体 | 同用户并发 6 req（超限流 5） | 第 6 个 429 |
| FUZZ-BIND-18 | 整体 | 自己的邀请码 | `40004 SELF_REFERRAL` |

---

## §FUZZ-CONFIG：GET /api/v1/presale/config

> 参见 [02-api-contract.md §3.1](../02-api-contract.md)；无入参；CDN 缓存 30s + Redis 缓存。

| ID | 场景 | 期望 |
|---|---|---|
| FUZZ-CFG-01 | 100 QPS 持续 30s | Redis 命中率 > 95%；DB QPS < 5；无雪崩；所有响应 200 |
| FUZZ-CFG-02 | 携带随机 query string（`?foo=bar&id=1`） | 忽略无关参数，正常返回 200 |
| FUZZ-CFG-03 | 超大 Cookie / Header | 400 / 431（不处理过大头） |
| FUZZ-CFG-04 | 超 30 req/min/IP（CDN 兜底限流） | 429 |
| FUZZ-CFG-05 | 公开接口（无 JWT）正常访问 | 200，不需要鉴权 |
| FUZZ-CFG-06 | Vary header | 无 `Vary: Cookie`（不应按用户分桶 CDN） |

---

## §FUZZ-DEPOSIT-LIST：GET /api/v1/presale/deposit/list

> 参见 [02-api-contract.md §3.4](../02-api-contract.md)。

| ID | 字段 | 测试输入 | 期望 |
|---|---|---|---|
| FUZZ-DL-01 | `page` | -1 / 0 / `"abc"` / `"1.5"` | 400 或默认 1 |
| FUZZ-DL-02 | `page` | 99999999 | 空列表，无 panic，无全表扫描 |
| FUZZ-DL-03 | `size` | -1 / 0 | 400 或默认 20 |
| FUZZ-DL-04 | `size` | 101（超上限 100） | 400 或截断为 100 |
| FUZZ-DL-05 | `size` | `"abc"` / null | 400 或默认 20 |
| FUZZ-DL-06 | `status` | `"confirmed"` / `"anomaly"` / `"pending"` | 正常筛选 |
| FUZZ-DL-07 | `status` | `"evil"` / `"' OR 1=1 --"` | 400；无 SQL 注入 |
| FUZZ-DL-08 | 整体 | 无 JWT | 401 |

---

## §FUZZ-ADMIN：admin-backend 接口角色 fuzz（笛卡儿积）

> 参见 [03-admin-api-contract.md §2](../03-admin-api-contract.md) RBAC 矩阵。
> 测试矩阵：4 角色 × 全部 presale admin 接口（17 个）= 68 组。

### 角色枚举

| 角色 | 标记 |
|---|---|
| `super_admin` | SA |
| `operator` | OP |
| `customer_service` | CS |
| `finance` | FI |

### RBAC 矩阵 fuzz 表

| ID | 接口 | SA | OP | CS | FI |
|---|---|---|---|---|---|
| FUZZ-ADM-01 | `GET /admin/presale/rounds` | 200 | 200 | 200 | **403** |
| FUZZ-ADM-02 | `GET /admin/presale/rounds/:id` | 200 | 200 | 200 | **403** |
| FUZZ-ADM-03 | `PATCH /admin/presale/rounds/:id` | 200 | **403** | **403** | **403** |
| FUZZ-ADM-04 | `POST /admin/presale/rounds/:id/pause` | 200 | 200 | **403** | **403** |
| FUZZ-ADM-05 | `POST /admin/presale/rounds/:id/resume` | 200 | 200 | **403** | **403** |
| FUZZ-ADM-06 | `POST /admin/presale/rounds/:id/reopen` | 200 | 200 | **403** | **403** |
| FUZZ-ADM-07 | `POST /admin/presale/rounds/:id/close` | 200 | 200 | **403** | **403** |
| FUZZ-ADM-08 | `PATCH /admin/presale/rounds/:id/referral-pct` | 200 | 200 | **403** | **403** |
| FUZZ-ADM-09 | `GET /admin/presale/config` | 200 | 200 | 200 | **403** |
| FUZZ-ADM-10 | `PATCH /admin/presale/config` | 200 | **403** | **403** | **403** |
| FUZZ-ADM-11 | `GET /admin/presale/deposits` | 200 | 200 | 200 | **403** |
| FUZZ-ADM-12 | `GET /admin/presale/deposits/:txHash` | 200 | 200 | 200 | **403** |
| FUZZ-ADM-13 | `POST /admin/presale/deposits/:txHash/migrate-round` | 200 | 200 | **403** | **403** |
| FUZZ-ADM-14 | `GET /admin/presale/anomaly` | 200 | 200 | 200 | **403** |
| FUZZ-ADM-15 | `GET /admin/presale/anomaly/:id` | 200 | 200 | 200 | **403** |
| FUZZ-ADM-16 | `POST /admin/presale/anomaly/:id/resolve` | 200 | 200 | 200 | **403** |
| FUZZ-ADM-17 | `GET /admin/presale/audit` | 200 | 200 | 200 | **403** |

**执行方式**：

```go
//go:build fuzz

var adminRoles = []struct {
    name  string
    token string // 各角色预置 JWT
}{
    {"super_admin", saJWT},
    {"operator", opJWT},
    {"customer_service", csJWT},
    {"finance", fiJWT},
}

var adminEndpoints = []struct {
    method string
    path   string
    allowedRoles []string // 允许 200 的角色
}{
    {"GET", "/admin/presale/rounds", []string{"super_admin", "operator", "customer_service"}},
    {"PATCH", "/admin/presale/rounds/seed", []string{"super_admin"}},
    // ... 其余 15 条
}

func TestAdminRBACMatrix(t *testing.T) {
    for _, ep := range adminEndpoints {
        for _, role := range adminRoles {
            expected := 403
            for _, allowed := range ep.allowedRoles {
                if allowed == role.name { expected = 200; break }
            }
            t.Run(role.name+"_"+ep.method+"_"+ep.path, func(t *testing.T) {
                resp := httpClient.Request(ep.method, ep.path).
                    WithHeader("Authorization", role.token).
                    WithJSON(map[string]string{"note": "fuzz rbac test note"}).
                    Expect()
                if resp.Raw().StatusCode != expected {
                    t.Errorf("role=%s path=%s: got=%d want=%d",
                        role.name, ep.path, resp.Raw().StatusCode, expected)
                }
            })
        }
    }
}
```

---

## §FUZZ-WORKER：presale-worker 垃圾事件 fuzz

> 模拟 Worker 喂到 confirm-tx service 的伪造 / 畸形 Transfer log。

| ID | 触发条件 | 期望 |
|---|---|---|
| FUZZ-WK-01 | `log.address` ≠ USDT 合约地址（如随机合约） | 被过滤，不入 `presale_deposit`；Worker 打 `non_usdt` 日志 |
| FUZZ-WK-02 | `log.topics[0]`（event signature）不是 `Transfer(address,address,uint256)` | 被过滤，忽略 |
| FUZZ-WK-03 | `log.topics` 少于 3 个（格式错误） | Worker 跳过并打 warn 日志；不 panic |
| FUZZ-WK-04 | `log.data` 为空字节（amount = 0） | 被过滤（amount = 0 无效入账） |
| FUZZ-WK-05 | `log.data` 为超大数（超 uint256 max） | ABI 解码失败；Worker 跳过；不 panic |
| FUZZ-WK-06 | `log.topics[2]`（to 地址）不在 `PRESALE_VAULT_POOL` | `40007 TX_NOT_TO_VAULT` 语义；不入 deposit |
| FUZZ-WK-07 | `block_number` 比当前游标低（已处理的旧块） | 幂等检查：`uk_(tx_hash, log_index)` 冲突，忽略；`presale_event_cursor` 不回退 |
| FUZZ-WK-08 | `tx_hash` 格式合法但链上不存在（随机伪造） | `eth_getTransactionReceipt` 返 null；`40006 INVALID_TX` 路径；deposit 不入库 |
| FUZZ-WK-09 | 同一个 log 同时从前端 report-tx 和 Worker 路径各发 1 次（并发） | 幂等：只入库 1 行；两个协程都不 panic；`presale_round.sold_odd` 只加一次 |
| FUZZ-WK-10 | `log_index = 0` 和 `log_index = 2^31-1`（边界值） | 正常处理；`uk_(tx_hash, log_index)` 正确区分 |

---

## 验收门槛

| 维度 | 标准 |
|---|---|
| 每个接口 fuzz 时长 | ≥ 5min（CI 2min） |
| 5xx 响应 | 0 |
| panic | 0 |
| DB error log | 0 |
| SQL 注入成功 | 0（验证 DB 行数无异常增加） |
| corpus 覆盖率 | ≥ 80%（`-cover` 检查） |
| RBAC 矩阵 | 68 组全部符合期望（200/403 精确匹配） |
| Worker fuzz | 10 组全部不 panic、不入脏数据 |
| 发现崩溃 | fix 后重 fuzz 直到稳定，写 `tests/adversarial/failures/` |
