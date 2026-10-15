"use client";

import { AVATARS, getAvatar } from "@/lib/agent/avatars";
import {
  PERSONAS,
  getPersona,
  type PersonaId,
} from "@/lib/agent/personas";
import { useAgentProfile } from "@/lib/agent/profile";

const NICKNAME_MAX = 20;

export function BasicTab() {
  const [profile, updateProfile] = useAgentProfile();

  const avatar = getAvatar(profile.avatarId);
  const persona = getPersona(profile.personaId);

  const handlePickAvatar = (id: string) => {
    const a = getAvatar(id);
    if (profile.nicknameCustomized) {
      updateProfile({ avatarId: id });
    } else {
      updateProfile({ avatarId: id, nickname: a.nameEn });
    }
  };

  const handleNicknameChange = (v: string) => {
    const trimmed = v.length > NICKNAME_MAX ? v.slice(0, NICKNAME_MAX) : v;
    updateProfile({ nickname: trimmed, nicknameCustomized: true });
  };

  return (
    <section className="rounded-lg bg-card border border-edge p-6">
      <header className="flex items-baseline gap-2 mb-6 pb-4 border-b border-edge">
        <span className="font-mono text-xs text-ink-3">01</span>
        <h2 className="text-base font-semibold">基本资料</h2>
      </header>

      <div className="grid grid-cols-[140px_1fr] gap-6 items-start mb-8">
        <div className="text-sm text-ink-2 pt-2">头像与昵称</div>
        <div>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full bg-elevated border border-edge flex items-center justify-center text-3xl">
              {avatar.emoji}
            </div>
            <div>
              <div className="text-xs text-ink-3 mb-0.5">当前形象</div>
              <div className="text-base font-semibold">
                {avatar.nameEn} · {avatar.nameZh}
              </div>
              <div className="text-xs text-ink-3 font-mono mt-0.5">{avatar.id}</div>
            </div>
          </div>

          <div className="grid grid-cols-10 gap-2">
            {AVATARS.map((a) => {
              const isActive = profile.avatarId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => handlePickAvatar(a.id)}
                  className={`aspect-square rounded-md border flex items-center justify-center text-xl transition-all ${
                    isActive
                      ? "bg-accent-bg border-accent"
                      : "bg-elevated border-edge hover:border-edge-light"
                  }`}
                  title={`${a.id} · ${a.nameEn} · ${a.nameZh}`}
                  aria-label={`${a.nameEn} ${a.nameZh}`}
                >
                  {a.emoji}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[140px_1fr] gap-6 items-center mb-8">
        <div className="text-sm text-ink-2">自定义昵称</div>
        <div>
          <input
            type="text"
            value={profile.nickname}
            onChange={(e) => handleNicknameChange(e.target.value)}
            maxLength={NICKNAME_MAX}
            placeholder="输入你想要的昵称"
            className="w-full max-w-md bg-input border border-edge rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
          />
          <div className="text-xs text-ink-3 mt-1.5">
            {profile.nickname.length} / {NICKNAME_MAX} 字
            {profile.nicknameCustomized && (
              <span className="ml-2 text-accent">已锁定（切换头像不再覆盖）</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[140px_1fr] gap-6 items-start">
        <div className="text-sm text-ink-2 pt-2">
          <div>AI 类型</div>
          <div className="text-xs text-ink-3 mt-0.5 font-normal">
            决定 AI 的性格、语气与节制风格
          </div>
        </div>
        <div>
          <div className="inline-flex bg-elevated rounded-md p-1 border border-edge">
            {PERSONAS.map((p) => {
              const isActive = profile.personaId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => updateProfile({ personaId: p.id as PersonaId })}
                  className={`px-4 py-2 rounded text-sm transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? "bg-accent text-[#0a0e12] font-semibold"
                      : "text-ink-2 hover:text-ink"
                  }`}
                >
                  <span>{p.emoji}</span>
                  {p.name}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-ink-3 mt-3 leading-relaxed max-w-md">
            {persona.description}
          </div>
        </div>
      </div>
    </section>
  );
}
