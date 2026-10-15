"use client";

import { useRef, useEffect } from "react";

/**
 * FAQ 折叠行 — 受控组件（Figma 节点 5523:54076 四态符号）
 *
 * 展开动画：WAAPI height 0→scrollHeight，cubic-bezier 弹性曲线（0.34,1.56,0.64,1）
 * 收起动画：ease-in-out，高度归 0
 * 中断安全：快速点击时先 pin 当前高度再启新动画，不闪烁
 */
type Props = {
  question: string;
  answer?: string;
  open: boolean;
  onToggle: () => void;
};

export default function FaqItem({ question, answer, open, onToggle }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // 首次渲染：直接设初始高度，不播动画
    if (isFirstRender.current) {
      isFirstRender.current = false;
      el.style.height = open ? "auto" : "0px";
      return;
    }

    // 先 pin 当前实际渲染高度，再 cancel fill —— 防止 cancel 导致高度跳变
    const currentH = el.getBoundingClientRect().height;
    animRef.current?.cancel();
    animRef.current = null;
    el.style.height = `${currentH}px`;

    const toH = open ? el.scrollHeight : 0;

    animRef.current = el.animate([{ height: `${currentH}px` }, { height: `${toH}px` }], {
      duration: 380,
      // 展开：弹性超调再回弹；收起：普通 ease
      easing: open ? "cubic-bezier(0.34, 1.56, 0.64, 1)" : "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "forwards",
    });

    animRef.current.onfinish = () => {
      if (!el) return;
      el.style.height = open ? "auto" : "0px";
      animRef.current?.cancel();
      animRef.current = null;
    };
  }, [open]);

  const borderClass = open ? "border-fn-brand" : "border-secondary hover:border-fn-brand";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      style={{ touchAction: "manipulation" }}
      className={`flex w-full flex-col items-start rounded-[20px] border border-solid p-[24px] text-left transition-colors min-h-[82px] ${borderClass} ${open ? "" : "justify-center"}`}
    >
      {/* 标题行：高度 26px，标题左对齐，+/- 图标右对齐 */}
      <div className="relative h-[26px] w-full shrink-0">
        <span className="font-noto-sc absolute left-0 top-1/2 -translate-y-1/2 whitespace-nowrap text-[18px] font-medium leading-[26px] text-white">
          {question}
        </span>
        <span
          aria-hidden="true"
          className="absolute right-0 top-1/2 size-[24px] -translate-y-1/2 opacity-70"
        >
          {/* 横线（始终显示） */}
          <span className="absolute left-1/2 top-1/2 h-[1.5px] w-[16.31px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          {/* 竖线（仅折叠时显示，构成 + 号） */}
          {!open && (
            <span className="absolute left-1/2 top-1/2 h-[16.31px] w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          )}
        </span>
      </div>

      {/* 答案区 — WAAPI 弹性高度，始终渲染避免 scrollHeight 计算失败 */}
      <div ref={contentRef} className="w-full overflow-hidden">
        {answer && (
          <div className="pt-[8px]">
            <span className="font-noto-sc block w-full whitespace-pre-line text-[14px] font-normal leading-[24px] text-white/70">
              {answer}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
