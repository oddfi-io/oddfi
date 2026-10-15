"use client";

import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { XIcon, ArrowLeftIcon } from "@phosphor-icons/react";

// ─── MobileBottomSheet ────────────────────────────────────────────────────────
// Shared H5 bottom sheet with backdrop, drag handle, swipe-to-close, Escape key,
// and body scroll lock. Used by MobileBetSlipSheet, MobileMenuSheet settings, etc.

interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** z-index of the overlay, default 60 */
  zIndex?: number;
  /** Custom backdrop style, default: bg-black/60 */
  backdropClassName?: string;
  /** Custom backdrop inline style (e.g. blur) */
  backdropStyle?: React.CSSProperties;
  /** Sheet title, rendered in header row */
  title?: string;
  /** Show close (X) button at top-right. Defaults to false (pure gesture sheets unchanged) */
  showCloseButton?: boolean;
  /** When provided, renders a back button at top-left */
  onBack?: () => void;
  /** Show drag handle bar at top. Defaults to true */
  showDragHandle?: boolean;
  /** Show a divider line below the header. Defaults to false */
  showHeaderDivider?: boolean;
  /**
   * Sheet 高度 class，默认 "max-h-[85vh]"（现有所有调用方行为不变）。
   * 需要更高抽屉（如 AI 聊天）传 "h-[90vh]"。
   */
  heightClassName?: string;
  /**
   * true=内容自管滚动：sheet 本体去掉 `overflow-y-auto`，children 用 flex 布局自行分配
   * （消息区 `flex-1 overflow-y-auto` + composer `shrink-0` 固定底部）。
   * 默认 false（sheet 整体滚动，现有 deposit/wallet/betslip 行为不变）。
   */
  flushContent?: boolean;
}

const CLOSE_THRESHOLD = 80;

export default function MobileBottomSheet({
  open,
  onClose,
  children,
  zIndex = 60,
  backdropClassName,
  backdropStyle,
  title,
  showCloseButton = false,
  onBack,
  showDragHandle = true,
  showHeaderDivider = false,
  heightClassName = "max-h-[85vh]",
  flushContent = false,
}: MobileBottomSheetProps) {
  const hasHeader = showCloseButton || onBack || title;
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ startY: 0, currentY: 0, isDragging: false });

  // ── Body scroll lock ──
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // ── Escape to close ──
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // ── Swipe-to-close gesture ──
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const scrollable = sheet.querySelector("[data-scroll-content]") as HTMLElement | null;
    const isScrolledToTop = !scrollable || scrollable.scrollTop <= 0;
    const touchY = e.touches[0].clientY;
    const sheetRect = sheet.getBoundingClientRect();
    const touchInHeader = touchY - sheetRect.top < 60;

    if (isScrolledToTop || touchInHeader) {
      dragState.current = { startY: touchY, currentY: touchY, isDragging: true };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragState.current.isDragging || !sheetRef.current) return;
    const touchY = e.touches[0].clientY;
    const deltaY = touchY - dragState.current.startY;
    dragState.current.currentY = touchY;

    if (deltaY > 0) {
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
      sheetRef.current.style.transition = "none";
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragState.current.isDragging || !sheetRef.current) return;
    const deltaY = dragState.current.currentY - dragState.current.startY;
    dragState.current.isDragging = false;

    if (deltaY > CLOSE_THRESHOLD) {
      sheetRef.current.style.transition = "transform 200ms ease-out";
      sheetRef.current.style.transform = "translateY(100%)";
      setTimeout(onClose, 200);
    } else {
      sheetRef.current.style.transition = "transform 200ms ease-out";
      sheetRef.current.style.transform = "translateY(0)";
    }
  }, [onClose]);

  if (!open) return null;

  // Portal to document.body to escape any ancestor with backdrop-filter/transform
  // that creates a new containing block and breaks fixed positioning (e.g. TopNav header).
  return createPortal(
    <div className="fixed inset-0 lg:hidden" style={{ zIndex }}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 animate-[fadeIn_200ms_ease-out] ${backdropClassName ?? "bg-black/60"}`}
        style={backdropStyle}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 flex flex-col ${heightClassName} ${flushContent ? "" : "overflow-y-auto"} bg-primary border-t-2 border-l-2 border-r-2 border-secondary rounded-tl-16 rounded-tr-16 animate-[slideUp_300ms_ease-out] pb-[env(safe-area-inset-bottom)]`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle — 48x3px */}
        {showDragHandle && (
          <div className="sticky top-0 z-10 flex justify-center pt-[6px] pb-[3px]">
            <div className="w-[48px] h-[3px] rounded-full bg-fill-dragger" />
          </div>
        )}

        {/* Optional header: close / back / title — mirrors Modal spec */}
        {hasHeader && (
          <div className="relative flex items-center justify-center min-h-[44px] px-[16px]">
            {/* Back button — 44px touch target, 24px visual */}
            {onBack && (
              <button
                onClick={onBack}
                className="absolute left-[4px] top-0 z-10 flex items-center justify-center
                           min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation"
                aria-label="Back"
              >
                <span className="flex items-center justify-center size-[24px] rounded-8 bg-fill-input hover:bg-fill-hover transition-colors">
                  <ArrowLeftIcon size={16} weight="bold" className="text-primary" />
                </span>
              </button>
            )}

            {/* Title */}
            {title && (
              <span className="text-[16px] font-bold text-primary leading-[24px]">{title}</span>
            )}

            {/* Close button — 44px touch target, 24px visual */}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="absolute right-[4px] top-0 z-10 flex items-center justify-center
                           min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation"
                aria-label="Close"
              >
                <span className="flex items-center justify-center size-[24px] rounded-8 bg-fill-input hover:bg-fill-hover transition-colors">
                  <XIcon size={16} weight="bold" className="text-primary" />
                </span>
              </button>
            )}
          </div>
        )}

        {showHeaderDivider && hasHeader && <div className="h-px bg-divider" />}

        {children}
      </div>
    </div>,
    document.body
  );
}
