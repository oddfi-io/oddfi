"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { XIcon } from "@phosphor-icons/react";

export interface CreateAgentIntroModalProps {
  isOpen: boolean;
  onCreate: () => void;
  onSkip: () => void;
  onClose: () => void;
}

/**
 * CreateAgent 引导欢迎弹窗（DD-106 §2.5 D · Figma 6417:104402，714×392）。
 *
 * 出现条件：用户首次进入 /ai-agent 且 aiAgentStore.hasCreatedAgent === false。
 * - 「去设置」→ 进入 Wizard step=1
 * - 「以后再说」/ 右上关闭 → 关闭 Modal，hasCreatedAgent 仍 false
 *
 * 视觉：左白文 + 右像素插画拼贴。白色面板是设计稿的反相区，刻意保留以呼应品牌彩色头像生态。
 * 文案走 next-intl，9 语言。
 */
export function CreateAgentIntroModal({
  isOpen,
  onCreate,
  onSkip,
  onClose,
}: CreateAgentIntroModalProps) {
  const t = useTranslations("aiAgent.intro");
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="ai-agent-intro-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-fill-mask"
    >
      <div
        className="relative flex overflow-hidden rounded-2xl"
        style={{ width: 714, maxWidth: "92vw", height: 392 }}
      >
        {/* 左：白色文字面板 390×392 */}
        <div className="flex h-full w-[390px] shrink-0 flex-col justify-center bg-white p-10">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/ai-agent/intro-sparkle.svg"
                alt=""
                width={48}
                height={48}
                className="block"
              />
              <h2
                id="ai-agent-intro-title"
                // @figma-hardcoded: #04060c text/static-black — Figma 在白底用 static-black，沿用项目 token
                className="text-[32px] font-bold leading-[40px] tracking-[-0.32px] text-static-black"
              >
                {t("title")}
              </h2>
            </div>

            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={onCreate}
                // @figma-hardcoded: #111114 fill/button/primary-white-default（白底场景下的深色主按钮，区别于深色页 bg-btn-primary 的薄荷绿）
                className="flex h-11 cursor-pointer items-center justify-center rounded-full border-0 bg-[#111114] px-4 text-sm font-medium leading-[18px] text-white transition hover:opacity-90"
              >
                {t("cta")}
              </button>
              <button
                type="button"
                onClick={onSkip}
                // @figma-hardcoded: border #f1f1f1 fill/button/tertiary-btn-default — 白底场景的灰描边按钮
                className="flex h-11 cursor-pointer items-center justify-center rounded-full border border-solid border-[#f1f1f1] bg-white px-4 text-sm font-medium leading-[18px] text-static-black transition hover:bg-[#f7f7f8]"
              >
                {t("skip")}
              </button>
            </div>
          </div>
        </div>

        {/* 右：拼贴头像图（可视宽度 324，源图 441，object-cover 居中裁切） */}
        <div className="relative h-full flex-1 overflow-hidden bg-primary">
          <Image
            src="/images/ai-agent/intro-character.png"
            alt=""
            fill
            sizes="441px"
            className="object-cover"
            priority
            style={{ objectPosition: "center" }}
          />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-[14px] top-4 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-solid border-white bg-transparent text-white transition hover:bg-white/10"
          >
            <XIcon size={14} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
