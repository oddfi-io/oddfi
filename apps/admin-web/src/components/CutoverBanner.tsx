// CutoverBanner — 切换期配置警示横幅。
// 当 presale_config.min_subscribe_usd 在数值上等于 0.01 时渲染，用于提醒运营当前处于测试期配置。
// 判定用 decimal.js 数值相等（"0.01" / "0.010000" 均命中），不用字符串 === 也不用 parseFloat。
// 契约：04-components.md §3。
import Decimal from "decimal.js";
import { useCustom } from "@refinedev/core";
import { Alert } from "antd";
import type { PresaleConfig } from "@/types/presale";

export function CutoverBanner(): React.ReactElement | null {
  // staleTime=60s: Banner is mounted in AdminHeader (always-on across page navigation);
  // without this, every route switch refetches /admin/presale/config. Sharing the same URL key
  // with config/index.tsx means the cached config is reused there too.
  const { result } = useCustom<PresaleConfig>({
    url: "admin/presale/config",
    method: "get",
    queryOptions: { staleTime: 60_000 },
  });
  const config = result?.data;

  if (!config) return null;

  const isCutover = (() => {
    try {
      return new Decimal(config.minSubscribeUsd).equals("0.01");
    } catch {
      return false;
    }
  })();

  if (!isCutover) return null;

  return (
    <Alert
      banner
      type="warning"
      showIcon
      message="准生产配置：当前最小认购 $0.01（测试期 / 资源调度中）"
      description="正式上线前须将最小认购改回 ≥1000 USDT，并确认金库地址已切换为正式合约（PATCH /config + 重启 presale-worker）。"
      closable={false}
    />
  );
}
