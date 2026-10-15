"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import { useEarlyBird, type EarlyBirdStep } from "./EarlyBirdProvider";
import Step1Form from "./Step1Form";
import Step2SocialFollow from "./Step2SocialFollow";

interface EarlyBirdRegistrationModalProps {
  open: boolean;
  step: EarlyBirdStep;
  onClose: () => void;
  setStep: (s: EarlyBirdStep) => void;
}

/**
 * EarlyBirdRegistrationModal (DD-103)
 *
 * 双步状态机宿主。复用 components/ui/Modal 拿到 PC 居中 / H5 底部抽屉 + Esc + scroll lock，
 * 自带 close 按钮，不显式传 onBack（早鸟流程只前进不回退）。
 *
 * Step 1: 表单（邮箱 + BSC 地址 + 最期待功能）→ 提交后切 Step 2
 * Step 2: 社媒外跳 + 完成按钮 — 由 Batch 4 实现，本 batch 占位
 */
export default function EarlyBirdRegistrationModal({
  open,
  step,
  onClose,
  setStep,
}: EarlyBirdRegistrationModalProps) {
  const t = useTranslations("earlyBird");
  const { setRank } = useEarlyBird();
  const stepKey = step === 1 ? "step1" : "step2";
  const title = t(`${stepKey}.title`);
  const iconSrc = step === 1 ? "/images/status/congrats.png" : "/images/status/success.png";

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={title}
      className="max-h-[80vh] max-md:max-h-[80vh]"
    >
      <div className="flex flex-col items-center gap-8 pb-2">
        {/* Status icon — Figma 80×80, 复用 public/images/status/ */}
        <div className="relative size-[80px] shrink-0">
          <Image src={iconSrc} alt="" fill sizes="80px" priority />
        </div>

        {/* Heading section — Figma 6086:3758 gap-8 between heading and intro/hint group */}
        <div className="flex flex-col items-stretch gap-2 w-full">
          <h2 className="text-[20px] leading-[28px] font-semibold text-primary">
            {t(`${stepKey}.heading`)}
          </h2>
          {step === 1 ? (
            <div className="flex flex-col gap-1">
              <p className="text-[14px] leading-[18px] font-medium text-brand-default">
                {t("step1.formIntro")}
              </p>
              <p className="text-[14px] leading-[18px] text-tertiary">{t("step1.formHint")}</p>
            </div>
          ) : (
            <p className="text-[18px] leading-[26px] text-secondary">{t("step2.subheading")}</p>
          )}
        </div>

        {step === 1 ? (
          <Step1Form
            onSubmit={(payload) => {
              setRank(payload.rank);
              setStep(2);
            }}
          />
        ) : (
          <Step2SocialFollow onDone={onClose} />
        )}
      </div>
    </Modal>
  );
}
