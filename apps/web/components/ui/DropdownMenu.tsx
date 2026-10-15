"use client";

import { useState, useEffect, useRef } from "react";
import { CheckIcon } from "@phosphor-icons/react";

/* ------------------------------------------------------------------ */
/*  DropdownMenu — 共享下拉面板（毛玻璃 + 动画）                        */
/* ------------------------------------------------------------------ */

interface DropdownMenuProps {
  /** Render-prop trigger — 在 onClick 中调用 toggle */
  trigger: (props: { isOpen: boolean; toggle: () => void }) => React.ReactNode;
  /** Render-prop children — 调用 close 关闭面板 */
  children: (props: { close: () => void }) => React.ReactNode;
  /** 面板对齐方向 */
  align?: "left" | "right";
  /** 面板最小宽度（px） */
  minWidth?: number;
  /** 面板固定宽度（px），优先级高于 minWidth */
  width?: number;
  /** 根元素额外 className */
  className?: string;
  /** 面板额外 className（用于调整定位偏移等） */
  panelClassName?: string;
}

export function DropdownMenu({
  trigger,
  children,
  align = "left",
  minWidth = 160,
  width,
  className,
  panelClassName,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  const toggle = () => setIsOpen((o) => !o);
  const close = () => setIsOpen(false);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      {trigger({ isOpen, toggle })}

      <div
        className={`absolute top-full ${align === "right" ? "right-0" : "left-0"} mt-1.5 z-50 flex flex-col gap-[8px] p-[8px] rounded-12 border ${
          isOpen
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 -translate-y-2 scale-[0.96] pointer-events-none"
        } ${panelClassName ?? ""}`}
        style={{
          width,
          minWidth: width ? undefined : minWidth,
          maxWidth: "calc(100vw - 32px)",
          // Figma: var(--fill-input1) with 85% opacity for backdrop-blur; color-mix keeps it theme-aware
          background: "color-mix(in srgb, var(--fill-input1) 85%, transparent)",
          backdropFilter: "blur(6.5px)",
          WebkitBackdropFilter: "blur(6.5px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
          visibility: isOpen ? "visible" : "hidden",
          transition: isOpen
            ? "opacity 200ms ease-out, transform 200ms ease-out, visibility 0s 0s"
            : "opacity 150ms ease-in, transform 150ms ease-in, visibility 0s 150ms",
        }}
        role="menu"
        aria-hidden={!isOpen}
      >
        {children({ close })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DropdownMenuItem — 共享菜单项（选中态 / hover 态）                   */
/* ------------------------------------------------------------------ */

interface DropdownMenuItemProps {
  /** 高亮为当前选中项 */
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function DropdownMenuItem({
  selected,
  onClick,
  children,
  className,
}: DropdownMenuItemProps) {
  return (
    <button
      className={`flex items-center w-full gap-[8px] p-[8px] rounded-8 text-left transition-colors border-0 bg-transparent cursor-pointer touch-manipulation ${
        selected ? "" : "hover:bg-tertiary"
      } ${className ?? ""}`}
      onClick={onClick}
      role="menuitem"
    >
      {children}
      {selected && <CheckIcon size={16} weight="bold" className="ml-auto text-tertiary shrink-0" />}
    </button>
  );
}
