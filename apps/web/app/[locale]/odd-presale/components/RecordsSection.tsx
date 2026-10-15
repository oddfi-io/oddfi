"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { CopyIcon } from "@phosphor-icons/react";
import { useReferralList } from "@/lib/presale/hooks/useReferralList";
import { truncateAddress } from "@/lib/proxy-wallet/utils";
import { formatAdaptiveAmount } from "@/lib/decimal";

/**
 * DD-146 B10 记录 —— Figma PC 8604:117991 / H5 8754:97558。
 *
 * tabs：交易记录 / 邀请记录。表列：时间 / 类型 / 金额 / 交易哈希。
 *   - 邀请记录：复用 useReferralList（已有数据），逐笔展示 joinedAt / 「邀请」tag / 累计返佣 ODD / 邀请人 eoa。
 *   - 交易记录：数据源未定（三方阻塞）→ 渲染空态占位（连接前给连接引导，连接后给「暂无 / 待对齐」）。
 *
 * Token：panel-gradient-border（卡片渐变描边，含 #111114 填充）· text-primary/secondary · text-brand-default ·
 *        类型 tag bg-tag-brand（fill/tag/brand-transparent #28f4d226）· 分割线 line/border-secondary #212124。
 */

const DASH = "--";

type RecordsTab = "tx" | "invite";

interface TableRow {
  time: string;
  /** 类型 tag 文案 */
  type: string;
  amount: string;
  /** 第四列：交易哈希 / 邀请人地址（截断展示），可复制原值 */
  hash: string;
  hashFull?: string;
}

/** 时间戳（秒/毫秒）→ MM/DD HH:mm。0 或非法值回落 DASH。 */
function formatRecordTime(ts: number): string {
  if (!ts || !Number.isFinite(ts)) return DASH;
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return DASH;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

export default function RecordsSection() {
  const t = useTranslations("token");
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<RecordsTab>("tx");

  const { data: referralList } = useReferralList();

  // 邀请记录：逐笔归一为表格行。
  const inviteRows = useMemo<TableRow[]>(() => {
    const items = referralList?.items ?? [];
    return items.map((it) => ({
      time: formatRecordTime(it.joinedAt),
      type: t("records.typeInvite"),
      amount: `${formatAdaptiveAmount(it.totalRewardOdd)} ODD`,
      hash: it.eoa ? truncateAddress(it.eoa, 6, 4) : DASH,
      hashFull: it.eoa || undefined,
    }));
  }, [referralList?.items, t]);

  // 交易记录：数据源未定（三方阻塞），暂为空。
  // TODO DD-146: 交易记录数据源待三方对齐（portfolio/history vs 链上事件），见 BACKEND.md §2.2
  const txRows: TableRow[] = [];

  const rows = tab === "tx" ? txRows : inviteRows;
  const emptyHint = !isConnected
    ? t("records.connectHint")
    : tab === "tx"
      ? t("records.txEmpty")
      : t("records.inviteEmpty");

  return (
    <section data-figma-pc="8604:117991" data-figma-h5="8754:97558" className="w-full">
      {/* ───────── H5（< md） ───────── */}
      <div className="flex flex-col gap-6 px-4 py-10 md:hidden">
        <Header t={t} />
        <Tabs tab={tab} onChange={setTab} t={t} />
        <RecordsTable rows={rows} emptyHint={emptyHint} t={t} />
      </div>

      {/* ───────── PC（md+） ───────── */}
      <div className="mx-auto hidden w-full max-w-[1440px] flex-col gap-10 px-[120px] py-20 md:flex">
        <Header t={t} />
        <div className="flex flex-col gap-6">
          <Tabs tab={tab} onChange={setTab} t={t} />
          <RecordsTable rows={rows} emptyHint={emptyHint} t={t} />
        </div>
      </div>
    </section>
  );
}

/** 标题：ODD 币图标 + 「记录」+ 副标题。 */
function Header({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col gap-3 md:gap-6">
      <div className="flex items-center justify-center gap-3 md:justify-start md:gap-6">
        {/* ODD 币矢量（复用 tokens/odd.svg：薄荷圆底 + ODD swoosh） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/tokens/odd.svg"
          alt=""
          aria-hidden
          className="size-6 shrink-0 rounded-full md:size-[37px]"
        />
        <h2 className="font-orbitron text-[24px] font-bold leading-8 tracking-[-0.24px] text-primary md:text-[48px] md:leading-[64px] md:tracking-[-1.44px]">
          {t("records.title")}
        </h2>
      </div>
      <p className="text-center font-noto-sc text-[12px] font-medium leading-[18px] text-secondary md:text-left md:text-[18px] md:leading-[26px]">
        {t("records.subtitle")}
      </p>
    </div>
  );
}

/** tabs：交易记录 / 邀请记录。激活态 brand mint 3px 下划线（左对齐、内容宽，非等宽）。 */
function Tabs({
  tab,
  onChange,
  t,
}: {
  tab: RecordsTab;
  onChange: (tab: RecordsTab) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const items: { key: RecordsTab; label: string }[] = [
    { key: "tx", label: t("records.tabTx") },
    { key: "invite", label: t("records.tabInvite") },
  ];
  return (
    <div role="tablist" className="flex gap-6">
      {items.map(({ key, label }) => {
        const active = key === tab;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            style={{ touchAction: "manipulation" }}
            className="relative flex min-h-[44px] flex-col items-center justify-center pb-3"
          >
            <span
              className={`font-noto-sc text-[16px] font-bold leading-6 md:text-[18px] md:leading-[26px] ${
                active ? "text-primary" : "text-secondary"
              }`}
            >
              {label}
            </span>
            {active && (
              <span
                aria-hidden
                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-brand-default"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 记录表：表头（时间/类型/金额/交易哈希）+ 分割线 + 行 / 空态。 */
function RecordsTable({
  rows,
  emptyHint,
  t,
}: {
  rows: TableRow[];
  emptyHint: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="panel-gradient-border flex w-full flex-col gap-6 rounded-[16px] p-5 md:rounded-[24px] md:p-10">
      {/* 表头 */}
      <div className="flex w-full items-center font-noto-sc text-[12px] font-normal leading-[18px] text-secondary md:text-[14px]">
        <span className="min-w-0 flex-1">{t("records.colTime")}</span>
        <span className="min-w-0 flex-1">{t("records.colType")}</span>
        <span className="min-w-0 flex-1">{t("records.colAmount")}</span>
        <span className="min-w-0 flex-1">{t("records.colHash")}</span>
      </div>
      {/* @figma-hardcoded: #212124 line/border-secondary — pending design token */}
      <div className="h-px w-full bg-[#212124]" />
      {/* 行 / 空态 */}
      {rows.length === 0 ? (
        <p className="py-6 text-center font-noto-sc text-[13px] font-normal leading-[18px] text-tertiary md:py-8 md:text-[14px]">
          {emptyHint}
        </p>
      ) : (
        <div className="flex w-full flex-col gap-6 md:gap-8">
          {rows.map((row, i) => (
            <Row key={i} row={row} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 单行：时间 / 类型 tag / 金额 / 哈希（截断 + 复制）。 */
function Row({ row, t }: { row: TableRow; t: ReturnType<typeof useTranslations> }) {
  const copyHash = () => {
    const value = row.hashFull ?? row.hash;
    if (!value || value === DASH) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(value).then(() => toast.success(t("records.hashCopied")));
    }
  };
  return (
    <div className="flex w-full items-center font-noto-sc text-[12px] font-normal leading-[18px] text-primary md:text-[14px]">
      <span className="min-w-0 flex-1">{row.time}</span>
      <span className="min-w-0 flex-1">
        <span className="inline-flex h-6 items-center justify-center rounded-[8px] bg-tag-brand px-3 py-0.5 text-[11px] font-medium leading-4 text-brand-default md:px-6">
          {row.type}
        </span>
      </span>
      <span className="min-w-0 flex-1">{row.amount}</span>
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <span className="truncate">{row.hash}</span>
        {row.hash !== DASH && (
          <button
            type="button"
            onClick={copyHash}
            style={{ touchAction: "manipulation" }}
            aria-label={t("records.copyHash")}
            className="flex size-5 shrink-0 items-center justify-center"
          >
            <CopyIcon size={16} weight="regular" className="text-secondary" />
          </button>
        )}
      </span>
    </div>
  );
}
