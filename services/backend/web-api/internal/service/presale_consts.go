package service

// presale_consts.go 收敛 presale 域内需要跨文件/跨包严格同步的协议级常量。
//
// 设计原则：单点定义（避免 BUG-001 复盘的"双轨漏对称"反模式）。
// 任何在 service / chain 两条路径都需要使用的协议常量都应放到这里，
// 由两处 import 同一份值，杜绝静默不同步。

// Inv6BoundAtClockSkewMs 是 INV-6（时序保护）跨时钟域比较的容差。
//
// 比较 bind.BoundAt（服务器墙钟 UnixMilli，真 ms 精度）与 blockTs
// （`header.Time(秒) * 1000`，秒粒度向下取整后填零的"伪 ms"）时存在不可对齐：
//
//   ① blockTs 末三位恒为 000 — 秒粒度向下取整最多差 999ms
//   ② BSC 节点 vs 服务器墙钟漂移 ~1-2s
//
// 容差 5000ms 拆解：1000ms（精度对齐）+ 2000ms（节点漂移）+ 2000ms（安全垫）。
//
// 修复前：`bind.BoundAt < blockTs` — 同秒内"先绑后买"被误判为"先买后绑"，吞掉返佣。
// 修复后：`bind.BoundAt - Inv6BoundAtClockSkewMs < blockTs` — 容差吸收时钟域差。
//
// 已知残留风险：bound_at - blockTs ∈ [0, Inv6BoundAtClockSkewMs] 的真实"先买后绑"会被
// 误判为有效返佣。实际可达性低（用户需在 confirmed 上链后 ≤5s 内完成绑定操作），
// 单笔收益 ≤ amount × 10%，攻击 ROI 极低。
// 未来通过方案 D（bind 时快照 eth_blockNumber，比较 block_number 而非 timestamp）
// 根除，跟踪 TODO-009。
//
// 详见 .progress/bug/BUG-001-inv6-cross-clock-domain/BD.md
//
// 使用点（必须保持同步）：
//   - internal/service/presale_deposit_impl.go (ReportTx 路径)
//   - internal/chain/presale_listener.go      (Worker 路径)
const Inv6BoundAtClockSkewMs = int64(5_000)
