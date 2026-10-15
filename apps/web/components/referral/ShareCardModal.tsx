"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { CopySimpleIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import MobileBottomSheet from "@/components/ui/MobileBottomSheet";
import StyledQRCode from "@/components/deposit/StyledQRCode";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteUrl: string;
  /** Shortened referrer address shown in the "Invited by" chip, e.g. "0x71...2278". 留空则不展示该 chip。 */
  inviterAddress?: string;
}

/**
 * Figma PC 节点 6163:89554 / H5 节点 6135:77933。
 * 响应式挂载：H5 → MobileBottomSheet（含 dragger）；PC → Modal（居中）。
 */
export default function ShareCardModal({
  isOpen,
  onClose,
  inviteUrl,
  inviterAddress,
}: ShareCardModalProps) {
  const t = useTranslations("referral");
  const isH5 = useResponsiveMode() === "h5";
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("[ShareCardModal] Failed to copy invite link", e);
    }
  }, [inviteUrl]);

  const handleSave = useCallback(async () => {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#111114",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `oddfi-invite-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("[ShareCardModal] Failed to export share card", e);
    } finally {
      setSaving(false);
    }
  }, [saving]);

  const card = (
    <div className="flex flex-col items-center gap-6">
      {/* Invitation Card — 300px wide, mirrors Figma 6163:89558（弹窗内可视形态）*/}
      <div
        className="w-[300px] rounded-12 border border-divider overflow-clip flex flex-col items-center pb-6"
        style={{ gap: 24 }}
      >
        {/* Brand header — bg brand mint, dark text */}
        <div
          className="w-full flex flex-col items-center py-4"
          style={{
            gap: 4,
            // @figma-hardcoded: #28f4d2 function/brand — pending design token
            background: "#28f4d2",
          }}
        >
          <p className="text-static-black font-bold" style={{ fontSize: 16, lineHeight: "24px" }}>
            {t("joinMeAtOddfi")}
          </p>
          <p
            className="text-static-black font-medium opacity-70"
            style={{ fontSize: 12, lineHeight: "18px" }}
          >
            {t("nextGenPrediction")}
          </p>
        </div>

        {/* QR + center logo — 复用 Step1ReceiveAddress 的 180×180 透明 QR + 圆形 logo overlay 结构 */}
        <div className="relative size-[180px]">
          <StyledQRCode value={inviteUrl} size={180} clearCenterSize={40} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="size-[30px] rounded-full flex items-center justify-center shadow-md"
              style={{
                // @figma-hardcoded: #28f4d2 text/brand-default — pending design token
                background: "#28f4d2",
              }}
            >
              <Image src="/images/logo-icon.svg" alt="OddFi" width={18} height={14} sizes="18px" />
            </div>
          </div>
        </div>

        {/* Invited by chip */}
        {inviterAddress && (
          <div
            className="rounded-8 flex items-center justify-center w-[212px] h-8"
            style={{
              gap: 4,
              // @figma-hardcoded: #212124 bg/tertiary — pending design token
              background: "#212124",
            }}
          >
            <span
              className="text-secondary font-medium"
              style={{ fontSize: 12, lineHeight: "18px" }}
            >
              Invited by
            </span>
            <span className="text-primary font-medium" style={{ fontSize: 12, lineHeight: "18px" }}>
              {inviterAddress}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons — Copy Link + Save */}
      <div className="flex gap-4 w-full">
        <button
          onClick={handleCopy}
          className="rounded-12 flex-1 h-12 flex items-center justify-center gap-2 min-h-[44px] touch-manipulation transition-colors"
          style={{
            // @figma-hardcoded: #212124 fill/button/tertiary-btn-default — pending design token
            background: "#212124",
          }}
        >
          <CopySimpleIcon size={20} className="text-primary" />
          <span className="text-primary font-medium" style={{ fontSize: 14, lineHeight: "18px" }}>
            {copied ? t("toastCopied") : t("copyLink")}
          </span>
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-btn-primary-white rounded-12 flex-1 h-12 flex items-center justify-center gap-2 min-h-[44px] touch-manipulation transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <DownloadSimpleIcon
            size={20}
            // @figma-hardcoded: #04060c text/static-black
            style={{ color: "#04060c" }}
          />
          <span
            className="font-medium"
            style={{
              fontSize: 14,
              lineHeight: "18px",
              // @figma-hardcoded: #04060c text/static-black
              color: "#04060c",
            }}
          >
            {t("save")}
          </span>
        </button>
      </div>
    </div>
  );

  /**
   * 离屏导出节点 — 严格 Figma 6169:90527 像素布局：
   * - 外层 #111114 不透明底
   * - 212×212 白底 QR 容器，黑色 QR 点（用 filter:invert 把 StyledQRCode 的白点翻成黑）
   * - 40×40 白方框中心 + 28×28 mint 圆 + logo（不参与 invert）
   * 仅 isOpen 时挂载，避免一直占内存。
   */
  const exportCard = isOpen ? (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        opacity: 0,
        zIndex: -1,
        pointerEvents: "none",
        // 注意：不要用 top/left 巨大负值移屏外 —— 浏览器渲染优化会跳过 paint，
        // html-to-image 抓不到 computed styles，导出全黑。也不要用 transform —— 同样会传染到导出图。
        // opacity:0 + zIndex:-1 让元素留在视口、保留 paint、用户不可见。
      }}
    >
      <div
        ref={cardRef}
        className="w-[300px] rounded-12 border border-divider overflow-clip flex flex-col items-center pb-6"
        style={{
          gap: 24,
          // @figma-hardcoded: #111114 fill/modal — opaque self-contained bg
          background: "#111114",
        }}
      >
        {/* Header — mint */}
        <div
          className="w-full flex flex-col items-center py-4"
          style={{ gap: 4, background: "#28f4d2" }}
        >
          <p className="text-static-black font-bold" style={{ fontSize: 16, lineHeight: "24px" }}>
            {t("joinMeAtOddfi")}
          </p>
          <p
            className="text-static-black font-medium opacity-70"
            style={{ fontSize: 12, lineHeight: "18px" }}
          >
            {t("nextGenPrediction")}
          </p>
        </div>

        {/* QR Container — 212×212 白底，黑色 QR 点 */}
        <div className="relative bg-white rounded-[14px] flex items-center justify-center size-[212px] p-4">
          <div style={{ filter: "invert(1)" }}>
            <StyledQRCode value={inviteUrl} size={180} clearCenterSize={40} />
          </div>
          {/* Center coin — 40×40 白方框 + 28×28 mint 圆 + logo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[40px] bg-white rounded-4 flex items-center justify-center p-[6px]">
            <div
              className="size-[28px] rounded-full flex items-center justify-center"
              style={{ background: "#28f4d2" }}
            >
              <Image src="/images/logo-icon.svg" alt="" width={18} height={14} sizes="18px" />
            </div>
          </div>
        </div>

        {/* Invited by chip */}
        {inviterAddress && (
          <div
            className="rounded-8 flex items-center justify-center w-[212px] h-8"
            style={{ gap: 4, background: "#212124" }}
          >
            <span
              className="text-secondary font-medium"
              style={{ fontSize: 12, lineHeight: "18px" }}
            >
              Invited by
            </span>
            <span className="text-primary font-medium" style={{ fontSize: 12, lineHeight: "18px" }}>
              {inviterAddress}
            </span>
          </div>
        )}
      </div>
    </div>
  ) : null;

  if (isH5) {
    return (
      <>
        {exportCard}
        <MobileBottomSheet
          open={isOpen}
          onClose={onClose}
          title={t("shareModalTitle")}
          showCloseButton
          showDragHandle
        >
          <div className="px-4 pt-2 pb-2 flex-1 min-h-0 overflow-y-auto">{card}</div>
        </MobileBottomSheet>
      </>
    );
  }

  return (
    <>
      {exportCard}
      <Modal isOpen={isOpen} onClose={onClose} title={t("shareModalTitle")}>
        {card}
      </Modal>
    </>
  );
}
