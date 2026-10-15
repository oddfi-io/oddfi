// 数据分析占位页 — D18
// Server Component，静态 Mock 数据，无需 API 调用

interface KpiCard {
  label: string;
  value: string;
  sub: string;
  accent: string; // Tailwind text color class
}

const KPI_DATA: KpiCard[] = [
  {
    label: "总交易量",
    value: "$12,450,000",
    sub: "累计 USDT 成交",
    accent: "text-fn-green",
  },
  {
    label: "活跃市场",
    value: "328",
    sub: "当前进行中事件",
    accent: "text-fn-brand",
  },
  {
    label: "注册用户",
    value: "45,620",
    sub: "链上独立地址",
    accent: "text-fn-green",
  },
  {
    label: "累计结算",
    value: "$8,230,000",
    sub: "已兑付预测奖励",
    accent: "text-fn-brand",
  },
];

// 平台运营指标（图表占位区）
const METRICS = [
  { label: "日均交易量", value: "$415,000" },
  { label: "市场胜率（YES）", value: "52.3%" },
  { label: "平均持仓时间", value: "4.2 天" },
  { label: "本周新增用户", value: "1,280" },
  { label: "PTK 质押率", value: "67.8%" },
  { label: "流动性深度", value: "$3,120,000" },
];

export default function StatsPage() {
  return (
    <div className="min-h-screen bg-primary py-8 px-4 md:px-8">
      <div className="mx-auto mb-20" style={{ maxWidth: "1080px" }}>
        {/* ── Hero 区 ── */}
        <div className="mb-8">
          <h1
            className="text-[28px] md:text-[36px] font-bold mb-3"
            style={{
              background: "linear-gradient(135deg, #ff2b3a 0%, #1fd07a 40%, #1062ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            数据中心
          </h1>
          <p className="text-secondary text-[15px]">
            实时链上数据，透明可信 · 完整分析模块即将上线
          </p>
        </div>

        {/* ── KPI 卡片（4 列）── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {KPI_DATA.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-24 pt-5 px-5 pb-6"
              style={{
                background:
                  "radial-gradient(circle at 0 0, rgba(255,255,255,0.04), transparent 55%), rgba(15,23,42,0.96)",
                border: "1px solid rgba(148,163,184,0.5)",
                boxShadow: "0 22px 60px rgba(0,0,0,0.9)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              <p className="text-secondary text-[13px] mb-2">{kpi.label}</p>
              <p className={`text-[24px] font-bold mb-1 ${kpi.accent}`}>{kpi.value}</p>
              <p className="text-tertiary text-[12px]">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* ── 图表占位区 ── */}
        <div
          className="rounded-24 pt-[18px] px-5 pb-6 mb-6"
          style={{
            background:
              "radial-gradient(circle at 0 0, rgba(255,255,255,0.04), transparent 55%), rgba(15,23,42,0.96)",
            border: "1px solid rgba(148,163,184,0.5)",
            boxShadow: "0 22px 60px rgba(0,0,0,0.9)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <h2 className="text-base font-medium text-primary mb-5">交易量趋势</h2>

          {/* 图表占位 */}
          <div
            className="w-full rounded-16 flex items-center justify-center mb-5"
            style={{
              height: "200px",
              background: "rgba(255,255,255,0.03)",
              border: "1px dashed rgba(148,163,184,0.25)",
            }}
          >
            <div className="text-center">
              <p className="text-[32px] mb-2">📈</p>
              <p className="text-tertiary text-[13px]">图表模块即将上线</p>
            </div>
          </div>

          {/* 平台指标 6 格 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {METRICS.map((m) => (
              <div
                key={m.label}
                className="rounded-16 px-4 py-3"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(148,163,184,0.2)",
                }}
              >
                <p className="text-secondary text-[12px] mb-1">{m.label}</p>
                <p className="text-primary text-[16px] font-semibold">{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 即将上线横幅 ── */}
        <div
          className="rounded-24 px-6 py-8 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,43,58,0.12) 0%, rgba(31,208,122,0.08) 50%, rgba(16,98,255,0.12) 100%)",
            border: "1px solid rgba(148,163,184,0.3)",
          }}
        >
          <p className="text-[36px] mb-3">🚀</p>
          <h3 className="text-[18px] font-semibold text-primary mb-2">完整数据分析即将上线</h3>
          <p className="text-secondary text-[14px] max-w-md mx-auto">
            包含 K 线深度图、资金流向分析、市场情绪指数、用户行为漏斗等高级分析功能
          </p>
        </div>
      </div>
    </div>
  );
}
