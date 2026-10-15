"use client";

import { useState } from "react";
import {
  MEMORY_CATEGORIES,
  MEMORY_SUMMARY,
  MEMORY_META,
  type MemoryObservation,
} from "@/lib/agent/mockData";

const CONFIDENCE_STYLES: Record<MemoryObservation["confidence"], { label: string; className: string }> = {
  high: { label: "高置信", className: "text-accent" },
  mid: { label: "中等", className: "text-warn" },
  low: { label: "尝试性", className: "text-info" },
};

export function MemoryTab() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    alert("导出 .md（mock）—— 实际接口待实现");
  };

  const handleClear = () => {
    if (confirm("⚠ 清空所有记忆？此操作不可恢复，AI 将重新认识你。")) {
      alert("清空成功（mock）—— 实际接口待实现");
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-card border border-edge p-6">
        <header className="mb-4">
          <h2 className="text-base font-semibold">AI 对你的整体认知</h2>
          <p className="text-xs text-ink-3 mt-1">这是 AI 用一段话总结的关于你的画像</p>
        </header>

        <div className="bg-elevated rounded-md p-4 border-l-2 border-accent mb-4">
          <p className="text-sm text-ink leading-relaxed">{MEMORY_SUMMARY}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <div>
            <span className="text-ink-3">最后更新</span>
            <span className="ml-2 text-ink-2">{MEMORY_META.lastUpdated}</span>
          </div>
          <div>
            <span className="text-ink-3">沉淀观察</span>
            <span className="ml-2 text-ink-2">{MEMORY_META.observationCount} 条</span>
          </div>
          <div>
            <span className="text-ink-3">数据基础</span>
            <span className="ml-2 text-ink-2">{MEMORY_META.dataBasis}</span>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleExport}
              className="text-xs px-3 py-1.5 rounded-md bg-elevated border border-edge text-ink-2 hover:border-edge-light transition-colors"
            >
              📥 导出全部记忆 .md
            </button>
            <button
              onClick={handleClear}
              className="text-xs px-3 py-1.5 rounded-md bg-elevated border border-edge text-danger hover:bg-danger-bg hover:border-danger transition-colors"
            >
              ⚠ 清空所有记忆
            </button>
          </div>
        </div>
      </section>

      {MEMORY_CATEGORIES.map((cat) => {
        const isOpen = expanded.has(cat.id);
        return (
          <section
            key={cat.id}
            className="rounded-lg bg-card border border-edge overflow-hidden"
          >
            <button
              onClick={() => toggle(cat.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-card-hover transition-colors"
            >
              <span className="text-lg">{cat.icon}</span>
              <h3 className="text-sm font-semibold">{cat.name}</h3>
              <span className="text-xs text-ink-3 bg-elevated px-2 py-0.5 rounded">
                {cat.observations.length} 条
              </span>
              {!isOpen && (
                <span className="text-xs text-ink-3 truncate flex-1 ml-2">
                  {cat.preview}
                </span>
              )}
              <span className={`ml-auto text-ink-3 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-edge px-4 pb-2">
                {cat.observations.map((obs, idx) => {
                  const conf = CONFIDENCE_STYLES[obs.confidence];
                  return (
                    <div
                      key={idx}
                      className="py-3 border-b border-edge last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="text-sm">{obs.text}</div>
                        <div className={`text-xs flex-shrink-0 ${conf.className}`}>
                          ● {conf.label}
                        </div>
                      </div>
                      <div className="text-xs text-ink-3">{obs.meta}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
