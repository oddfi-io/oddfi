"use client";

import { useState } from "react";
import { Switch } from "../ui/Switch";
import {
  DEFAULT_COUNTRIES,
  DEFAULT_PLAYERS,
  PUSH_TYPES,
  SOUND_PRESETS,
} from "@/lib/agent/mockData";
import { useWatchlist } from "@/lib/agent/watchlist";

export function PushTab() {
  const [watchlist, updateWatchlist] = useWatchlist();
  const countries = watchlist.countries;
  const players = watchlist.players;

  const [pushOn, setPushOn] = useState<Record<string, boolean>>(
    Object.fromEntries(PUSH_TYPES.map((p) => [p.id, p.defaultOn])),
  );

  const [soundId, setSoundId] = useState(SOUND_PRESETS[0].id);
  const [soundEnabled, setSoundEnabled] = useState(true);

  return (
    <section className="rounded-lg bg-card border border-edge p-6">
      <header className="flex items-baseline gap-2 mb-6 pb-4 border-b border-edge">
        <span className="font-mono text-xs text-ink-3">03</span>
        <h2 className="text-base font-semibold">关注与推送</h2>
        <span className="text-xs text-ink-3 ml-2">AI 主动给你说话的规则</span>
      </header>

      <ChipGroup
        title="关注国家"
        hint="只推送命中关注词的新闻；点 ✕ 移除，回车添加"
        options={countries}
        defaults={DEFAULT_COUNTRIES}
        onChange={(next) => updateWatchlist({ countries: next })}
      />

      <ChipGroup
        title="关注球星"
        hint="只推送命中关注词的新闻；点 ✕ 移除，回车添加"
        options={players}
        defaults={DEFAULT_PLAYERS}
        onChange={(next) => updateWatchlist({ players: next })}
      />

      <div className="grid grid-cols-[140px_1fr] gap-6 items-start mb-8">
        <div className="text-sm text-ink-2 pt-1">
          <div>推送类型</div>
          <div className="text-xs text-ink-3 mt-0.5 font-normal">
            单日软上限 4 条 / 硬上限 8 条
          </div>
        </div>
        <div className="space-y-3">
          {PUSH_TYPES.map((p) => (
            <div
              key={p.id}
              className="flex items-start justify-between gap-4 py-2 border-b border-edge last:border-b-0"
            >
              <div>
                <div className="text-sm">{p.title}</div>
                <div className="text-xs text-ink-3 mt-0.5">{p.description}</div>
              </div>
              <Switch
                checked={pushOn[p.id]}
                onChange={(v) => setPushOn((prev) => ({ ...prev, [p.id]: v }))}
                label={p.title}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[140px_1fr] gap-6 items-start">
        <div className="text-sm text-ink-2 pt-1">
          <div>提示音</div>
          <div className="text-xs text-ink-3 mt-0.5 font-normal">
            推送到达、节制器、新闻时播放
          </div>
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1.5 flex-wrap">
              {SOUND_PRESETS.map((s) => {
                const active = soundId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSoundId(s.id)}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                      active
                        ? "bg-accent-bg border-accent text-accent"
                        : "bg-elevated border-edge text-ink-2 hover:border-edge-light"
                    }`}
                  >
                    <span className={active ? "text-accent" : "text-ink-3"}>▶</span>
                    {s.name}
                  </button>
                );
              })}
            </div>
            <Switch
              checked={soundEnabled}
              onChange={setSoundEnabled}
              label="提示音总开关"
            />
          </div>
          <div className="text-xs text-ink-3 mt-2">
            点击 ▶ 试听 · 高优事件与节制器命中即使关闭也保留视觉提醒
          </div>
        </div>
      </div>
    </section>
  );
}

interface ChipGroupProps {
  title: string;
  hint: string;
  options: string[];
  defaults: string[];
  onChange: (next: string[]) => void;
}

function ChipGroup({ title, hint, options, defaults, onChange }: ChipGroupProps) {
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState("");

  const remove = (k: string) => onChange(options.filter((x) => x !== k));
  const add = () => {
    const trimmed = newItem.trim();
    if (trimmed && !options.includes(trimmed)) {
      onChange([...options, trimmed]);
    }
    setNewItem("");
    setAdding(false);
  };

  return (
    <div className="grid grid-cols-[140px_1fr] gap-6 items-start mb-8">
      <div className="text-sm text-ink-2 pt-1">
        <div>{title}</div>
        <div className="text-xs text-ink-3 mt-0.5 font-normal">{hint}</div>
      </div>
      <div>
        <div className="flex gap-1.5 flex-wrap">
          {options.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 bg-accent-bg border border-accent-border text-accent text-xs px-2.5 py-1 rounded-md"
            >
              {k}
              <button
                onClick={() => remove(k)}
                className="hover:text-ink ml-0.5"
                aria-label={`移除 ${k}`}
              >
                ✕
              </button>
            </span>
          ))}
          {adding ? (
            <input
              type="text"
              autoFocus
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onBlur={add}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
                if (e.key === "Escape") {
                  setNewItem("");
                  setAdding(false);
                }
              }}
              placeholder="输入后回车"
              className="bg-input border border-edge rounded-md px-2 py-1 text-xs w-28 focus:outline-none focus:border-accent"
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center text-xs px-2.5 py-1 rounded-md border border-dashed border-edge-light text-ink-3 hover:border-accent hover:text-accent transition-colors"
            >
              + 添加
            </button>
          )}
        </div>
        <div className="text-xs text-ink-3 mt-2">
          默认预填 {defaults.length} 个；点击 ✕ 移除，回车添加新词。
        </div>
      </div>
    </div>
  );
}
