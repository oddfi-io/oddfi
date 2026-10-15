# REQ-004: KOL 特殊返佣 — web-api 实施任务

**归属仓库**: `oddfi-backend/web-api`
**依赖**: admin-backend Step 1 完成后可联调（但实现不阻塞）
**API 契约**: 见 [REQ-004-kol-referral-master.md](→ 同目录)

---

## 任务概览

web-api 需要实现两件事：

1. **新增 KOL 管理 API**（CRUD），供 admin-backend proxy 调用
2. **改 deposit 确认逻辑**，优先使用 KOL 自定义返佣比例

---

## Task A：数据库 & Repository

### Migration

新建文件（编号接着现有最大值）：

```sql
-- migrations/XXXX_create_presale_kol_referral_pct.sql
CREATE TABLE presale_kol_referral_pct (
    referrer_eoa  VARCHAR(42)   NOT NULL PRIMARY KEY COMMENT 'KOL EOA 地址（小写）',
    referral_pct  DECIMAL(10,4) NOT NULL               COMMENT '自定义返佣比例（%），如 8.0000 = 8%',
    note          VARCHAR(256)  DEFAULT NULL            COMMENT '运营备注',
    created_by    VARCHAR(64)   NOT NULL                COMMENT '操作者 lark_user_id',
    created_at    BIGINT        NOT NULL,
    updated_at    BIGINT        NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='KOL 独立返佣比例表';
```

### Model

`internal/model/presale_kol_referral_pct.go`:

```go
type PresaleKolReferralPct struct {
    ReferrerEoa string          `gorm:"column:referrer_eoa;primaryKey"`
    ReferralPct decimal.Decimal `gorm:"column:referral_pct;not null;type:decimal(10,4)"`
    Note        *string         `gorm:"column:note"`
    CreatedBy   string          `gorm:"column:created_by;not null"`
    CreatedAt   int64           `gorm:"column:created_at;not null;autoCreateTime:milli"`
    UpdatedAt   int64           `gorm:"column:updated_at;not null;autoUpdateTime:milli"`
}

func (PresaleKolReferralPct) TableName() string { return "presale_kol_referral_pct" }
```

### Repository

`internal/repository/presale_kol_referral_pct.go`，接口方法：

```go
type KolReferralPctRepository interface {
    List(ctx context.Context, eoaFilter string, page, size int) ([]*model.PresaleKolReferralPct, int64, error)
    Upsert(ctx context.Context, kol *model.PresaleKolReferralPct) error   // POST 幂等用
    Update(ctx context.Context, eoa string, pct decimal.Decimal, note *string, updatedAt int64) error
    Delete(ctx context.Context, eoa string) (bool, error)                 // bool=found
    GetByEoa(ctx context.Context, eoa string) (*model.PresaleKolReferralPct, error)
}
```

`GetByEoa` 返回 `ErrKolNotFound`（新增具名错误）供 deposit 逻辑使用。

---

## Task B：Admin Handler

`internal/handler/admin/kol_referral.go`

```
GET    /internal/admin/presale/kol-referral
POST   /internal/admin/presale/kol-referral
PATCH  /internal/admin/presale/kol-referral/:eoa
DELETE /internal/admin/presale/kol-referral/:eoa
```

**响应格式**（与现有 admin handler 一致）：
```json
{ "code": 0, "message": "ok", "data": { ... } }
```

GET data：`{ "list": [...], "total": N }`

POST/PATCH data：`{ "kol": { ...KOL 对象 } }`

DELETE data：`{ "referrerEoa": "0x..." }`

### 校验规则

- `referrerEoa`：必须 `^0x[0-9a-fA-F]{40}$`，写入前 `strings.ToLower`
- `referralPct`：`decimal.Decimal`，范围 `[0, 100]`，精度 ≤ 4 位小数
- 写操作走现有 `admin_audit_idem` middleware（audit 自动落库）

### 路由注册

在 `internal/router/admin_internal.go` 中，找 presale 路由组，添加：

```go
kolReferral := presale.Group("/kol-referral")
kolReferral.GET("", middleware.RoleRequired("customer_service", "operator", "finance", "super_admin"), kolHandler.ListHandler())
kolReferral.POST("", middleware.RoleRequired("super_admin"), kolHandler.CreateHandler())
kolReferral.PATCH("/:eoa", middleware.RoleRequired("super_admin"), kolHandler.UpdateHandler())
kolReferral.DELETE("/:eoa", middleware.RoleRequired("super_admin"), kolHandler.DeleteHandler())
```

---

## Task C：改 Deposit 确认逻辑

**文件**: `internal/service/presale_deposit_impl.go`

找到 `ConfirmDeposit` / `ReportTx` 中计算 `referralRewardOdd` 的地方，在读取 `round.ReferralRewardPct` 之后，插入 KOL 查询逻辑：

```go
// 优先使用 KOL 自定义返佣比例，无记录则回落轮次全局比例
referralPct := round.ReferralRewardPct
if referrerEoa != nil && *referrerEoa != "" && s.kolRepo != nil {
    if kol, err := s.kolRepo.GetByEoa(ctx, *referrerEoa); err == nil {
        referralPct = kol.ReferralPct // KOL 自定义覆盖
    }
    // ErrKolNotFound 时静默忽略，继续用全局比例
}
referralRewardOdd = sharesOdd.Mul(referralPct).Div(decimal.NewFromInt(100))
```

`kolRepo` 通过构造函数注入（`presaleDepositService` struct 加 `kolRepo KolReferralPctRepository` 字段）。

---

## 测试要求

### Repository 测试（table-driven）

| 用例 | 期望 |
|------|------|
| Upsert 新 EOA | 返回 nil，DB 有记录 |
| Upsert 已有 EOA | 覆盖 pct，不报错 |
| GetByEoa 存在 | 返回正确 pct |
| GetByEoa 不存在 | 返回 ErrKolNotFound |
| Delete 存在 | found=true |
| Delete 不存在 | found=false |

### Deposit 逻辑测试

| 用例 | 期望 |
|------|------|
| referrer 无 KOL 记录 | 用 round.ReferralRewardPct |
| referrer 有 KOL 记录（pct=8%） | 用 8%，referral_reward_odd 按 8% 计算 |
| kolRepo 查询报错（非 NotFound） | 降级用全局 pct，不影响入账 |

---

## 不做什么

- 不改已有 deposit 历史记录（比例已快照，不回填）
- 不实现按轮次区分的 KOL 比例（全局 KOL 维度，一个地址一个比例）
- 不暴露 KOL 比例给 C 端用户（内部 admin only）
