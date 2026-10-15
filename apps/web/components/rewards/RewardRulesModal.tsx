"use client";

import { useTranslations } from "next-intl";

import Modal from "@/components/ui/Modal";

/**
 * RewardRulesModal —— 活动规则弹窗（Figma PC Modal 9020:161611 · H5 Sheet 9021:165453）。
 *
 * 复用 ui/Modal：其容器已是 `border-primary bg-fill-modal`、自带 #212124 关闭按钮、18px 居中标题，
 * 且 **自身已响应式**（PC 居中 dialog / H5 底部 sheet）—— 故无需 useIsPhone 分支 MobileBottomSheet。
 * 顶层单例（RewardHubPage 控制 groupId），按 group 展示对应规则（5 条编号规则 + 客服 CTA）。
 */
export function RewardRulesModal({
  groupId,
  onClose,
}: {
  groupId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("rewards.rules");
  const gid = groupId ?? "newbie";
  // t.raw 可能返回 undefined（新增 group 但漏补 i18n）→ 防御性收口，避免 .map 崩溃
  const rawItems = t.raw(`${gid}.items`);
  const items: { title: string; desc: string }[] = Array.isArray(rawItems) ? rawItems : [];

  return (
    <Modal isOpen={groupId !== null} onClose={onClose} title={t(`${gid}.title`)}>
      <div className="flex flex-col gap-6 pb-2">
        {items.map((rule, i) => (
          <div key={rule.title} className="flex w-full items-start gap-3">
            <span className="w-5 shrink-0 text-center font-orbitron text-sm font-bold leading-[21px] text-brand-default">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
              <p className="font-bold leading-[18px] text-primary">{rule.title}</p>
              <p className="font-normal leading-[18px] text-secondary">{rule.desc}</p>
            </div>
          </div>
        ))}

        <div className="flex flex-col items-center gap-4 pt-2">
          <p className="text-center text-xs leading-[18px] text-tertiary">
            {t.rich("contact", { tg: (chunks) => <span className="text-primary">{chunks}</span> })}
          </p>
          <button
            type="button"
            onClick={onClose}
            style={{ touchAction: "manipulation" }}
            className="flex h-12 w-full max-w-[360px] items-center justify-center rounded-xl bg-white text-sm font-medium leading-[18px] text-static-black transition hover:brightness-95"
          >
            {t("gotIt")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
