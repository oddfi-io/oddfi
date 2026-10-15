// 积分榜占位页 — D18
// Server Component，静态 Mock 数据，无需 API 调用

// 地址脱敏：保留前 6 位和后 5 位
function truncateAddress(addr: string): string {
  if (addr.length <= 13) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-5)}`;
}

interface LeaderEntry {
  rank: number;
  address: string;
  points: number;
  badge: string;
}

const LEADERBOARD: LeaderEntry[] = [
  { rank: 1, address: "0x355f8a3d9c7b4e2f1a5560k", points: 128450, badge: "传奇" },
  { rank: 2, address: "0x97a4c2b8e3f1d5a9c7a1c9b", points: 98230, badge: "王者" },
  { rank: 3, address: "0x21f3d8c4a7b2e9f5d19bc23", points: 76180, badge: "钻石" },
  { rank: 4, address: "0x4a2f9c7d3b8e1a5f2b7c83f", points: 54320, badge: "铂金" },
  { rank: 5, address: "0x8b3e4a9c7f2d1b5e3a291a0", points: 43280, badge: "铂金" },
  { rank: 6, address: "0x6c5d2e8a3f7b9c1d4e5f62c", points: 38750, badge: "黄金" },
  { rank: 7, address: "0x3e7a5c9f2d4b8a1e6c7d83a", points: 32410, badge: "黄金" },
  { rank: 8, address: "0x9f4b2e7c5a3d8f1b6e4c91f", points: 27840, badge: "黄金" },
  { rank: 9, address: "0x7c1e5a8f3b9d2c4a7f5b2e3", points: 21960, badge: "白银" },
  { rank: 10, address: "0x2a8f4c7b9e5d3a1f8c6b0e7", points: 18320, badge: "白银" },
];

// 奖牌样式配置
const MEDAL_CONFIG: Record<
  number,
  { icon: string; labelClass: string; rowStyle: React.CSSProperties }
> = {
  1: {
    icon: "🥇",
    labelClass: "text-yellow-400 font-bold",
    rowStyle: {
      background: "rgba(251,191,36,0.07)",
      border: "1px solid rgba(251,191,36,0.3)",
      borderRadius: "12px",
    },
  },
  2: {
    icon: "🥈",
    labelClass: "text-gray-300 font-bold",
    rowStyle: {
      background: "rgba(209,213,219,0.06)",
      border: "1px solid rgba(209,213,219,0.25)",
      borderRadius: "12px",
    },
  },
  3: {
    icon: "🥉",
    labelClass: "text-orange-400 font-bold",
    rowStyle: {
      background: "rgba(249,115,22,0.07)",
      border: "1px solid rgba(249,115,22,0.28)",
      borderRadius: "12px",
    },
  },
};

// 徽章颜色映射
const BADGE_COLOR: Record<string, string> = {
  传奇: "text-yellow-300",
  王者: "text-purple-400",
  钻石: "text-blue-400",
  铂金: "text-cyan-300",
  黄金: "text-yellow-500",
  白银: "text-gray-400",
};

// 千位分隔符格式化（纯字符串处理）
function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-primary py-8 px-4 md:px-8">
      <div className="mx-auto mb-20" style={{ maxWidth: "720px" }}>
        {/* ── 页面标题 ── */}
        <div className="mb-8">
          <h1
            className="text-[28px] font-bold mb-2"
            style={{
              background: "linear-gradient(135deg, #ff2b3a 0%, #1fd07a 40%, #1062ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            积分榜
          </h1>
          <p className="text-secondary text-[14px]">TOP 10 · 按累计积分排名 · 每周更新</p>
        </div>

        {/* ── 排行榜卡片 ── */}
        <div
          className="rounded-24 pt-[18px] px-5 pb-5"
          style={{
            background:
              "radial-gradient(circle at 0 0, rgba(255,255,255,0.04), transparent 55%), rgba(15,23,42,0.96)",
            border: "1px solid rgba(148,163,184,0.5)",
            boxShadow: "0 22px 60px rgba(0,0,0,0.9)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <h2 className="text-base font-medium text-primary mb-4">本周排行</h2>

          <div className="space-y-2">
            {LEADERBOARD.map((entry) => {
              const medal = MEDAL_CONFIG[entry.rank];
              const badgeClass = BADGE_COLOR[entry.badge] ?? "text-secondary";

              return (
                <div
                  key={entry.rank}
                  className="flex items-center gap-4 px-4 py-3"
                  style={
                    medal?.rowStyle ?? {
                      borderBottom: entry.rank < 10 ? "1px solid rgba(31,41,55,0.6)" : "none",
                    }
                  }
                >
                  {/* 排名 / 奖牌 */}
                  <div className="w-8 text-center shrink-0">
                    {medal ? (
                      <span className="text-[20px]">{medal.icon}</span>
                    ) : (
                      <span className="text-[14px] font-medium text-tertiary">{entry.rank}</span>
                    )}
                  </div>

                  {/* 地址 */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-[13px] font-mono ${medal ? medal.labelClass : "text-primary"}`}
                    >
                      {truncateAddress(entry.address)}
                    </span>
                  </div>

                  {/* 徽章 */}
                  <div className="shrink-0">
                    <span
                      className={`text-[11px] px-2 py-[3px] rounded-full ${badgeClass}`}
                      style={{ border: "1px solid currentColor", opacity: 0.85 }}
                    >
                      {entry.badge}
                    </span>
                  </div>

                  {/* 积分 */}
                  <div className="text-right shrink-0">
                    <span
                      className={`text-[14px] font-semibold tabular-nums ${
                        medal ? medal.labelClass : "text-primary"
                      }`}
                    >
                      {formatNumber(entry.points)}
                    </span>
                    <span className="text-tertiary text-[11px] ml-1">pts</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 底部提示 */}
          <div
            className="mt-4 pt-4 text-center text-[12px] text-tertiary"
            style={{ borderTop: "1px solid rgba(31,41,55,0.6)" }}
          >
            实时排行榜与 WebSocket 推送功能即将上线
          </div>
        </div>

        {/* ── 积分规则说明 ── */}
        <div
          className="mt-4 rounded-24 px-5 py-4"
          style={{
            background: "rgba(16,98,255,0.06)",
            border: "1px solid rgba(16,98,255,0.2)",
          }}
        >
          <h3 className="text-[13px] font-medium text-fn-brand mb-3">积分获取方式</h3>
          <div className="grid grid-cols-2 gap-2 text-[12px] text-secondary">
            {[
              ["预测交易", "每笔 +10 pts"],
              ["做市流动性", "每日 +50 pts"],
              ["质押 PTK", "每日 +20 pts"],
              ["邀请好友", "每人 +100 pts"],
            ].map(([action, reward]) => (
              <div key={action} className="flex justify-between">
                <span>{action}</span>
                <span className="text-fn-green">{reward}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
