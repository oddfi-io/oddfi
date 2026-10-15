"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { CopyIcon } from "@phosphor-icons/react";
import { useReferralMe } from "@/lib/presale/hooks/useReferralMe";
import { useBindReferral } from "@/lib/presale/hooks/useBindReferral";
import { mapBindErrorCode } from "@/lib/presale/error-map";
import { normalizeReferralCode, isValidReferralCode } from "@/lib/presale/referral-entry";
import { truncateAddress } from "@/lib/proxy-wallet/utils";
import { formatAdaptiveAmount } from "@/lib/decimal";
import ShareCardModal from "@/components/referral/ShareCardModal";

/**
 * DD-146 B8 邀请返佣 · 赚 10% —— Figma PC 8604:118118 / H5 8754:94198。
 *
 * 自包含数据交互（迁移自 invest/components/ReferralSection 的接线逻辑，按新 Figma 重写视图）：
 *   - useReferralMe：我的码 / 邀请人 / stats（已邀请人数 invitedCount + 累计返佣 totalRewardOdd）
 *   - useBindReferral：手动绑定推荐人（source:manual）
 *   - ShareCardModal（components/referral 通用版）：分享卡（inviteUrl + 邀请人 chip）
 * 未登录态：链接/stat 占位 + 按钮禁用，输入框引导连接钱包。
 *
 * Token：panel-gradient-border（卡片渐变描边，含 #111114 填充）/ fill-input-modal(#212124) · text-brand-default · text-static-black（白底按钮文字）。
 * 标题图标用设计导出的礼物矢量（public/images/referral/title-gift.svg，Figma 8604:118121，mint→white 渐变）。
 */

/** ky HTTPError → 业务码（proxy 透传 body.code），用于 bind 错误精确提示。 */
async function bizCodeFromError(err: unknown): Promise<number> {
  if (!err || typeof err !== "object" || !("response" in err)) return 0;
  try {
    const body = await (err as { response: Response }).response.clone().json();
    return typeof body?.code === "number" ? body.code : 0;
  } catch {
    return 0;
  }
}

export default function ReferralSection() {
  const t = useTranslations("token");
  const locale = useLocale();
  const { isConnected } = useAccount();
  const { data: referralMe } = useReferralMe();
  const bindMut = useBindReferral();

  const [inviterInline, setInviterInline] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  const myCode = referralMe?.myCode ?? null;
  // 统一用自己域名重写分享链接（落地 /odd-presale?ref=），config 未到位回落后端 shareLink。
  const shareLink = useMemo(() => {
    if (typeof window !== "undefined" && myCode) {
      return `${window.location.origin}/${locale}/odd-presale?ref=${myCode}`;
    }
    return referralMe?.shareLink ?? "";
  }, [myCode, locale, referralMe?.shareLink]);

  const inviterAddr = referralMe?.referrer?.eoa ?? null;
  const inviterCode = referralMe?.referrer?.code ?? null;
  const invitedCount = referralMe?.stats.invitedCount ?? 0;
  const totalRewardOdd = referralMe?.stats.totalRewardOdd ?? "0";

  const copyLink = useCallback(() => {
    if (!shareLink) {
      toast.info(t("referral.linkGenerating"));
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareLink).then(() => toast.success(t("referral.linkCopied")));
    }
  }, [shareLink, t]);

  // 手动绑（inline）：支持邀请链接末段或裸邀请码 → POST /referral/bind(source:manual)。
  const bindInviter = useCallback(() => {
    const raw = inviterInline.trim();
    if (!raw) {
      toast.warning(t("referral.inputEmpty"));
      return;
    }
    const tail = raw.includes("ref=") ? raw.split("ref=").pop()! : raw.split("/").pop() || raw;
    const code = normalizeReferralCode(tail);
    if (!isValidReferralCode(code)) {
      toast.warning(t("referral.codeInvalid"));
      return;
    }
    bindMut.mutate(
      { code, source: "manual", business: "presale" },
      {
        onSuccess: () => {
          setInviterInline("");
          toast.success(t("referral.bound"));
        },
        onError: async (err) =>
          toast.error(t(`referral.${mapBindErrorCode(await bizCodeFromError(err)).message}`)),
      }
    );
  }, [inviterInline, bindMut, t]);

  return (
    <section data-figma-pc="8604:118118" data-figma-h5="8754:94198" className="w-full">
      {/* ───────── H5（< md）：标题居中 + 卡片 + 2 stat ───────── */}
      <div className="flex flex-col items-center gap-6 px-4 py-10 md:hidden">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/referral/title-gift.svg" alt="" className="size-6 shrink-0" />
            <h2 className="font-orbitron text-[24px] font-bold leading-8 tracking-[-0.24px] text-primary">
              {t("referral.title")}
            </h2>
          </div>
          <p className="text-center font-noto-sc text-[12px] font-normal leading-[18px] tracking-[-0.12px] text-secondary">
            {t("referral.subtitle")}
          </p>
        </div>

        <div className="panel-gradient-border w-full rounded-[16px] px-4 py-6">
          <ReferralBody
            connected={isConnected}
            shareLink={shareLink}
            inviterAddr={inviterAddr}
            inviterCode={inviterCode}
            inviterInline={inviterInline}
            onInviterChange={setInviterInline}
            onCopyLink={copyLink}
            onShare={() => setShareOpen(true)}
            onBind={bindInviter}
            t={t}
          />
        </div>

        <div className="flex w-full gap-4">
          <StatCard value={String(invitedCount)} label={t("referral.invitedCount")} />
          <StatCard
            value={`$ ${formatAdaptiveAmount(totalRewardOdd)}`}
            label={t("referral.totalReward")}
          />
        </div>
      </div>

      {/* ───────── PC（md+）：标题 + 左卡 600px + 右 2 stat ───────── */}
      <div className="mx-auto hidden w-full max-w-[1440px] flex-col gap-10 px-[120px] py-20 md:flex">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/referral/title-gift.svg" alt="" className="size-9 shrink-0" />
            <h2 className="font-orbitron text-[48px] font-bold leading-[64px] tracking-[-1.44px] text-primary">
              {t("referral.title")}
            </h2>
          </div>
          <p className="font-noto-sc text-[18px] font-medium leading-[26px] text-secondary">
            {t("referral.subtitle")}
          </p>
        </div>

        <div className="flex w-full gap-10">
          <div className="panel-gradient-border w-[600px] shrink-0 rounded-[32px] p-12">
            <ReferralBody
              connected={isConnected}
              shareLink={shareLink}
              inviterAddr={inviterAddr}
              inviterCode={inviterCode}
              inviterInline={inviterInline}
              onInviterChange={setInviterInline}
              onCopyLink={copyLink}
              onShare={() => setShareOpen(true)}
              onBind={bindInviter}
              t={t}
            />
          </div>

          <div className="flex flex-1 flex-col gap-10">
            <StatCard
              value={String(invitedCount)}
              label={t("referral.invitedCount")}
              className="flex-1"
            />
            <StatCard
              value={`$ ${formatAdaptiveAmount(totalRewardOdd)}`}
              label={t("referral.totalReward")}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <ShareCardModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        inviteUrl={shareLink}
        inviterAddress={inviterAddr ? truncateAddress(inviterAddr, 6, 4) : undefined}
      />
    </section>
  );
}

/** 卡片主体：我的邀请（链接 + 复制 + 去邀请）+ 分割线 + 我的推荐人（已绑展示 / 输入 + 绑定）。 */
function ReferralBody({
  connected,
  shareLink,
  inviterAddr,
  inviterCode,
  inviterInline,
  onInviterChange,
  onCopyLink,
  onShare,
  onBind,
  t,
}: {
  connected: boolean;
  shareLink: string;
  inviterAddr: string | null;
  inviterCode: string | null;
  inviterInline: string;
  onInviterChange: (v: string) => void;
  onCopyLink: () => void;
  onShare: () => void;
  onBind: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* 我的邀请 */}
      <div className="flex flex-col gap-4 md:gap-6">
        <h3 className="text-center font-noto-sc text-[16px] font-bold leading-6 text-primary md:text-[20px] md:leading-7">
          {t("referral.myInviteTitle")}
        </h3>
        <div className="flex h-14 items-center justify-between gap-2 rounded-[12px] bg-fill-input-modal py-2 pl-4 pr-2">
          <span className="truncate font-noto-sc text-[14px] font-medium leading-[18px] text-primary">
            {connected
              ? shareLink || t("referral.linkGenerating")
              : t("referral.connectToViewLink")}
          </span>
          <button
            type="button"
            onClick={onCopyLink}
            disabled={!connected}
            title={t("referral.copyLinkBtn")}
            style={{ touchAction: "manipulation" }}
            className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-white transition-opacity disabled:opacity-40"
          >
            <CopyIcon size={18} weight="fill" className="text-static-black" />
          </button>
        </div>
        <button
          type="button"
          onClick={onShare}
          disabled={!connected}
          style={{ touchAction: "manipulation" }}
          className="flex h-12 w-full items-center justify-center rounded-[12px] bg-white font-noto-sc text-[14px] font-medium leading-[18px] text-static-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("referral.inviteBtn")}
        </button>
      </div>

      <div className="h-px w-full bg-divider" />

      {/* 我的推荐人 */}
      <div className="flex flex-col gap-4 md:gap-6">
        <h3 className="text-center font-noto-sc text-[16px] font-bold leading-6 text-primary md:text-[20px] md:leading-7">
          {t("referral.myReferrerTitle")}
        </h3>
        {connected && inviterAddr ? (
          <div className="flex items-center gap-2 rounded-[12px] bg-fill-input-modal px-4 py-3 font-noto-sc text-[14px]">
            <span className="font-mono text-primary">{truncateAddress(inviterAddr, 6, 4)}</span>
            <span className="text-tertiary">(BSC)</span>
            {inviterCode && (
              <span className="text-secondary">
                {t("referral.inviterCodeLabel")} {inviterCode}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <input
              type="text"
              placeholder={
                connected ? t("referral.inviterPlaceholder") : t("referral.connectToViewReferrer")
              }
              value={connected ? inviterInline || "" : ""}
              onChange={(e) => onInviterChange(e.target.value)}
              disabled={!connected}
              className="h-12 min-w-0 flex-1 rounded-[12px] bg-fill-input-modal px-4 font-noto-sc text-[14px] text-primary outline-none placeholder:text-tertiary disabled:opacity-60"
            />
            <button
              type="button"
              onClick={onBind}
              disabled={!connected}
              style={{ touchAction: "manipulation" }}
              className="h-12 w-20 shrink-0 rounded-[12px] bg-white font-noto-sc text-[14px] font-medium leading-[18px] text-static-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40 md:w-[120px]"
            >
              {t("referral.bindBtn")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** 右侧 stat 卡：brand 值 + 白标签。 */
function StatCard({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`panel-gradient-border flex flex-col items-start justify-center gap-1 rounded-[12px] p-4 md:gap-2 md:rounded-[24px] md:px-8 md:py-6 ${className ?? ""}`}
    >
      <span className="font-orbitron text-[18px] font-bold leading-[26px] tracking-[-0.18px] text-brand-default md:text-[28px] md:leading-9 md:tracking-[-0.28px]">
        {value}
      </span>
      <span className="font-noto-sc text-[12px] font-medium leading-[18px] text-primary md:text-[16px] md:leading-6">
        {label}
      </span>
    </div>
  );
}
