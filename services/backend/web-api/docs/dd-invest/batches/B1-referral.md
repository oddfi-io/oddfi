# B1 · 站点级邀请系统（Referral）

> 依赖 B0 gate 通过（`user_referral_code` / `user_referral_bind` 表已建，repository 接口已稳定）。
> 接口契约源真值：[02-api-contract.md §3.6～§3.8](../02-api-contract.md)。
> 数据模型源真值：[01-data-model.md §3.5～§3.6](../01-data-model.md)。
> 单 agent 执行，不并行。

---

## 1 背景

V3 把原来的 `/api/v1/presale/referral/*`（业务耦合）重构为 `/api/v1/referral/*`（站点级），解耦理由：

1. **后续业务复用**：投注、任务等业务无需各自实现邀请系统，统一入参 `(userId, business, source)` 即可调用
2. **奖励计算分离**：邀请系统只管"谁邀请了谁"；奖励金额（ODD 数量）由调用方业务（presale deposit service）执行，不在邀请系统里
3. **邀请关系永久性**：一旦绑定不可撤销 / 不可改，邀请系统不需要实现解绑 / 变更逻辑

本 batch 实现：
- 邀请码生成（用户首次登录时自动生成，JWT middleware hook 注入）
- 3 个用户接口：`GET /me` / `POST /bind` / `GET /list`
- 大小写归一化 / 自邀阻断 / 重复绑定幂等
- 既有用户邀请码补齐脚本（`scripts/presale-ops/backfill-referral-codes.go`）

---

## 2 文件边界

B1 单 agent 独占以下路径，B2 不修改这些文件（B2 只调用 `user_referral_bind` repository 查绑定关系）：

| 路径 | 动作 | 说明 |
|---|---|---|
| `internal/handler/referral.go` | 新建 | 3 个接口 handler |
| `internal/service/referral.go` | 新建 | `ReferralService` interface + 实现 |
| `internal/router/referral.go` | 新建 | 注册 `/api/v1/referral/*` 路由组 |
| `internal/middleware/auth.go` | 改（小） | 登录成功 hook：INSERT IGNORE 生成邀请码 |
| `scripts/presale-ops/backfill-referral-codes.go` | 新建 | 既有用户一次性补齐脚本 |
| `internal/repository/user_referral_code.go` | B0 已建 | B1 只调用，不修改接口签名 |
| `internal/repository/user_referral_bind.go` | B0 已建 | B1 只调用，不修改接口签名 |

**B1 不触碰**：`presale_*` 相关文件、`internal/service/presale*.go`、`internal/chain/`。

---

## 3 Schema 引用

- `user_referral_code`：[01-data-model.md §3.5](../01-data-model.md)
  - PK = `user_id`，`uk_code`，`uk_eoa`
  - code 格式：`0x` + 6 位 `[2-9A-HJ-NP-Z]`（30 字符集，去 0/O/1/I/L）
- `user_referral_bind`：[01-data-model.md §3.6](../01-data-model.md)
  - PK = `user_id`（被邀请人唯一），防重绑靠 PK 冲突
  - `business` 字段本期 = `"presale"`，后续业务填自己的值

---

## 4 接口契约引用

见 [02-api-contract.md §3.6～§3.8](../02-api-contract.md)：

| 接口 | 路径 | 鉴权 |
|---|---|---|
| 我的邀请信息 | `GET /api/v1/referral/me` | JWT |
| 绑定邀请关系 | `POST /api/v1/referral/bind` | JWT |
| 我邀请的列表 | `GET /api/v1/referral/list` | JWT |

限流（见 [02-api-contract.md §5](../02-api-contract.md)）：
- `POST /bind`：5 req / min / user
- `GET /me`：60 req / min / user
- `GET /list`：60 req / min / user

---

## 5 关键实现细节

### 5.1 邀请码生成（CSPRNG）

```go
// internal/service/referral.go
//
// 字符集去掉 0/O/1/I/L，剩 30 个字符，避免用户视觉混淆（尤其手动输入场景）
// 30^6 ≈ 7.29 亿空间；百万级用户碰撞率 ≈ 0.07%，5 次重试足以覆盖
// 超过 5 次说明字符空间已经告急（系统级异常，不是用户问题），推 Lark 告警而非静默忽略
const referralCodeChars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ" // 32个? 重新数：去 0/O/1/I/L 后是 30个

func generateCode() (string, error) {
    // 用 crypto/rand 而非 math/rand，邀请码是资产凭证，伪随机有被预测风险
    b := make([]byte, 6)
    if _, err := rand.Read(b); err != nil {
        return "", err
    }
    code := make([]byte, 6)
    for i, v := range b {
        code[i] = referralCodeChars[int(v)%len(referralCodeChars)]
    }
    return "0x" + string(code), nil
}

// GenerateCodeForUser 首次登录时调用，失败不阻断登录流程（INSERT IGNORE 保证幂等）
// 设计决策：邀请码生成失败只记 error log + Lark 告警，不返回 500 给用户
// 因为：用户已通过钱包认证，阻断登录体验远比邀请码临时缺失更严重
func (s *referralService) GenerateCodeForUser(ctx context.Context, userID uint64, eoa string) error {
    for attempt := 0; attempt < 5; attempt++ {
        code, err := generateCode()
        if err != nil {
            return fmt.Errorf("crypto/rand failure: %w", err)
        }
        inserted, err := s.codeRepo.InsertIgnore(ctx, userID, eoa, code)
        if err == nil && inserted {
            return nil // 成功
        }
        if err == nil && !inserted {
            return nil // 该用户已有邀请码（幂等），正常退出
        }
        // 唯一键冲突（code 碰撞）→ 重试
        if isUniqueConstraintViolation(err) && isCodeConflict(err) {
            s.log.Warn().Int("attempt", attempt+1).Str("code", code).Msg("referral code collision, retrying")
            continue
        }
        return err // 其他 DB 错误
    }
    // 5 次重试全部碰撞，属于系统级异常
    s.lark.Alert(ctx, "referral code exhausted after 5 retries for user "+strconv.FormatUint(userID, 10))
    return ErrCodeGenExhausted
}
```

### 5.2 登录 hook 注入（JWT middleware 改动）

```go
// internal/middleware/auth.go（改动最小化）
//
// 在现有 JWT 鉴权成功后追加一个非阻断的 hook：
// 若该 user 还没有邀请码，异步触发生成（INSERT IGNORE 保证幂等）
// 异步而非同步：避免 DB 抖动拖慢鉴权中间件响应
func AuthMiddleware(referralSvc service.ReferralService) gin.HandlerFunc {
    return func(c *gin.Context) {
        // ... 现有 JWT 校验逻辑 ...

        // hook：首次登录时自动生成邀请码（非阻断）
        // 用 goroutine 避免影响正常请求延迟；失败仅记 warn，不影响本次请求
        go func() {
            if err := referralSvc.GenerateCodeForUser(context.Background(), userID, eoa); err != nil {
                log.Warn().Err(err).Uint64("user_id", userID).Msg("generate referral code failed")
            }
        }()

        c.Next()
    }
}
```

### 5.3 大小写归一化

```go
// internal/service/referral.go
//
// 输入的邀请码不区分大小写，后端统一转大写后再查 uk_code
// 前端 URL 分享链接可能经过 URL 编码 / 自动小写，不强依赖前端保证大小写
func normalizeCode(input string) string {
    return strings.ToUpper(strings.TrimSpace(input))
}

func (s *referralService) BindReferral(ctx context.Context, req BindReferralRequest) (*BindReferralResponse, error) {
    code := normalizeCode(req.Code) // 大写归一化

    // 1. 查邀请码是否存在
    codeRecord, err := s.codeRepo.GetByCode(ctx, code)
    if err != nil || codeRecord == nil {
        return nil, ErrInvalidCode // 40404
    }

    // 2. 自邀阻断：邀请码持有人不能用自己的码
    if codeRecord.UserID == req.UserID {
        return nil, ErrSelfReferral // 40004
    }

    // 3. 幂等写入（PK = user_id，冲突静默忽略已绑记录）
    existing, err := s.bindRepo.GetByUserID(ctx, req.UserID)
    if err == nil && existing != nil {
        return nil, ErrAlreadyBound // 40903，前端自动绑场景下前端静默处理
    }

    boundAt := time.Now().UnixMilli()
    err = s.bindRepo.Insert(ctx, &model.UserReferralBind{
        UserID:         req.UserID,
        EoaAddress:     req.EoaAddress,
        ReferrerUserID: codeRecord.UserID,
        ReferrerEoa:    codeRecord.EoaAddress,
        ReferrerCode:   code,
        Source:         req.Source,   // link / manual
        Business:       req.Business, // presale（本期）/ 后续业务自填
        BoundAt:        boundAt,
    })
    // ...
}
```

### 5.4 service 接口设计（业务无关）

```go
// internal/service/referral.go
//
// 入参统一携带 business 字段，让调用方标记业务来源
// 邀请奖励（ODD 数量计算 / holding upsert）完全不在此 service 实现
// 由 presale deposit service 在 confirm-deposit 事务内自行处理
type ReferralService interface {
    // GenerateCodeForUser 首次登录 hook 调用，INSERT IGNORE 幂等
    GenerateCodeForUser(ctx context.Context, userID uint64, eoa string) error

    // BindReferral 绑定邀请关系。返回 ErrAlreadyBound 时前端静默（自动绑场景）
    BindReferral(ctx context.Context, req BindReferralRequest) (*BindReferralResponse, error)

    // GetMyReferralInfo 查当前用户的邀请码 + 邀请人 + 统计
    GetMyReferralInfo(ctx context.Context, userID uint64) (*MyReferralInfoResponse, error)

    // ListReferred 查我邀请的用户列表（含每人 presale deposit 明细）
    // business 参数可选，空字符串返回所有业务；本期只有 "presale"
    ListReferred(ctx context.Context, userID uint64, business string, page, size int) (*ListReferredResponse, error)
}
```

### 5.5 `GET /api/v1/referral/list` 的 JOIN 查询

`list` 接口需要返回被邀请人的 presale 入账明细，涉及跨表 JOIN：

```go
// internal/service/referral.go
//
// ListReferred 实现：先查 user_referral_bind 获取被邀请人列表，
// 再批量查 presale_deposit 获取每人的 referral_reward_odd
// 用两次查询 + 内存聚合，而非复杂 JOIN——数量有限（单用户被邀请数百人上限）
// 避免大 JOIN 在高并发下产生锁竞争
func (s *referralService) ListReferred(ctx context.Context, userID uint64, business string, page, size int) (*ListReferredResponse, error) {
    // 1. 查被邀请人列表（user_referral_bind.referrer_user_id = userID）
    binds, total, err := s.bindRepo.ListByReferrer(ctx, userID, business, page, size)
    if err != nil {
        return nil, err
    }

    // 2. 收集被邀请人 user_id 列表
    referredIDs := make([]uint64, len(binds))
    for i, b := range binds {
        referredIDs[i] = b.UserID
    }

    // 3. 批量查这些被邀请人触发的 deposit（referrer_user_id = userID 的已 confirmed 记录）
    deposits, err := s.depositRepo.ListByReferrerUserID(ctx, userID, referredIDs)
    if err != nil {
        return nil, err
    }

    // 4. 内存聚合：按 user_id 分组 deposit
    // ...
}
```

### 5.6 `GetMyReferralInfo` 中的 `totalRewardOdd`

```go
// stats.totalRewardOdd 从 presale_holding 聚合（source=2=referral），
// 不从 presale_deposit 聚合——holding 是最终真相（deposit 可能被 migrate-round 修订）
// 返回值只有 ODD 数量，不返 USD（由前端调独立平台币汇率服务自算）
totalOdd, err := s.holdingRepo.SumReferralOdd(ctx, userID)
```

---

## 6 邀请奖励落账（B2 的职责，B1 不实现）

邀请系统只管绑定关系，奖励在 deposit confirm 时由 `presale deposit service` 执行：

```
deposit 落 confirmed 事务内：
  1. 反查 user_referral_bind（bound_at < block_timestamp 才生效，[INV-6](../01-data-model.md)）
  2. 从 presale_round 快照 referral_reward_pct
  3. 计算 referral_reward_odd = shares_odd × pct / 100（[INV-7](../01-data-model.md)）
  4. 同事务内 UpsertReferral holding（referrer_user_id, round_id, source=2）
```

B1 service 不持有 `presale_*` repository。B2 的 confirm-deposit service 会直接调用 `user_referral_bind` repository 查绑定关系。

---

## 7 既有用户邀请码补齐脚本

```go
// scripts/presale-ops/backfill-referral-codes.go
//
// 部署 B1 后执行一次：扫 user 表中没有 user_referral_code 记录的用户，批量生成
// 不用 B1 登录 hook，因为老用户不会重新登录触发 hook
// 使用与 GenerateCodeForUser 完全相同的逻辑（共用 referral service），保证一致性
//
// 执行方式：go run scripts/presale-ops/backfill-referral-codes.go --dry-run（先演练）
//           go run scripts/presale-ops/backfill-referral-codes.go（实际执行）
// 成功后会落 presale_admin_audit（operator="script:backfill-referral-codes", source="script"）
```

---

## 8 DoD（Definition of Done）

B1 的 gate 通过后才能进 B2。

- [ ] 3 个接口 curl 验证：
  - `GET /api/v1/referral/me` 返回 `myCode` + `shareLink` + `referrer`（未绑时为 null）+ `stats`
  - `POST /api/v1/referral/bind` 正常绑定返 200；重复绑返 `40903 ALREADY_BOUND`；自邀返 `40004 SELF_REFERRAL`；不存在的 code 返 `40404 INVALID_CODE`
  - `GET /api/v1/referral/list` 返回分页列表 + 每人 deposits 明细
- [ ] 邀请码生成单测：
  - CSPRNG 6 位字符全部在 `[2-9A-HJ-NP-Z]` 字符集内
  - 冲突重试 5 次单测（mock DB 返回 5 次 unique violation，第 6 次返 `ErrCodeGenExhausted`）
  - 大写归一化：输入 `0xh7k9x2` 与 `0xH7K9X2` 等价
- [ ] 自邀阻断单测：同一用户用自己的 code 绑定，返 `ErrSelfReferral`
- [ ] 重复绑定幂等单测：相同 `user_id` 第二次绑定，返 `ErrAlreadyBound`，DB 无新行
- [ ] B2 跨业务调用样例：`user_referral_bind` repository 的 `GetByUserID(ctx, userID)` 在 B2 的 confirm-deposit 中能正确被调用（接口签名不变）
- [ ] `go test ./internal/service/... -run TestReferral -count=1` 全绿
- [ ] `go vet ./... && go build ./...` 通过
- [ ] code-reviewer 审过，无 Critical / High 问题

---

## 9 风险点

| 风险 | 缓解 |
|---|---|
| 邀请码生成失败阻断登录 | hook 改为异步 goroutine + 失败仅告警，不阻断 JWT 响应 |
| LocalStorage 意图未绑定 | 前端职责：页面加载时读 localStorage ref，若未绑则自动调 POST /bind；后端接口幂等，已绑返 40903 前端静默 |
| `listReferred` N+1 查询 | 两次查询（binds + deposits）+ 内存聚合；binds 分页上限 100 条，不存在大批量 N+1 |
| 邀请码空间耗尽（> 700M 用户） | 30^6 = 7.29 亿，百万级用户碰撞率 0.07%；5 次重试 + Lark 告警；真到耗尽时扩字符集（改 8 位，无需迁移旧码） |
| `bound_at < block_timestamp` 时区问题 | `block_timestamp` 是链上 Unix 毫秒（UTC），`bound_at` 存 `time.Now().UnixMilli()`（UTC），两者同维度比较无时区问题 |

---

## 10 Task Prompt for Executor Agent

```
任务：实现 oddfi-backend/web-api/docs/dd-invest/batches/B1-referral.md 定义的 B1 batch。

前置条件：B0 gate 已通过（user_referral_code / user_referral_bind 表已建，repository 接口已稳定）。

上下文文档（必须先读）：
- web-api/docs/dd-invest/02-api-contract.md §3.6～§3.8（接口契约）
- web-api/docs/dd-invest/01-data-model.md §3.5～§3.6（schema）
- web-api/docs/dd-invest/batches/B1-referral.md（本文档，实施规范）

执行顺序：

1. 新建 internal/service/referral.go
   - ReferralService interface（§5.4 签名）
   - GenerateCodeForUser：CSPRNG + 5 次重试 + Lark 告警（§5.1）
   - BindReferral：大写归一化 + 自邀阻断 + PK 幂等（§5.3）
   - GetMyReferralInfo：holdingRepo.SumReferralOdd 聚合（§5.6）
   - ListReferred：两次查询 + 内存聚合（§5.5）

2. 新建 internal/handler/referral.go
   - GET /me / POST /bind / GET /list 三个 handler
   - 响应格式严格对齐 02-api-contract.md §3.6～§3.8

3. 改 internal/middleware/auth.go（最小改动）
   - 在 JWT 鉴权成功后追加异步 hook（§5.2）
   - 不改 auth 逻辑，不阻断请求

4. 新建 internal/router/referral.go
   - 注册 /api/v1/referral/* 路由组，挂 JWT 中间件

5. 新建 scripts/presale-ops/backfill-referral-codes.go
   - --dry-run 模式（只统计不写 DB）
   - 实际执行后落 presale_admin_audit

6. 单元测试（_test.go 配对）
   - 邀请码生成 CSPRNG + 冲突重试（mock repo）
   - 自邀阻断 / 重复绑定幂等

约束：
- 不触碰 presale_* service / handler / repository（B2 负责）
- 不改 user_referral_code / user_referral_bind repository 接口签名（B0 已定）
- normalizeCode 必须是 strings.ToUpper，不是前端负责大小写
- ListReferred 用两次查询 + 内存聚合，禁止 N+1 循环查询
- 邀请奖励（ODD 计算 / holding upsert）不在此 service 实现

验收命令：
  go vet ./... && go build ./...
  go test ./internal/service/... -run TestReferral -count=1
  # curl 验证 3 个接口契约一致
```
