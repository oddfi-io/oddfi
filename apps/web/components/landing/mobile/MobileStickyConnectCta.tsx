"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/authStore";
import { MobileWalletConnectSheet } from "@/components/wallet/MobileWalletConnectSheet";

/**
 * Figma 6937:64309 — H5 落地页吸底 Connect Wallet（80px 容器 + 355×48 按钮）
 *
 * 双态行为：
 *   - 未登录 → 点击直接弹 MobileWalletConnectSheet（自带，sheet 关闭即 unmount）
 *   - 已登录 → Link /markets「进入预测」
 *
 * 不依赖 TopNav 里的 WalletConnectButton（DD-114 Round 2 修复：避免 SSR 水合时序失效）。
 * 钱包连接成功后 useAuth 将 isAuthenticated 写进 authStore，本组件自动重渲染为「进入预测」。
 */
const BTN_CLASS =
  "flex h-[48px] w-full items-center justify-center gap-[8px] rounded-[12px] bg-btn-primary px-[16px] font-noto-sc text-[14px] font-medium leading-[18px] text-static-black";
const BTN_STYLE = {
  touchAction: "manipulation" as const,
  boxShadow: "0px 1px 1px 0px rgba(0,0,0,0.1)",
};

export default function MobileStickyConnectCta() {
  const t = useTranslations("landing.mobile");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <div
        data-figma-node="6937:64309"
        className="fixed left-0 right-0 bottom-0 z-50 bg-primary pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-center px-[10px] pb-[16px]">
          {isAuthenticated ? (
            <Link
              href="/markets"
              data-figma-node="6937:64310"
              style={BTN_STYLE}
              className={BTN_CLASS}
            >
              {t("stickyEnter")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              data-figma-node="6937:64310"
              style={BTN_STYLE}
              className={BTN_CLASS}
            >
              {t("stickyConnect")}
            </button>
          )}
        </div>
      </div>
      <MobileWalletConnectSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
