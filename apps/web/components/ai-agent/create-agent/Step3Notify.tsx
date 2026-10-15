"use client";

import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import Toggle from "@/components/ui/Toggle";
import { cn } from "@/lib/utils";
import type { AgentChannelId, AgentConfig } from "@/stores/aiAgentStore";

import { FollowChips } from "./FollowChips";
import { PushChannelRow } from "./PushChannelRow";
import { SoundPicker } from "./SoundPicker";

interface Step3NotifyProps {
  draft: AgentConfig;
  onChange: (patch: Partial<AgentConfig>) => void;
  /**
   * "card"（默认）= PC 自带卡片 chrome；
   * "plain" = DD-135 H5 设置大卡片内嵌：去自身 chrome，分区 px-4（设计稿 px-16）。
   */
  variant?: "card" | "plain";
}

/** AgentChannelId（kebab）→ i18n key（camel）映射 */
const CHANNEL_I18N_KEY: Record<AgentChannelId, string> = {
  "login-greet": "loginGreet",
  "pre-match": "preMatch",
  kickoff: "kickoff",
  recap: "recap",
  "high-priority-override": "highPriority",
};

/**
 * Wizard Tab 3 「推送」（DD-106 v3 · Figma 6566:154806 / 6566:154833）。
 *
 * 4 段标题（无序号）：关注国家 / 关注球星 / 推送类型 / 提示音
 * 整体被同一 form card（bg-secondary + border #212124 + py-6）包裹，section 间用通栏 divider 分隔。
 * 「推送类型」内的渠道列表额外包一层 bordered card（Figma 6566:154835）。
 */
export function Step3Notify({ draft, onChange, variant = "card" }: Step3NotifyProps) {
  const t = useTranslations("aiAgent.wizard.step3");
  const plain = variant === "plain";
  const sectionPx = plain ? "px-4" : "px-6";
  const updateChannel = (id: string, enabled: boolean) => {
    onChange({
      channels: draft.channels.map((c) => (c.id === id ? { ...c, enabled } : c)),
    });
  };

  return (
    // @figma-hardcoded: border #212124 line/border-secondary — pending design token
    <div
      className={cn(
        "flex w-full flex-col gap-6",
        !plain && "rounded-2xl border border-solid border-[#212124] bg-secondary py-6"
      )}
    >
      <Section
        paddingClassName={sectionPx}
        title={t("countries.title")}
        subtitle={t("countries.subtitle")}
      >
        <FollowChips
          i18nKey="countries"
          value={draft.countries}
          onChange={(countries) => onChange({ countries })}
        />
      </Section>

      {/* @figma-hardcoded: divider 通栏，色 #212124 与 card border 同源 */}
      <div aria-hidden className="h-px w-full bg-[#212124]" />

      <Section
        paddingClassName={sectionPx}
        title={t("players.title")}
        subtitle={t("players.subtitle")}
      >
        <FollowChips
          i18nKey="players"
          value={draft.players}
          onChange={(players) => onChange({ players })}
        />
      </Section>

      <div aria-hidden className="h-px w-full bg-[#212124]" />

      <Section
        paddingClassName={sectionPx}
        title={t("channels.title")}
        subtitle={t("channels.subtitle")}
      >
        {/* @figma-hardcoded: 推送类型表格外边框（Figma 6566:154835）
            bg-secondary 与外层同色但加一圈 border #212124 让"表格"独立于 section */}
        <div className="flex w-full flex-col rounded-lg border border-solid border-[#212124] bg-secondary py-2">
          {draft.channels.map((c, i, arr) => {
            const key = CHANNEL_I18N_KEY[c.id as AgentChannelId];
            return (
              <Fragment key={c.id}>
                <div className="px-4 py-3">
                  <PushChannelRow
                    label={key ? t(`channels.${key}.label`) : c.id}
                    hint={key ? t(`channels.${key}.hint`) : ""}
                    enabled={c.enabled}
                    onToggle={(v) => updateChannel(c.id, v)}
                  />
                </div>
                {i < arr.length - 1 && <div aria-hidden className="h-px w-full bg-[#212124]" />}
              </Fragment>
            );
          })}
        </div>
      </Section>

      <div aria-hidden className="h-px w-full bg-[#212124]" />

      {/* plain（H5 设置页 · Figma 7973:132123）：master Toggle 在「提示音」标题行右侧，chips 换行 */}
      <Section
        paddingClassName={sectionPx}
        title={t("sound.title")}
        subtitle={t("sound.subtitle")}
        titleAccessory={
          plain ? (
            <Toggle
              checked={draft.sound.enabled}
              onChange={(enabled) => onChange({ sound: { ...draft.sound, enabled } })}
              ariaLabel={t("sound.masterAria")}
            />
          ) : undefined
        }
      >
        <SoundPicker
          value={draft.sound}
          onChange={(sound) => onChange({ sound })}
          hideToggle={plain}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  paddingClassName = "px-6",
  titleAccessory,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  paddingClassName?: string;
  /** 标题行右侧附件（如「提示音」master Toggle，H5 设计稿 7973:132123）。 */
  titleAccessory?: ReactNode;
}) {
  return (
    <section className={cn("flex w-full flex-col gap-4", paddingClassName)}>
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium leading-6 text-primary">{title}</h3>
          {titleAccessory}
        </div>
        {subtitle && <p className="text-xs leading-[18px] text-tertiary">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}
