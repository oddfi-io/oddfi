# DD002-T05 · docs/api.md 契约同步 + 联调 curl 集

> 方案：[`../DD.md`](../DD.md) §3.3
> 索引：[`./README.md`](./README.md)
> 前置：T04（路由定稿）
> 下游：T06（前端按契约开发）、联调 B（curl 契约集）

## 目标

docs/api.md 是前后端唯一契约——补齐信号灯模块全部章节，并产出联调 B 用的 curl 契约集。**本 task 草稿版可在 T04 前先行产出解锁 T06**（字段以方案 §3.3 为准），T04 后定稿。

## 文件清单

- `docs/api.md` — 修改：§1.2（4 新错误码）、§1.6（6 新路由行）、§3.12「赛事风险与信号灯（DD002）」新 block
- `docs/risk-signal-curl.md` — 新建：联调 B 契约 curl 集（每端点成功 + 各错误码触发样例，`| jq` 可验证）

## 接口设计 / 行为约定（必须写清的契约点）

- 全部响应示例中 ID 为**字符串**（`,string` 序列化），列表壳 `{list,total,page,page_size}`
- `signal` 枚举 `green/yellow/orange/red`；**判级源=方向级 maxL，展示量 max_exposure=adjMaxL，两者来源不同**（§3.1 双义注释，summary 的 `max_event_exposure` 与 list 行内 `max_exposure` 同词根不同义，分别注释）
- `signal` 多值=逗号分隔单 key（`?signal=red,orange`）
- null 组字段（lp_pool_amount / yield_ratio / score / settle_pl / times.settle / 调整历史 exposure & lp_ratio）标注「待 OPS-01d 点亮，当前恒 null」
- risk-decision 决策态状态机（effective_signal / pending_decision / 红灯重升重入队）整段搬 §3.3
- 错误码触发表：EVENT_NOT_FOUND / EVENT_NOT_RED_SIGNAL / RISK_DECISION_CONFLICT / UPSTREAM_UNAVAILABLE / INVALID_PARAM（缺幂等 key）

## 实施要点

- 对照 `api-docs-required.md` 自检 checklist 逐项过（commit-msg hook 阻断）
- curl 集对 mock-webapi（:8081→:9090 链路）全部实跑通过后才入库

## 测试要求

非代码 task：`docs/risk-signal-curl.md` 每条命令在联调 A 环境实跑，输出贴回文档注释。

## 验收

commit-msg hook 通过；前端同学（T06）仅凭 docs/api.md §3.12 可独立开发不需口头沟通。
