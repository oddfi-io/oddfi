# 04 · 可复用组件 · 二次确认模态 + 状态机可视化 + 其它

> 规则：`design-tokens.md`（走 token、字重 ≤600、6px 方角、不引新强调色、不引 Tailwind）、`code-quality.md`（运行时英语）。

> **🪶 轻开发原则（本期总纲）**：UI 极简、**优先复用 AntD 内置组件**，自研组件压到最少。
> 真正需要自研的只有 **ConfirmMutationModal**（因为要绑定 idempotency 生命周期 + note 校验，AntD `Modal.confirm` 不够）。其余尽量用 AntD：状态机用 `Steps`、diff 用 `Descriptions`/`Tag`、横幅用 `Alert banner`、金额/时间/链接是几行格式化函数包一层 `Typography.Text`。不写自研 CSS 图形、不引图表库。

---

## 1. ConfirmMutationModal — 二次确认模态（核心可复用件）

brief §五要求：所有破坏性 mutation 走模态二次确认，显示**操作对象 + 影响范围摘要 + note 输入（≥10 rune 实时校验）+ 确认/取消**，并集成 idempotency 生命周期。

**适用**：pause/resume/reopen/close、migrate-round、PATCH /rounds/:id、PATCH /config、anomaly/:id/resolve、admin-users delete/role。

**Props 设计**：

```ts
// src/components/ConfirmMutationModal.tsx
interface ConfirmMutationModalProps {
  open: boolean;
  title: string;                         // e.g. "暂停轮次 · 战略轮"
  target: { label: string; value: string }[]; // 操作对象摘要（轮次ID/当前状态/...）
  impact: React.ReactNode;               // 影响范围摘要（红橙强调，见 §03 各操作）
  danger?: boolean;                       // 危险操作 → 确认按钮 danger 红
  requireNote?: boolean;                  // 默认 true；admin-users role/delete 传 false
  extraFields?: React.ReactNode;          // 额外表单字段（targetRoundId 下拉 / resolution 单选 / 多字段）
  // 返回 Promise；resolve=成功关闭，reject=保持打开并就近报错
  onConfirm: (args: { note: string; idempotencyKey: string }) => Promise<void>;
  onCancel: () => void;
}
```

**关键行为**：

1. **note 实时校验**：AntD Form validator —— `[...note].length >= 10`（按 rune 计数，与后端 `len([]rune(note))` 一致，CJK 安全）。不足时确认按钮 disabled + 计数提示「还需 N 字」。
2. **idempotency 集成**：内部 `useIdempotencyKey()`（02-data-layer §6）。`onConfirm` 拿到当前 key；
   - 成功 → 关闭模态（卸载时 ref 重置，下次打开新 key）。
   - 失败 4xx → `rotate()` 轮换 key + 就近 `Alert` 报错（用户改 body 重试用新 key）。
   - 失败 5xx/超时 → 保持同 key，`Alert` 提示可重试。
3. **影响摘要醒目**：`impact` 区用 `colorWarning`/`colorError` token（不硬编码色），危险操作配 `<Alert type="warning">`。
4. **防重复提交**：确认期间按钮 loading + disabled。

**骨架**：

```tsx
export function ConfirmMutationModal(p: ConfirmMutationModalProps) {
  const { get, rotate } = useIdempotencyKey();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const noteOk = !p.requireNote || [...note].length >= 10;

  const handleOk = async () => {
    setLoading(true); setError(undefined);
    try {
      await p.onConfirm({ note, idempotencyKey: get() });
      setNote("");                       // 成功 → 重置
    } catch (e) {
      const err = e as ApiError;
      if (err.statusCode >= 400 && err.statusCode < 500) rotate(); // 4xx 轮换
      setError(mapError(err));           // 就近展示（02-data-layer §4 表）
    } finally { setLoading(false); }
  };

  return (
    <Modal open={p.open} title={p.title} onCancel={p.onCancel} onOk={handleOk}
      okButtonProps={{ danger: p.danger, disabled: !noteOk, loading }} okText="确认执行" cancelText="取消">
      <Descriptions column={1} size="small" items={p.target.map(t => ({ label: t.label, children: t.value }))} />
      <Alert type={p.danger ? "warning" : "info"} message={p.impact} style={{ margin: "12px 0" }} />
      {p.extraFields}
      {p.requireNote && (
        <Form.Item label="操作备注（≥10 字，会落审计）" validateStatus={noteOk ? "" : "warning"}
          help={noteOk ? undefined : `还需 ${10 - [...note].length} 字`}>
          <Input.TextArea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={500} />
        </Form.Item>
      )}
      {error && <Alert type="error" message={error} showIcon />}
    </Modal>
  );
}
```

> **为什么 note 用 rune 计数**：后端 `noteValidatorMW` 用 `len([]rune(peek.Note)) < 10`（router.go），即 Unicode 码点数。前端 `[...note].length` 与之对齐，避免「10 个汉字前端算够、后端按字节算不够」之类的错位（实际后端按 rune，所以一致）。

---

## 2. 轮次状态机可视化 —— 用 AntD `Steps`（不自研图形）

轻开发：直接用 AntD `<Steps>` 表达主线 `upcoming → active → ended`，paused / manualOverride 用 Steps 的 `status` + 旁边一个 `Tag` 表达，**不写自研 CSS/SVG**。

**状态机**（01-data-model §3.1 / §4.2）：

```
        cron 自动 (manual_override=0)
  ┌──────────┐        ┌──────────┐         ┌──────────┐
  │ upcoming │──────▶ │  active  │───────▶ │  ended   │
  └──────────┘ start  └──────────┘ end_ts  └──────────┘
                       ▲    │  │                 │
              resume   │    │  │ pause           │ reopen
                       │    ▼  ▼                 │ (manual_override=1
                      ┌──────────┐               │  end_ts 不变)
                      │  paused  │               │
                      └──────────┘               │
                            ▲────────────────────┘  reopen 后回到 active
   close: active|paused ─────────────────────────▶ ended
```

**渲染规则（`Steps` 映射）**：

```tsx
// 主线三步；paused 时把 active 步标黄(process+warning)，并在标题旁挂「已暂停」Tag
const STEP_INDEX: Record<RoundStatus, number> = { upcoming: 0, active: 1, paused: 1, ended: 2 };
<Steps
  size="small"
  current={STEP_INDEX[round.status]}
  status={round.status === "paused" ? "error" : "process"}  // error 复用红，仅作视觉强调
  items={[
    { title: "未开始" },
    { title: round.status === "paused" ? "进行中（已暂停）" : "进行中" },
    { title: "已结束" },
  ]}
/>
{round.manualOverride && <Tag color="warning" style={{ marginTop: 8 }}>手动干预中 · cron 已停止自动推进</Tag>}
```

- 不另写自研图形；`reopen`（ended→active）场景下 status 回到 active，Steps `current` 自然回退到 1。
- 配色走 AntD Steps 内置 + 既有语义色，不硬编码。

```tsx
// RoundStatusTag.tsx —— 状态语义色（只用既有强调色，design-tokens §5）
const STATUS: Record<RoundStatus, { color: string; text: string }> = {
  upcoming: { color: "default",    text: "未开始" },  // 灰
  active:   { color: "success",    text: "进行中" },  // 主题里 success=蓝 #0070f3
  paused:   { color: "warning",    text: "已暂停" },  // 橙
  ended:    { color: "default",    text: "已结束" },  // 灰
};
export const RoundStatusTag = ({ status }: { status: RoundStatus }) =>
  <Tag color={STATUS[status].color}>{STATUS[status].text}</Tag>;
```

> ⚠️ 不引入第六种强调色（design-tokens §5）：只用 default/success(蓝)/warning(橙)/error(红)。

---

## 3. CutoverBanner — cutover 警示横幅

brief §七：`presale_config.min_subscribe_usd === "0.01"` 时显示准生产配置警示（seed SQL：测试期 0.01，上线改 1000）。

```tsx
import Decimal from "decimal.js";
// ⚠️ 后端 DECIMAL(20,6) 可能序列化成 "0.01" 或 "0.010000"，不能用字符串 === 比较。
//    用 decimal 数值相等判定（仍不经 parseFloat，符合 api-conventions）。
const isCutover = (() => {
  try { return new Decimal(config.minSubscribeUsd).equals("0.01"); }
  catch { return false; }
})();
{isCutover && (
  <Alert banner type="warning" showIcon
    message="准生产配置：当前为测试金库 + 0.01 USDT 最小认购金额"
    description="上线前须同步切换正式金库地址并将最小认购改为 1000（PATCH /config + 重启 presale-worker）。"
  />
)}
```

- 放 Dashboard 顶部 + config 页顶部。判定用 `decimal.js` 数值相等（`"0.01"` 与 `"0.010000"` 都命中），**不用** `Number(x) === 0.01`（浮点不可靠）也**不用**字符串 `===`（精度位数不定）。

---

## 4. AuditDiff — before/after 对比（用 AntD `Descriptions`，不自研 diff）

轻开发：`beforeJson`/`afterJson` 是快照 JSON 字符串。`JSON.parse` 两边，对 key 求并集，用 **AntD `Descriptions`** 一 key 一行渲染 `before → after`，变化的行值后挂一个 `<Tag color="warning">变更</Tag>`。**不引 diff 库、不写自研高亮 DOM**。

- 等宽用 `Typography.Text code`（已是 Geist Mono）。
- `JSON.parse` 失败（脏数据）→ 原样字符串展示 + `console.warn("[AuditDiff] malformed audit json", ...)`（英语日志），不抛错、不 `dangerouslySetInnerHTML`（防 XSS）。

---

## 5. 其它小组件

| 组件 | 行为 |
|---|---|
| `AmountText` | `formatAmount(value, unit?)`：decimal.js 格式化（千分位、按 unit 截断小数），mono 字体。**禁 parseFloat/toFixed**。 |
| `TxHashLink` | `txHash` → `https://bscscan.com/tx/<hash>`，`address` → `/address/<addr>`，新标签打开 + 截断显示（`0x1234…abcd`）+ 复制按钮。 |
| `RoleGuard` | `rbac.md` 模板：`usePermissions` 取 role，`allow.includes(role)` 才渲染 children。仅控可见性。 |
| `AdminHeader` | 右上角 `getIdentity()` 头像 + name + role Tag + 退出（`authProvider.logout`）。 |
| `Forbidden` | 403 兜底页（越权直敲 URL 时），「无权限」+ 返回 Dashboard 按钮。 |

---

## 6. 设计 token 红线（落地自查，design-tokens.md）

- ❌ 任何 `style={{ color:'#xxx', fontSize, borderRadius }}` 硬编码 → 用 `theme.useToken()` 或 AntD 组件。
- ❌ `fontWeight: 700` / 裸 `<strong>` → 上限 600，用 `<Typography.Text strong>`。
- ❌ pill 按钮 `borderRadius:100` → 后台用默认 6px。
- ❌ `<Tag color="purple|magenta">` → 只用 default/success/warning/error。
- ❌ 引 Tailwind/styled-components/emotion。
- ✅ ::selection / 表头 / Sider 激活态等细节集中在 `src/theme/vercel.css`。
