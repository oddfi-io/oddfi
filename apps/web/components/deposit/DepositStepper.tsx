"use client";

import { useTranslations } from "next-intl";
import { CheckIcon } from "@phosphor-icons/react";

type StepState = "done" | "active" | "todo";

interface DepositStepperProps {
  currentStep: "amount" | "confirm";
}

const STEP_KEYS = ["selectCrypto", "inputAmount", "confirm"] as const;

function getStepStates(currentStep: "amount" | "confirm"): StepState[] {
  if (currentStep === "amount") return ["done", "active", "todo"];
  return ["done", "done", "active"];
}

function StepCircle({ state, number }: { state: StepState; number: number }) {
  if (state === "done") {
    return (
      <div className="size-[28px] rounded-full bg-white flex items-center justify-center shrink-0">
        <CheckIcon size={16} weight="bold" className="text-[#04060c]" />
      </div>
    );
  }

  if (state === "active") {
    return (
      <div className="size-[28px] rounded-full bg-white flex items-center justify-center shrink-0">
        <span className="text-[12px] font-bold text-[#04060c] leading-[18px]">{number}</span>
      </div>
    );
  }

  // todo
  return (
    <div className="size-[28px] rounded-full bg-fill-modal border border-[#212124] flex items-center justify-center shrink-0">
      <span className="text-[12px] font-bold text-tertiary leading-[18px]">{number}</span>
    </div>
  );
}

export function DepositStepper({ currentStep }: DepositStepperProps) {
  const t = useTranslations("deposit");
  const states = getStepStates(currentStep);

  // How far the white progress line extends: amount → 50%, confirm → 100%
  const progressWidth = currentStep === "amount" ? "50%" : "100%";

  return (
    <div className="relative flex items-start justify-between w-full px-[40px] shrink-0">
      {/* Background grey line */}
      <div className="absolute top-[14px] left-[90px] right-[90px] h-[1px] bg-[#212124]" />
      {/* White progress line */}
      <div
        className="absolute top-[14px] left-[90px] h-[1px] bg-white"
        style={{ width: progressWidth, maxWidth: "calc(100% - 180px)" }}
      />

      {STEP_KEYS.map((key, i) => (
        <div key={key} className="flex flex-col items-center gap-[8px] relative z-[1]">
          <StepCircle state={states[i]} number={i + 1} />
          <span
            className={[
              "text-[12px] font-medium leading-[18px] text-center whitespace-nowrap",
              states[i] === "todo" ? "text-tertiary" : "text-white",
            ].join(" ")}
          >
            {t(key)}
          </span>
        </div>
      ))}
    </div>
  );
}
