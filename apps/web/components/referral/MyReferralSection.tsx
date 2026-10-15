"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ShareCardModal from "./ShareCardModal";
import { IS_SUBSCRIPTION_MODE } from "@/lib/subscription-mode";

const INVITE_URL = "https://www.oddfi.io/referral/0x45623a";
const INVITER_ADDRESS = "0x71...2278";

export function MyReferralSection() {
  const t = useTranslations("referral");
  const [shareOpen, setShareOpen] = useState(false);
  return (
    <div className="pt-9 lg:pt-0 flex flex-col gap-6">
      {/* Section title */}
      <h2
        className="font-orbitron font-bold text-white text-center lg:text-left"
        style={{ fontSize: 20, lineHeight: "32px", letterSpacing: "-0.2px" }}
      >
        {t("myReferral")}
      </h2>

      {/* Card wrapper — bg on mobile, transparent on desktop */}
      <div className="bg-fill-card1 lg:bg-transparent rounded-16 px-4 py-5 lg:p-0 flex flex-col gap-3">
        {/* Invite Link group */}
        <div className="flex flex-col gap-4">
          <span className="text-secondary" style={{ fontSize: 14 }}>
            {t("myInviteLink")}
          </span>

          {/* Link display */}
          <div
            className="rounded-8 flex items-center px-3"
            style={{
              // @figma-hardcoded: #1c1c1f invite-input-bg — pending design token
              background: "#1c1c1f",
              height: 48,
            }}
          >
            <span className="text-primary" style={{ fontSize: 14 }}>
              https://www.oddfi.io/referral/0x45623a
            </span>
          </div>

          {/* Action buttons — DD-113 认购模式强制 disabled */}
          <div className="flex gap-6">
            <button
              disabled={IS_SUBSCRIPTION_MODE}
              className="bg-btn-primary rounded-12 text-static-black font-medium flex-1 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ height: 48, fontSize: 14 }}
            >
              {t("copyLink")}
            </button>
            <button
              onClick={IS_SUBSCRIPTION_MODE ? undefined : () => setShareOpen(true)}
              disabled={IS_SUBSCRIPTION_MODE}
              className="bg-btn-primary-white rounded-12 font-medium flex-1 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                height: 48,
                fontSize: 14,
                // @figma-hardcoded: #04060c share-card-btn-text — bg-primary dark text
                color: "#04060c",
              }}
            >
              {t("shareCard")}
            </button>
          </div>
        </div>

        {/* Referrer group */}
        <div className="flex flex-col gap-4">
          <span className="text-secondary" style={{ fontSize: 14 }}>
            {t("myReferrer")}
          </span>

          {/* Referrer display */}
          <div
            className="rounded-8 flex items-center px-3"
            style={{
              // @figma-hardcoded: #1c1c1f referrer-input-bg — pending design token
              background: "#1c1c1f",
              height: 48,
            }}
          >
            <span className="text-primary" style={{ fontSize: 14 }}>
              https://www.oddfi.io/referral/0x45623a
            </span>
          </div>

          {/* Bind button — DD-113 认购模式强制 disabled */}
          <button
            disabled={IS_SUBSCRIPTION_MODE}
            className="bg-btn-primary-white rounded-12 font-medium w-full min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              height: 48,
              fontSize: 14,
              // @figma-hardcoded: #04060c bind-btn-text — bg-primary dark text
              color: "#04060c",
            }}
          >
            {t("bind")}
          </button>
        </div>
      </div>

      <ShareCardModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        inviteUrl={INVITE_URL}
        inviterAddress={INVITER_ADDRESS}
      />
    </div>
  );
}
