"use client";

import { useTranslations } from "next-intl";
import SearchEmptyIcon from "@/components/icons/SearchEmptyIcon";

export default function SearchEmptyState() {
  const t = useTranslations("markets");

  return (
    <div className="flex flex-col items-center gap-6 py-20">
      <SearchEmptyIcon size={100} />
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-base font-medium text-primary">{t("searchEmptyTitle")}</p>
        <p className="text-xs font-medium text-tertiary">{t("searchEmptySubtitle")}</p>
      </div>
    </div>
  );
}
