"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function FixtureDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[FixtureDetail] Page error", error);
  }, [error]);

  const t = useTranslations("markets");

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6">
      <div className="bg-secondary rounded-16 border border-divider px-8 py-10 flex flex-col items-center gap-4 text-center">
        <h2 className="text-[18px] leading-[26px] font-semibold text-primary">{t("errorTitle")}</h2>
        <p className="text-[14px] leading-[19px] text-secondary">{t("errorDescription")}</p>
        <button
          onClick={reset}
          className="mt-2 px-6 py-2 rounded-8 bg-btn-primary hover:bg-btn-primary-hover text-static-black text-[14px] font-semibold transition-colors min-h-[44px]"
        >
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
