# REQ-002: 管理后台前端 UI 微调（菜单文案 + EOA 全量展示）

**归属仓库**: `oddfi-admin-frontend`
**优先级**: P1
**负责人**: admin-frontend agent

---

## 背景

两处纯前端调整，不涉及任何后端接口变更。

---

## 需求 A：菜单文案修改

### 目标

侧边栏"全局配置"菜单项改名为**「金库及TGE配置」**。

### 定位

在 `oddfi-admin-frontend` 中搜索 `全局配置` 或 `config`（路由/菜单配置处），找到该菜单项的 label 并修改。

预期影响文件：导航/路由配置文件（如 `src/App.tsx`、`src/router.tsx`、`src/components/Layout.tsx` 或类似文件，具体以实际文件为准）。

**改动**：

```
"全局配置"  →  "金库及TGE配置"
```

页面标题（`<List title="...">` 或 `<Typography>` 等）如果也写了"全局配置"，同步修改为"金库及TGE配置"。

---

## 需求 B：入账记录 EOA 地址完整展示

### 目标

「入账记录」列表页 EOA 列当前显示截断地址（如 `0x5519...06a4`），改为**展示完整 EOA 地址**。

### 定位

文件：`src/pages/deposits/list.tsx`

当前 EOA 列使用 `TxHashLink` 组件：

```tsx
<Table.Column<Deposit>
  title="EOA"
  dataIndex="eoaAddress"
  render={(v: string) => (
    <span onClick={(e) => e.stopPropagation()}>
      <TxHashLink value={v} kind="address" />
    </span>
  )}
/>
```

检查 `TxHashLink` 组件（`src/components/TxHashLink.tsx` 或类似路径），确认截断逻辑在组件内部还是调用处。

**方案 1**（推荐）：如果 `TxHashLink` 支持 `truncate={false}` 或类似 prop，直接传参关闭截断：

```tsx
<TxHashLink value={v} kind="address" truncate={false} />
```

**方案 2**：如果组件不支持关闭截断，在 EOA 列的 render 里直接输出链接，不用 TxHashLink：

```tsx
render={(v: string) => (
  <span onClick={(e) => e.stopPropagation()}>
    <a
      href={`https://bscscan.com/address/${v}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ fontFamily: "monospace", fontSize: 12 }}
    >
      {v}
    </a>
  </span>
)}
```

> 仅改 `deposits/list.tsx` 的 EOA 列，不改 TxHash 列（TxHash 列保持截断以节省列宽），不改其他页面。

---

## 验收标准

- [ ] 侧边栏菜单显示"金库及TGE配置"（不再显示"全局配置"）
- [ ] 配置页面标题同步更新
- [ ] 入账记录列表 EOA 列显示完整 42 位地址（`0x` + 40 位十六进制）
- [ ] TxHash 列不受影响，保持截断展示
- [ ] 其他页面无回归
