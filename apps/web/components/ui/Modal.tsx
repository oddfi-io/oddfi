"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon, ArrowLeftIcon } from "@phosphor-icons/react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  /** When true, hides the title section only. Close/back buttons are independent (controlled by showCloseButton/onBack) */
  hideHeader?: boolean;
  containerStyle?: React.CSSProperties;
  /** When provided, renders a back button at top-left */
  onBack?: () => void;
  /** Defaults to true. Set false to hide the close button */
  showCloseButton?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = "",
  hideHeader = false,
  containerStyle,
  onBack,
  showCloseButton = true,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Container: bottom sheet on mobile, centered dialog on desktop */}
      <div
        className={[
          "relative w-full border border-primary bg-fill-modal flex flex-col",
          // Desktop: centered, max-width constrained, rounded all sides — Figma: 440px, 16px radius
          "md:max-w-[440px] md:mx-4 md:rounded-16 md:animate-[slideDown_0.22s_ease-out]",
          // Mobile: pinned to bottom, rounded top only, constrain height
          "max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:rounded-t-16 max-md:animate-[slideUp_0.25s_ease-out] max-md:max-h-[90vh]",
          "backdrop-blur-[26px] shadow-modal",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          paddingBottom: "max(40px, env(safe-area-inset-bottom))",
          ...containerStyle,
        }}
      >
        {/* Close button — Figma spec: 24px visual, 44px touch target */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute right-[5px] top-[5px] z-10 flex items-center justify-center
                       min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation"
            aria-label="Close"
          >
            {/* @figma-hardcoded: #303033 btn-hover-bg — pending design token */}
            <span className="flex items-center justify-center size-[24px] rounded-8 bg-fill-input-modal hover:bg-[#303033] transition-colors">
              <XIcon size={16} weight="bold" className="text-primary" />
            </span>
          </button>
        )}

        {/* Back button — Figma spec: mirrors close button on the left */}
        {onBack && (
          <button
            onClick={onBack}
            className="absolute left-[5px] top-[5px] z-10 flex items-center justify-center
                       min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation"
            aria-label="Back"
          >
            {/* @figma-hardcoded: #303033 btn-hover-bg — pending design token */}
            <span className="flex items-center justify-center size-[24px] rounded-8 bg-fill-input-modal hover:bg-[#303033] transition-colors">
              <ArrowLeftIcon size={16} weight="bold" className="text-primary" />
            </span>
          </button>
        )}

        {/* Header title — Figma: 18px/bold, p-40 container, pr-[52px] prevents overlap; H5: px-[16px] */}
        {!hideHeader && title && (
          <div className="px-[16px] md:px-10 pt-10 pb-0 pr-[52px]">
            <h3 className="text-primary font-semibold text-[18px] leading-[26px] text-center">
              {title}
            </h3>
          </div>
        )}

        {/* Content — H5: px-[16px]; PC: px-40; scrollable on mobile */}
        <div className="px-[16px] md:px-10 pt-6 flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}
