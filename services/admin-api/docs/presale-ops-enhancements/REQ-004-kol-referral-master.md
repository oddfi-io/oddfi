# REQ-004: KOL 特殊返佣比例 — 三方协作主计划

**状态**: 设计完成，待实施
**牵头**: admin-backend（先行实现 proxy 层）
**协作**: web-api（实现实际逻辑） + admin-frontend（实现 UI）

---

## 背景

当前返佣比例 (`referral_reward_pct`) 按轮次全局配置。部分 KOL 需要独立比例覆盖全局值。  
新增 `presale_kol_referral_pct` 表按 KOL 的 EOA 地址存储自定义比例；deposit 确认时优先使用该表值，无记录则回落全局轮次比例。

---

## 架构图

```
Admin Frontend (浏览器)
    ↓ GET/POST/PATCH/DELETE /admin/presale/kol-referral
Admin Backend (薄壳 proxy，:8081)
    ↓ 透传 JWT
Web-API (实际逻辑，:8080)
    ↓ 读写 presale_kol_referral_pct 表
MySQL (DB)
```

deposit 确认时：
```
presale_deposit_impl.go ConfirmDeposit
    → 查 presale_kol_referral_pct[referrer_eoa]
    → 命中 → 用 KOL 自定义比例
    → 未命中 → 用 round.referral_reward_pct（全局）
```

---

## API 契约（最终一致，三方共同遵守）

### 接口列表

| Method | Admin-Backend Path | 权限 | 说明 |
|--------|--------------------|------|------|
| GET    | `/admin/presale/kol-referral` | customer_service+ | 列表（支持 eoa 模糊搜索） |
| POST   | `/admin/presale/kol-referral` | super_admin | 新增（幂等，EOA 已存在则覆盖） |
| PATCH  | `/admin/presale/kol-referral/:eoa` | super_admin | 更新比例/备注 |
| DELETE | `/admin/presale/kol-referral/:eoa` | super_admin | 删除（回归全局比例） |

### GET 响应

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "list": [
      {
        "referrerEoa": "0xabc123...",
        "referralPct": "8.0000",
        "note": "KOL A 独家协议",
        "createdBy": "ou_lark_user_id",
        "createdAt": 1748390400000,
        "updatedAt": 1748390400000
      }
    ],
    "total": 5
  }
}
```

### POST 请求体

```json
{
  "referrerEoa": "0xabc123...",
  "referralPct": "8.00",
  "note": "KOL A 独家协议"
}
```

### PATCH 请求体（`:eoa` = URL encoded EOA）

```json
{
  "referralPct": "10.00",
  "note": "谈判后调整"
}
```

### 错误码

| code | HTTP | 触发场景 |
|------|------|---------|
| `INVALID_PARAM` | 400 | referralPct 非数字 / 超出范围 / referrerEoa 格式错误 |
| `KOL_NOT_FOUND` | 404 | PATCH/DELETE 指定 EOA 不存在 |
| `INSUFFICIENT_ROLE` | 403 | 非 super_admin 尝试写操作 |

---

## 开发顺序

```
Step 1  ← admin-backend（本 repo，你先做）
        · client/types.go 加 KOL DTO
        · handler/presale_kol_referral.go 薄壳 proxy
        · router/presale_routes.go 注册路由

Step 2  ← web-api agent（拿 REQ-004-kol-referral-webapi.md 去做）
        · migration: presale_kol_referral_pct 表
        · repository: CRUD + GetByEoa
        · handler/admin/kol_referral.go
        · router/admin_internal.go 注册路由
        · presale_deposit_impl.go ConfirmDeposit 注入 KOL 查询

Step 3  ← admin-frontend agent（拿 REQ-004-kol-referral-frontend.md 去做）
        · 认购菜单新增「特殊返佣」Tab
        · 列表 + 新增/编辑/删除 UI
        · 调用 Step 1 暴露的 admin-backend 接口
```

Step 2 和 Step 3 可**并行**开始（API 契约已固定），Step 1 的 admin-backend proxy 实现完成后可联调。

---

## 业务约束

- KOL 比例生效范围：所有轮次（不区分轮次，全局 KOL 维度）
- 历史已确认 deposit 不受影响（比例快照在落库时已固定）
- `referralPct` 合法范围：`0.0000` ~ `100.0000`（含边界），4 位小数
- EOA 统一小写标准化存储（写入前 `strings.ToLower`）
- 幂等：POST 同一 EOA 重复提交 → 覆盖更新（UPSERT），不报错
- 审计：所有写操作走 admin-backend 已有 audit middleware，`target_type="kol_referral"`, `target_id=referrerEoa`

---

## 子文档索引

- [REQ-004-kol-referral-webapi.md](./REQ-004-kol-referral-webapi.md) — web-api agent 任务说明
- [REQ-004-kol-referral-frontend.md](./REQ-004-kol-referral-frontend.md) — admin-frontend agent 任务说明
