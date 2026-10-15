"use client";

import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import MobileBottomSheet from "@/components/ui/MobileBottomSheet";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import TokenPickerContent from "./TokenPickerContent";
import type { PickerItem, PickerMode } from "./types";

interface TokenPickerModalProps {
  open: boolean;
  /** pay/receive 目前仅语义区分，UI 层面共用同一内容（Figma 标题固定 "Select token"）*/
  mode: PickerMode;
  onClose: () => void;
  onSelect: (item: PickerItem) => void;
  /** 当前已选 token id（`${chainId}:${symbol}`），用于列表高亮 */
  selectedId?: string;
  /** 另一侧已选中的 token id（防冲突 disable，DD-078 §3.3 D6） */
  disabledId?: string;
}

/**
 * Figma PC 节点 3371:68940 / H5 节点 3376:83701。
 * 响应式挂载：H5 → MobileBottomSheet；PC/wide/ultra → Modal。
 */
export default function TokenPickerModal({
  open,
  onClose,
  onSelect,
  selectedId,
  disabledId,
}: TokenPickerModalProps) {
  const t = useTranslations("swap.tokenPicker");
  const responsive = useResponsiveMode();
  const isH5 = responsive === "h5";
  const title = t("title");

  const content = (
    <TokenPickerContent
      selectedId={selectedId}
      disabledId={disabledId}
      onSelect={(item) => {
        onSelect(item);
        onClose();
      }}
    />
  );

  if (isH5) {
    return (
      <MobileBottomSheet
        open={open}
        onClose={onClose}
        title={title}
        showCloseButton
        showDragHandle={false}
        showHeaderDivider={false}
      >
        <div className="flex-1 min-h-0 overflow-y-auto px-[16px] pb-[8px] pt-[4px]">{content}</div>
      </MobileBottomSheet>
    );
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={title}>
      {content}
    </Modal>
  );
}
