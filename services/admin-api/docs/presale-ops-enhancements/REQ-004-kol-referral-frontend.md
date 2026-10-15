# REQ-004: KOL 特殊返佣 — admin-frontend 实施任务

**归属仓库**: `oddfi-admin-frontend`
**依赖**: admin-backend Step 1 完成即可联调（接口已固定）
**API 契约**: 见 [REQ-004-kol-referral-master.md](→ admin-backend/docs/reqs/)

---

## 任务概览

在认购菜单下新增「特殊返佣」Tab，提供 KOL 自定义返佣比例的 CRUD 管理界面。

---

## 接口信息（admin-backend 暴露）

Base URL：`/admin/presale/kol-referral`

| Method | Path | RBAC | 说明 |
|--------|------|------|------|
| GET | `/admin/presale/kol-referral` | 所有角色 | 列表，支持 `eoa` query 参数模糊搜索 |
| POST | `/admin/presale/kol-referral` | super_admin | 新增（幂等） |
| PATCH | `/admin/presale/kol-referral/:eoa` | super_admin | 更新比例 |
| DELETE | `/admin/presale/kol-referral/:eoa` | super_admin | 删除 |

### 列表响应

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "referrerEoa": "0xabc...",
        "referralPct": "8.0000",
        "note": "KOL A",
        "createdBy": "ou_xxx",
        "createdAt": 1748390400000,
        "updatedAt": 1748390400000
      }
    ],
    "total": 5
  }
}
```

### POST/PATCH 请求体

```json
{ "referrerEoa": "0xabc...", "referralPct": "8.00", "note": "备注" }
// PATCH 不需要 referrerEoa（EOA 在 URL path 里）
```

---

## UI 设计

### 菜单

在认购左侧菜单（`src/App.tsx` 或路由配置）中，现有项之后添加：

```
认购
  总览
  轮次管理
  入账记录
  异常事件
  全局配置  →（已由 REQ-002 改为「金库及TGE配置」）
  操作审计
  特殊返佣   ← 新增（路由：/presale/kol-referral）
```

**权限控制**：菜单所有角色可见；新增/编辑/删除按钮仅 `super_admin` 可见（用 `usePermissions` 或 `CanAccess`）。

### 页面：`src/pages/kol-referral/list.tsx`

**顶部搜索栏**：EOA 地址输入框（`/admin/presale/kol-referral?eoa=xxx`），查询 + 重置按钮。

**表格列**：

| 列名 | 字段 | 说明 |
|------|------|------|
| EOA 地址 | `referrerEoa` | 完整展示（42位），可复制，bscscan 链接 |
| 自定义返佣比例 | `referralPct` | 显示为 `8.00%` |
| 备注 | `note` | 文本，空时显示 `-` |
| 操作人 | `createdBy` | Lark user_id |
| 更新时间 | `updatedAt` | 格式化时间 |
| 操作 | - | 编辑 / 删除（仅 super_admin 可见） |

**右上角**：「新增 KOL」按钮（仅 super_admin 可见）

### 新增/编辑弹窗

```
Modal 标题：新增 KOL 特殊返佣 / 编辑返佣比例

表单字段：
  EOA 地址   [Input]   必填，0x 开头 42 位，编辑时只读
  返佣比例%  [InputNumber] 必填，0~100，精度 2 位小数，placeholder: "如 8.00"
  备注       [Input]   选填，最大 200 字
```

**删除**：二次确认 `Modal.confirm`，提示 `删除后该 KOL 将回归全局返佣比例，已有入账记录不受影响`。

---

## 文件清单（预估）

```
src/
  pages/
    kol-referral/
      list.tsx          ← 新建，列表 + 搜索 + 操作
  types/
    presale.ts          ← 新增 KolReferralItem 类型
  providers/
    dataProvider.ts     ← 如需新增 resource 映射
  App.tsx               ← 加路由 + 菜单项
```

---

## 技术规范

- 使用 `useTable` + `useCreate` + `useUpdate` + `useDelete`（refine hooks）
- EOA 显示复用 `TxHashLink` 组件（`kind="address"`，全量展示参考 REQ-002 B方案）
- 时间格式化复用 `formatTs`
- 金额/比例显示用 `AmountText` 或直接 `${Number(val).toFixed(2)}%`
- RBAC 判断：`const { data: permissions } = usePermissions()` 取 role，与 `"super_admin"` 比对

---

## 验收标准

- [ ] 左侧菜单出现「特殊返佣」入口
- [ ] 列表页正确展示 KOL 列表，EOA 完整展示，有 bscscan 跳转链接
- [ ] EOA 搜索筛选正常工作
- [ ] super_admin 可新增（弹窗 + 校验 + 幂等提交）
- [ ] super_admin 可编辑比例
- [ ] super_admin 可删除（二次确认）
- [ ] 非 super_admin 看不到新增/编辑/删除按钮
- [ ] 其他已有页面无回归
