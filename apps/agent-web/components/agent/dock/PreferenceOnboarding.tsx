"use client";

import { type ReactNode } from "react";
import {
  TEAM_OPTIONS,
  PLAYER_OPTIONS,
  COMPETITION_OPTIONS,
  SOURCE_OPTIONS,
  FREQUENCY_OPTIONS,
  type UserPreferences,
} from "@/lib/agent/preferenceOptions";

interface PreferenceOnboardingProps {
  value: UserPreferences;
  onChange: (next: UserPreferences) => void;
  onSave: () => void;
}

const CHIP_BASE =
  "px-2.5 py-1 rounded-full text-[11px] border cursor-pointer transition-all duration-150 inline-flex items-center gap-1";
const CHIP_DEFAULT =
  "bg-dock-3 border-dock-edge text-[#8b8d93] hover:border-[#8b8d93] hover:text-white";
const CHIP_SELECTED =
  "bg-brand-fade border-brand text-brand font-semibold";

type ArrKey = "teams" | "players" | "competitions" | "sources";

export function PreferenceOnboarding({
  value,
  onChange,
  onSave,
}: PreferenceOnboardingProps) {
  const toggleArr = (key: ArrKey, val: string) => {
    const arr = value[key];
    const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
    onChange({ ...value, [key]: next });
  };

  const setFrequency = (id: string) => onChange({ ...value, frequency: id });

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-2 min-h-0">
        <div className="text-center mb-[18px] pt-1">
          <div className="text-[36px] leading-none mb-1.5">📡</div>
          <div className="text-base font-bold text-white mb-1">
            设置你的关注偏好
          </div>
          <div className="text-xs text-[#8b8d93] leading-[1.5]">
            关注的标的发生变化时，我会第一时间推给你
          </div>
        </div>

        <PrefSection icon="⚽" title="关注队伍" hint="多选">
          {TEAM_OPTIONS.map((t) => (
            <Chip
              key={t}
              active={value.teams.includes(t)}
              onClick={() => toggleArr("teams", t)}
            >
              {t}
            </Chip>
          ))}
        </PrefSection>

        <PrefSection icon="⭐" title="关注球员" hint="多选">
          {PLAYER_OPTIONS.map((p) => (
            <Chip
              key={p}
              active={value.players.includes(p)}
              onClick={() => toggleArr("players", p)}
            >
              {p}
            </Chip>
          ))}
        </PrefSection>

        <PrefSection icon="🏆" title="关注赛事" hint="多选">
          {COMPETITION_OPTIONS.map((c) => (
            <Chip
              key={c}
              active={value.competitions.includes(c)}
              onClick={() => toggleArr("competitions", c)}
            >
              {c}
            </Chip>
          ))}
        </PrefSection>

        <PrefSection icon="📊" title="信息源" hint="多选 · 决定数据来源优先级">
          {SOURCE_OPTIONS.map((s) => (
            <Chip
              key={s.id}
              active={value.sources.includes(s.id)}
              onClick={() => toggleArr("sources", s.id)}
            >
              <span>{s.icon}</span>
              {s.name}
            </Chip>
          ))}
        </PrefSection>

        <PrefSection icon="⏱" title="推送频率" hint="单选">
          {FREQUENCY_OPTIONS.map((f) => (
            <Chip
              key={f.id}
              active={value.frequency === f.id}
              onClick={() => setFrequency(f.id)}
            >
              <span>{f.icon}</span>
              {f.name}
            </Chip>
          ))}
        </PrefSection>
      </div>

      <div className="flex-shrink-0 px-4 pt-2 pb-3 bg-dock">
        <button
          type="button"
          onClick={onSave}
          className="w-full text-[13px] font-bold rounded-[10px] py-[11px] px-4 bg-brand text-[#04060c] hover:bg-brand-bright cursor-pointer transition-colors"
        >
          保存偏好 → 开启推送
        </button>
      </div>
    </div>
  );
}

function PrefSection({
  icon,
  title,
  hint,
  children,
}: {
  icon: string;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-4">
      <div className="flex items-center gap-1.5 mb-2 text-[11px]">
        <span className="font-bold text-[#8b8d93]">
          {icon} {title}
        </span>
        <span className="font-normal text-[10px] text-[#5c5d61]">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CHIP_BASE} ${active ? CHIP_SELECTED : CHIP_DEFAULT}`}
    >
      {children}
    </button>
  );
}
