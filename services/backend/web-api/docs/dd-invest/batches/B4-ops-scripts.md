# B4 · 预案脚本 + Claude Skill 封装 + Lark Webhook

> **实现仓库**：`oddfi-backend/web-api`（主战场）
> **依赖**：B0（schema 已 migrate）、B2（presale_deposit 写入逻辑上线）、B3（presale_admin_audit 表已建）
> **接口契约参考**：[03-admin-api-contract.md §8](../03-admin-api-contract.md)（脚本与 admin HTTP 接口功能等价）

---

## 0 总体定位

B4 实现预售异常处理的完整闭环：

```
链上异常事件
    │
    ▼
presale_ops_event 落库 (B2 写入)
    │
    ▼
Lark Webhook 推送 → 运营群 @oncall
    │
    ├─── 路径 A：管理员走 admin HTTP 接口处理（B3 实现）
    │
    └─── 路径 B：运营 SSH 跑预案脚本（B4 实现）
              │
              ▼
         .claude/skills/presale-ops  ← Claude Code skill 封装
         运营通过自然语言触发脚本 + dry-run 确认
```

**两条路径效果等价**，均落 `presale_admin_audit`，`operator = "script:filename"`，`source = "script"`。

---

## 1 文件边界

### 1.1 web-api 仓库

| 文件路径 | 说明 |
|---|---|
| `scripts/presale-ops/unclaimed-credit.go` | 无主转账确认转单（C1 + E 场景） |
| `scripts/presale-ops/overflow-handle.go` | 超额到账处理（A4 场景） |
| `scripts/presale-ops/late-arrival.go` | 跨轮次到账兜底（B3-b 场景） |
| `scripts/presale-ops/migrate-round.go` | 手动迁移 deposit 的 round_id |
| `scripts/presale-ops/round-pause.go` | 轮次暂停（可选，admin HTTP 已覆盖） |
| `scripts/presale-ops/round-resume.go` | 轮次恢复（可选） |
| `scripts/presale-ops/round-reopen.go` | 轮次重开（可选） |
| `scripts/presale-ops/round-close.go` | 轮次关闭（可选） |
| `scripts/presale-ops/README.md` | 预案手册（诊断流程 + 使用示例） |
| `scripts/presale-ops/shared/db.go` | 共享 DB 连接初始化 |
| `scripts/presale-ops/shared/audit.go` | 共享 audit 写入函数 |
| `scripts/presale-ops/shared/lark.go` | 共享 Lark Webhook 发送函数 |
| `internal/service/lark_webhook.go` | Lark Webhook service（供 worker + 脚本共用） |
| `.claude/skills/presale-ops/SKILL.md` | Claude Code skill 定义文件 |

### 1.2 脚本清单与场景映射

| 脚本 | 对应异常类型 | 对应 admin 接口 | 触发场景 |
|---|---|---|---|
| `unclaimed-credit.go` | `unclaimed` | `POST /anomaly/:id/resolve` | 用户绕前端直转金库（EOA 无 user 记录） |
| `overflow-handle.go` | `overflow` | `POST /anomaly/:id/resolve` | 到账金额超本轮剩余容量 |
| `late-arrival.go` | `late_arrival` / `round_mismatch` | `POST /deposits/:txHash/migrate-round` | 用户在边界被切轮，想按原轮次价格处理 |
| `migrate-round.go` | 任意 confirmed deposit | `POST /deposits/:txHash/migrate-round` | 通用：手动修订 round_id |
| `round-pause.go` | — | `POST /rounds/:id/pause` | 无 admin 前端时紧急暂停 |

---

## 2 脚本通用设计

所有脚本共享以下设计约定：

### 2.1 启动参数规范

```
--event-id <id>        presale_ops_event.id（核心定位参数）
--tx-hash  <0x...>     txHash（部分脚本用）
--target-round <id>    目标轮次 ID（migrate-round / late-arrival 用）
--resolution <enum>    处理方式（unclaimed-credit / overflow-handle 用）
--note "..."           ≥10 字符，操作原因（强制必填）
--dry-run              只输出 before/after diff，不执行
--env <prod|dev>       指定环境（默认 dev，避免误操作生产）
```

### 2.2 执行流程

```
1. 解析参数 → 校验 --note ≥ 10 字符（否则拒绝启动）
2. 连接 DB（从 env DSN 或 config.yaml 读）
3. 查询当前状态 → 输出 before JSON
4. 计算 after JSON（模拟变更）
5. 输出 diff（before vs after，高亮差异字段）
6. 提示"--dry-run 模式，不执行。输入 yes 确认执行"
7. 用户输入 yes 后，事务内执行变更
8. 写 presale_admin_audit（operator="script:filename"，source="script"）
9. 事务提交 → 输出 "执行成功" + after JSON
10. 失败时回滚事务 + 输出诊断信息（SQL error / 状态冲突原因）
```

### 2.3 共享 DB 连接

```go
// scripts/presale-ops/shared/db.go
package shared

import (
    "gorm.io/driver/mysql"
    "gorm.io/gorm"
    "gorm.io/gorm/logger"
    "os"
)

// InitDB 从环境变量或 config 初始化 GORM 连接。
// 脚本启动时调用，连接失败立即 Fatal。
func InitDB(env string) *gorm.DB {
    dsn := os.Getenv("PRESALE_OPS_DB_DSN")
    if dsn == "" {
        // 按 env 读默认 DSN
        if env == "prod" {
            dsn = os.Getenv("ADMIN_DB_DSN") // 共享 MySQL
        } else {
            dsn = "root:root@tcp(127.0.0.1:3306)/oddfi_dev?parseTime=true&loc=UTC"
        }
    }
    db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
        Logger: logger.Default.LogMode(logger.Info),
    })
    if err != nil {
        panic("DB 连接失败: " + err.Error())
    }
    return db
}
```

### 2.4 共享 Audit 写入

```go
// scripts/presale-ops/shared/audit.go
package shared

import (
    "encoding/json"
    "time"
    "gorm.io/gorm"
)

type AuditEntry struct {
    ScriptName   string // e.g. "unclaimed-credit"
    Action       string // e.g. "anomaly_resolve"
    TargetType   string
    TargetID     string
    BeforeJSON   string
    AfterJSON    string
    Note         string
}

// WriteAudit 在传入的事务 tx 内写一行 presale_admin_audit。
// 调用方负责 tx.Commit() / tx.Rollback()。
func WriteAudit(tx *gorm.DB, entry AuditEntry) error {
    now := time.Now().UnixMilli()
    return tx.Exec(`
        INSERT INTO presale_admin_audit
            (operator, operator_role, action, target_type, target_id,
             before_json, after_json, source, note, created_at)
        VALUES (?, 'script', ?, ?, ?, ?, ?, 'script', ?, ?)`,
        "script:"+entry.ScriptName,
        entry.Action,
        entry.TargetType,
        entry.TargetID,
        entry.BeforeJSON,
        entry.AfterJSON,
        entry.Note,
        now,
    ).Error
}
```

---

## 3 核心脚本实现

### 3.1 `unclaimed-credit.go` — 无主转账确认转单

**场景**：用户绕前端直接向金库转 USDT，EOA 在系统中无 user 记录（`anomaly_reason = unclaimed`）。客服联系用户确认归属后，把异常事件落成正式 deposit。

```go
// scripts/presale-ops/unclaimed-credit.go
package main

// 诊断流程：
// 1. 查 presale_ops_event WHERE id = --event-id AND event_type = 'unclaimed'
// 2. 确认 eoa_address 是否在 user 表已注册（客服引导用户注册后跑此脚本）
// 3. --resolution convert_to_deposit → 落 presale_deposit（按 targetRoundId 定价）
// 4. --resolution reject → 仅关闭 ops_event（用户已退款）

func main() {
    flags := parseFlags()
    validateNote(flags.Note) // < 10 字符直接 exit(1)

    db := shared.InitDB(flags.Env)
    event := fetchOpsEvent(db, flags.EventID) // 校验 event_type = unclaimed

    // dry-run：输出 before / after diff
    before := toJSON(event)
    after := simulateResolve(event, flags)
    printDiff(before, after)

    if flags.DryRun {
        fmt.Println("\n[dry-run] 不执行。去掉 --dry-run 并输入 yes 确认执行。")
        return
    }

    confirmOrExit() // 读 stdin，非 "yes" 则 exit(0)

    tx := db.Begin()
    defer func() {
        if r := recover(); r != nil {
            tx.Rollback()
            fmt.Fprintf(os.Stderr, "panic，已回滚: %v\n", r)
            os.Exit(1)
        }
    }()

    // 执行 convert_to_deposit 或 reject
    if err := applyResolution(tx, event, flags); err != nil {
        tx.Rollback()
        fmt.Fprintf(os.Stderr, "执行失败，已回滚: %v\n", err)
        os.Exit(1)
    }

    // 写 audit
    if err := shared.WriteAudit(tx, shared.AuditEntry{
        ScriptName: "unclaimed-credit",
        Action:     "anomaly_resolve",
        TargetType: "anomaly",
        TargetID:   strconv.FormatUint(flags.EventID, 10),
        BeforeJSON: before,
        AfterJSON:  toJSON(fetchOpsEventTx(tx, flags.EventID)),
        Note:       flags.Note,
    }); err != nil {
        tx.Rollback()
        fmt.Fprintf(os.Stderr, "audit 写入失败，已回滚: %v\n", err)
        os.Exit(1)
    }

    tx.Commit()
    fmt.Println("执行成功。")
}
```

**诊断流程图**：

```
Lark 群收到 unclaimed 告警
    │
    ▼
客服联系用户（Telegram / 邮件）
    │
    ├─ 用户确认是自己转的 → 引导用户注册（若无账号）
    │       │
    │       ▼
    │   go run unclaimed-credit.go \
    │     --event-id <id> --target-round seed \
    │     --resolution convert_to_deposit \
    │     --note "用户 0xUSR... 联系客服确认，转种子轮" --dry-run
    │       │
    │       ▼ 确认 diff 无误
    │   （去掉 --dry-run）→ 输入 yes → 执行
    │
    └─ 用户否认 / 退款完成 → --resolution reject
            │
            ▼
        ops_event.status = rejected，记录原因
```

---

### 3.2 `overflow-handle.go` — 超额到账处理

**场景**：用户到账金额超过本轮剩余容量（`anomaly_reason = overflow`）。

```go
// scripts/presale-ops/overflow-handle.go

// 支持 3 种子 resolution：
// --mode partial_fill   ← 部分按本轮价格入账，超出进下一轮
// --mode next_round     ← 全部按下一轮价格入账
// --mode hold           ← 超出部分挂账，等运营决策

// dry-run 输出示例：
// [before]
//   presale_ops_event #42: status=pending, amount_usdt=50000, event_type=overflow
//   presale_round(public_a): sold_odd=980000, supply_odd=1000000, price_usd=0.05
//
// [after: mode=partial_fill]
//   presale_deposit(txHash): amount_usdt=1000（本轮剩余容量 = 50000 USDT）
//     → shares_odd=1000000/0.05=20000 ODD（本轮全部消耗）
//   presale_ops_event #43（新）: event_type=overflow_remainder, amount_usdt=49000
//     → 进入下一轮处理队列或退款
//   presale_round(public_a): sold_odd → 1000000（售罄，status → ended）
//   Lark 推送："public_a 已售罄，49000 USDT 余额进 overflow_remainder 队列"
```

---

### 3.3 `late-arrival.go` — 跨轮次到账兜底

**场景**：用户在轮次边界 5min 容差内付款，被分配到错误轮次（`anomaly_reason = round_mismatch` 或 `late_arrival`）。按原始 deposit 的 block_timestamp 对应的冻结价格补单。

```go
// scripts/presale-ops/late-arrival.go

// 核心逻辑：
// 1. 查 presale_deposit WHERE tx_hash = --tx-hash
// 2. 确认 block_timestamp 落在 --target-round 的 [start_ts - tolerance, end_ts + tolerance]
// 3. 调用与 admin migrate-round 接口等价的 service 逻辑
//    （回滚旧轮次 holding + 重算新轮次 holding）
// 4. 写 audit，action = migrate_round_id

// 使用示例：
// go run late-arrival.go \
//   --tx-hash 0xabc... \
//   --target-round seed \
//   --note "用户 0xUSR 在种子轮 end_ts 前30s 付款，被错分到战略轮" \
//   --dry-run
```

---

### 3.4 `migrate-round.go` — 通用 round_id 迁移

与 [admin HTTP 接口 `POST /deposits/:txHash/migrate-round`](../03-admin-api-contract.md) 功能完全等价，适用于无 admin 前端时的紧急操作。

```go
// scripts/presale-ops/migrate-round.go

// 参数：
//   --tx-hash <0x...>     目标 deposit 的 txHash
//   --target-round <id>   目标轮次（如 seed / strategic）
//   --note "..."          操作原因 ≥10 字符
//   --dry-run

// 执行步骤（与 service/presale_deposit.go MigrateRound 完全一致）：
// 1. 取 deposit，校验 status = confirmed
// 2. 校验 block_timestamp ∈ [target.start_ts - tolerance, target.end_ts + tolerance]
// 3. 重算 shares_odd = amount_usdt / target.price_usd
// 4. 回滚旧轮次 holding（UPDATE presale_holding 减法 + 重算 locked_price_avg）
// 5. 应用新轮次 holding（UPSERT）
// 6. UPDATE presale_deposit.round_id / price_usd / shares_odd / referral_*
// 7. INSERT presale_admin_audit（operator="script:migrate-round"，source="script"）
// 8. 事务提交
```

---

## 4 round 状态机脚本（可选）

> admin HTTP 接口已覆盖，这些脚本仅供紧急情况下无法访问 admin 前端时使用。

```bash
# round-pause.go 使用示例
go run round-pause.go \
  --round-id strategic \
  --note "临时暂停战略轮，插入种子轮大客户回补" \
  --dry-run

# round-reopen.go 使用示例
go run round-reopen.go \
  --round-id seed \
  --note "大客户 X 补认购，重开种子轮" \
  --dry-run

# 去掉 --dry-run 后提示输入 yes 确认
```

所有 round 状态机脚本遵循同一逻辑：`SELECT FOR UPDATE → 校验合法转换 → UPDATE → INSERT audit → COMMIT`。

---

## 5 Lark Webhook 集成

### 5.1 Service 设计

```go
// internal/service/lark_webhook.go
package service

// LarkWebhookService 负责向 Lark 群发送异常告警和操作通知。
// worker（presale-worker）和预案脚本（scripts/presale-ops/shared/lark.go）
// 都通过此 service 发送消息，保证消息格式一致。
type LarkWebhookService struct {
    webhookURL string
    client     *http.Client
}

// LarkEvent 统一推送事件结构
type LarkEvent struct {
    EventType  string // anomaly / paused_arrival / admin_op / script_op
    TxHash     string
    EOA        string
    AmountUsdt string
    RoundID    string
    Reason     string // anomaly_reason 枚举
    Suggestion string // 建议处理方式
    OncallAt   string // @oncall Lark user_id
    Operator   string // admin 操作者或 script:filename
    Note       string
}

// Notify 异步推送（goroutine 内调用，不阻塞业务事务）
func (s *LarkWebhookService) Notify(event LarkEvent) {
    go func() {
        payload := s.buildPayload(event)
        resp, err := s.client.Post(s.webhookURL, "application/json",
            bytes.NewReader(payload))
        if err != nil {
            log.Error().Err(err).Str("event_type", event.EventType).Msg("Lark webhook 发送失败")
            return
        }
        defer resp.Body.Close()
        // 记录 Lark 返回的 message_id（用于后续在群里回帖）
        var larkResp struct {
            Data struct{ MessageID string `json:"message_id"` } `json:"data"`
        }
        json.NewDecoder(resp.Body).Decode(&larkResp)
        log.Info().Str("lark_msg_id", larkResp.Data.MessageID).Msg("Lark 推送成功")
    }()
}
```

### 5.2 触发场景与推送内容

| 触发场景 | 推送时机 | 必含字段 | 建议处理方式 |
|---|---|---|---|
| `overflow`（超额到账） | deposit 落 anomaly 时（B2 worker） | tx_hash / eoa / amount / round_id | "运营跑 overflow-handle.go，选 partial_fill / next_round / hold" |
| `unclaimed`（无主转账） | deposit 落 anomaly 时（B2 worker） | tx_hash / eoa / amount | "客服联系用户确认，跑 unclaimed-credit.go" |
| `paused_arrival`（paused 期间入账） | deposit 落 confirmed（信息流，非阻塞） | tx_hash / eoa / amount / round_id | "轮次暂停中有入账，确认处理方式" |
| `round_mismatch`（边界切轮） | deposit 落 anomaly 时 | tx_hash / eoa / expected_round / actual_round | "跑 late-arrival.go 迁移到用户期望轮次" |
| 高敏 admin 操作（PATCH /config / migrate-round） | admin HTTP handler 操作后（非阻塞） | operator / action / target / note | — |
| 脚本执行完成 | 脚本 Commit 后 | script_name / operator / target / note | — |

### 5.3 Payload 格式（Lark Card Message）

```json
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": { "content": "⚠️ 预售异常：overflow", "tag": "plain_text" },
      "template": "red"
    },
    "elements": [
      { "tag": "div", "text": { "content": "**txHash**: 0xabc...\n**EOA**: 0xUSR...\n**金额**: 50,000 USDT\n**轮次**: public_a\n**建议**: 运营跑 overflow-handle.go", "tag": "lark_md" } },
      { "tag": "action", "actions": [
        { "tag": "button", "text": { "content": "查看详情", "tag": "plain_text" },
          "url": "https://admin.oddfi.io/presale/anomaly/42", "type": "primary" }
      ]}
    ]
  }
}
```

---

## 6 Claude Code Skill 封装

### 6.1 `.claude/skills/presale-ops/SKILL.md`

```markdown
# presale-ops Skill

## 触发词

| 触发词 | 调用脚本 |
|---|---|
| `预案处理` / `ops` | 进入场景识别流程 |
| `无主转账确认` / `unclaimed` | `unclaimed-credit.go` |
| `超额处理` / `overflow` | `overflow-handle.go` |
| `跨轮次兜底` / `late arrival` / `边界切轮` | `late-arrival.go` |
| `迁移轮次` / `migrate round` | `migrate-round.go` |
| `暂停轮次` / `pause round` | `round-pause.go` |
| `恢复轮次` / `resume round` | `round-resume.go` |

## 调用方式

用户输入自然语言描述异常场景，skill 自动：
1. 识别对应脚本
2. 询问缺失参数（event-id / tx-hash / note / target-round）
3. 生成 dry-run 命令并展示
4. 用户确认后生成真实执行命令（需用户手动 SSH 运行，不自动执行生产命令）

## 示例对话

用户：「有个用户说他打了 50000 USDT 到金库，但没有入账记录」

Skill 响应：
「这是无主转账场景（unclaimed）。请提供：
  1. presale_ops_event.id（从 Lark 告警里复制）
  2. 客服确认的目标轮次（如 seed）
  3. 操作原因（至少10字）
  
  已生成 dry-run 命令：
  go run scripts/presale-ops/unclaimed-credit.go \
    --event-id <id> --target-round seed \
    --resolution convert_to_deposit \
    --note "<你的原因>" --dry-run --env prod
  
  确认 diff 无误后去掉 --dry-run 执行。」

## 安全约束

- Skill 只生成命令，不直接执行
- 所有生成的命令默认带 --dry-run
- 生产环境命令必须用户手动 SSH 运行
- --note 参数必须 ≥10 字符，否则命令生成时告警
```

### 6.2 场景识别逻辑

```
用户输入
    │
    ▼
关键词匹配
    ├─ unclaimed / 无主转账 / 绕前端
    │       → 询问 event-id、target-round、resolution
    │       → 生成 unclaimed-credit.go 命令
    │
    ├─ overflow / 超额
    │       → 询问 event-id、mode（partial_fill / next_round / hold）
    │       → 生成 overflow-handle.go 命令
    │
    ├─ late arrival / 边界 / round_mismatch
    │       → 询问 tx-hash、target-round
    │       → 生成 late-arrival.go 命令
    │
    ├─ migrate / 迁移轮次
    │       → 询问 tx-hash、target-round
    │       → 生成 migrate-round.go 命令
    │
    └─ 无法识别 → 列出所有触发词，引导用户重新描述
```

---

## 7 `scripts/presale-ops/README.md` — 预案手册

```markdown
# presale-ops 预案手册

## 快速定位

从 Lark 告警收到通知后，按 anomaly_reason 定位脚本：

| Lark 告警 anomaly_reason | 对应脚本 |
|---|---|
| `unclaimed` | unclaimed-credit.go |
| `overflow` | overflow-handle.go |
| `round_mismatch` / `late_arrival` | late-arrival.go |
| 任意 confirmed deposit 需改轮次 | migrate-round.go |

## 环境配置

所有脚本从 env 读 DB DSN：
```bash
export PRESALE_OPS_DB_DSN="user:pass@tcp(host:3306)/oddfi?parseTime=true&loc=UTC"
export PRESALE_OPS_ENV=prod  # 或 dev
```

## 通用执行步骤

1. SSH 登录生产服务器
2. cd /opt/oddfi-backend/web-api
3. go run scripts/presale-ops/<script>.go [参数] --dry-run
4. 确认 diff 输出无误
5. 去掉 --dry-run，运行，输入 yes 确认
6. 检查返回 "执行成功" + 检查 Lark 推送到群里的确认消息

## 回滚说明

所有脚本操作均有 presale_admin_audit 记录。
若需回滚，根据 audit 记录的 before_json 手工构造反向操作（再跑一次 migrate-round 把 round_id 改回去）。
无自动回滚脚本（链上数据已确认，数据库只能补偿操作）。
```

---

## 8 DoD（Definition of Done）

| 检查项 | 说明 |
|---|---|
| 5 个核心预案脚本（unclaimed-credit / overflow-handle / late-arrival / migrate-round + 1 个 round-pause）干跑（--dry-run）不报错 | go run 确认 |
| 每个脚本真实执行 1 次（dev 环境）：DB 变更正确 + presale_admin_audit 有记录 | 集成测试 |
| --note 空 / <10 字符时脚本 exit(1) 并输出提示 | 单元测试 |
| Lark webhook 测试推送（dev webhook URL）：5 种告警类型各推送 1 条 | 手动验证 |
| `.claude/skills/presale-ops/SKILL.md` 触发词测试：6 个触发词各触发一次，输出命令格式正确 | 手动验证 |
| `internal/service/lark_webhook.go` 单元测试：mock HTTP client，验证 payload 字段完整 | go test |
| go vet / go build 无报错 | CI |
| `scripts/presale-ops/README.md` 预案手册可读，包含快速定位表 + 环境配置 + 执行步骤 | 文档 review |

---

## 9 Task Prompt for Agent（B4 单 agent）

```
你是 B4 batch 的实现 agent，负责 web-api 仓库的预案脚本、Lark webhook service 和 Claude skill 封装。

工作目录：/Users/hang/work/oddfi-backend/web-api
分支：feat/presale-b4-ops（从 dev 拉）

**必读文档**：
- web-api/docs/dd-invest/03-admin-api-contract.md §8（脚本与 admin 接口对应关系）
- web-api/docs/dd-invest/01-data-model.md §3.8（presale_ops_event schema）/ §3.9（presale_admin_audit schema）
- web-api/docs/dd-invest/batches/B4-ops-scripts.md（本文档，脚本设计）

**你的文件边界**：
- scripts/presale-ops/*.go（5 个核心脚本 + shared/ 子包）
- scripts/presale-ops/README.md
- internal/service/lark_webhook.go
- .claude/skills/presale-ops/SKILL.md

**关键约束**：
1. 所有金额用 shopspring/decimal，不用 float64
2. 每个脚本强制 --note ≥ 10 字符校验，不满足直接 os.Exit(1)
3. 默认 --dry-run 模式（不传则 dry-run，需显式 --no-dry-run 或去掉 --dry-run 才执行）
4. 所有执行路径均写 presale_admin_audit，operator="script:filename"，source="script"
5. Lark webhook 推送异步（goroutine），不阻塞脚本主流程
6. shared/ 子包提供 DB 连接、audit 写入、Lark 推送三个共享函数，各脚本 import

**测试要求**：
- scripts/presale-ops/shared/audit_test.go：WriteAudit 函数 mock DB 验证 SQL 参数正确
- internal/service/lark_webhook_test.go：mock http.Client，验证 5 种事件类型的 payload 字段齐全
- scripts/presale-ops/migrate-round_test.go：
  - 正常流程：before/after JSON diff 输出正确
  - block_timestamp 越界 → exit(1) + 错误提示
  - note < 10 字符 → exit(1)

**dev 验证步骤**：
1. go run scripts/presale-ops/migrate-round.go --tx-hash <测试 hash> --target-round seed --note "B4 batch dev 验证测试" --dry-run
2. 确认输出 before/after diff，然后去掉 --dry-run 执行
3. 查 presale_admin_audit：SELECT * FROM presale_admin_audit WHERE operator = 'script:migrate-round' ORDER BY id DESC LIMIT 1;
4. 触发 Lark webhook test：go run scripts/presale-ops/unclaimed-credit.go ... --dry-run（观察 Lark 群是否收到推送）

完成后 git commit（简体中文，禁 Co-Authored-By），提 PR 到 dev 分支。
```
