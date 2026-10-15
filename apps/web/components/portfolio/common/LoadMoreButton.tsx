"use client";

// ASSETS.md 已查（关键词：LoadMore / load more / pagination），无可复用替代品，新建理由：Active/Settled/History 三处复用，避免重复内联

import { memo } from "react";
import { useTranslations } from "next-intl";

interface Props {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

function LoadMoreButton({ hasNextPage, isFetchingNextPage, onLoadMore }: Props) {
  const t = useTranslations("portfolio");

  if (!hasNextPage) return null;

  return (
    <div className="flex justify-center pt-[8px]">
      {/* @figma-hardcoded: #111114 fill-input1 — pending design token */}
      <button
        onClick={onLoadMore}
        disabled={isFetchingNextPage}
        style={{ touchAction: "manipulation" }}
        className="h-[44px] px-[32px] min-w-[160px] rounded-12 bg-[#111114] border-[0.5px] border-secondary text-[14px] text-primary hover:bg-secondary disabled:opacity-50 min-h-[44px]"
      >
        {isFetchingNextPage ? t("loadingMore") : t("loadMore")}
      </button>
    </div>
  );
}

export default memo(LoadMoreButton);
