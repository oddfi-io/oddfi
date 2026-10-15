"use client";

/**
 * PetSprite — Codex Pets sprite-sheet 渲染组件（DD-112 §3.4）。
 *
 * 三种模式：
 *   - "static"：渲染 sprite-sheet col 0 row 0 静态 pose 帧。
 *   - "idleLoop"：row 0 / idle frames 无限循环，不响应 hover（FAB 用）。
 *   - "idleHoverCycle"：idle 循环 + hover/triggerCycleKey 触发一轮 9 state cycle 后回 idle。
 *
 * 实现策略（抄 codex-pets 官方）：单 keyframe pair `from 0% Y% → to endX% Y%`
 * + `easing: steps(state.frames)`（默认 jump-end，interval 内 hold step value）。
 * 9 state 各自帧数 / 时长由 CODEX_PET_STATES + stateDurationMs 提供。
 *
 * CDN 失败 → dog-avatar.png 兜底。prefers-reduced-motion → 静止 col 0 row 0（WCAG 2.2.2 AA）。
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  buildSpriteUrl,
  CODEX_PETS,
  CODEX_PET_STATES,
  findPet,
  SPRITE_COLS,
  SPRITE_ROWS,
  stateDurationMs,
  type CodexPet,
  type CodexPetState,
} from "@/lib/codex-pets/registry";

const FALLBACK_SRC = "/images/ai-agent/dog-avatar.png";
const IDLE_STATE = CODEX_PET_STATES[0];

type Mode = "static" | "idleLoop" | "idleHoverCycle";

interface PetSpriteProps {
  petId: string;
  size: number;
  mode: Mode;
  /** idleHoverCycle 模式下，该值变化时自动触发一轮 cycle 预览（首次挂载跳过）。 */
  triggerCycleKey?: string | number;
  className?: string;
  ariaLabel?: string;
}

/**
 * percentage bgPos 语义：x% × (image_width − container_width) 偏移。
 * bgSize 800% × 900% → image 8W × 9H → 1% x = 0.07W → col k = k/7 × 100%, row r = r/8 × 100%。
 */
function spritePosX(col: number): string {
  return `${(col / (SPRITE_COLS - 1)) * 100}%`;
}
function spritePosY(row: number): string {
  return `${(row / (SPRITE_ROWS - 1)) * 100}%`;
}

function buildStateKeyframes(state: CodexPetState): Keyframe[] {
  const y = spritePosY(state.row);
  return [
    { backgroundPosition: `0% ${y}` },
    { backgroundPosition: `${spritePosX(state.frames)} ${y}` },
  ];
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePetSpriteLoad(pet: CodexPet): "loading" | "ok" | "fail" {
  const [bgLoaded, setBgLoaded] = useState<"loading" | "ok" | "fail">("loading");
  useEffect(() => {
    let canceled = false;
    setBgLoaded("loading");
    const img = new window.Image();
    img.src = buildSpriteUrl(pet);
    img.onload = () => {
      if (!canceled) setBgLoaded("ok");
    };
    img.onerror = () => {
      if (!canceled) setBgLoaded("fail");
    };
    return () => {
      canceled = true;
    };
  }, [pet]);
  return bgLoaded;
}

function FallbackImage({
  size,
  ariaLabel,
  petName,
  className,
}: {
  size: number;
  ariaLabel?: string;
  petName: string;
  className?: string;
}) {
  return (
    <Image
      src={FALLBACK_SRC}
      alt={ariaLabel ?? petName}
      width={size}
      height={size}
      sizes={`${size}px`}
      className={cn("block object-contain", className)}
    />
  );
}

export function PetSprite(props: PetSpriteProps) {
  const pet = findPet(props.petId) ?? CODEX_PETS[0];

  if (props.mode === "static") {
    return <PetSpriteStatic {...props} pet={pet} />;
  }
  return <PetSpriteAnimated key={pet.id} {...props} pet={pet} />;
}

/** col 0 row 0 静态 pose 帧（codex-pets 协议）。 */
function PetSpriteStatic({ pet, size, className, ariaLabel }: PetSpriteProps & { pet: CodexPet }) {
  const bgLoaded = usePetSpriteLoad(pet);

  if (bgLoaded === "fail") {
    return (
      <FallbackImage
        size={size}
        ariaLabel={ariaLabel}
        petName={pet.displayName}
        className={className}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? pet.displayName}
      style={{
        width: size,
        height: size,
        backgroundImage: bgLoaded === "ok" ? `url(${buildSpriteUrl(pet)})` : undefined,
        backgroundSize: `${SPRITE_COLS * 100}% ${SPRITE_ROWS * 100}%`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "0% 0%",
      }}
      className={className}
    />
  );
}

/** 默认 idle 循环；mode=idleHoverCycle 时 hover/triggerCycleKey 串接 9 state 一轮后回 idle。 */
function PetSpriteAnimated({
  pet,
  size,
  mode,
  triggerCycleKey,
  className,
  ariaLabel,
}: PetSpriteProps & { pet: CodexPet }) {
  const ref = useRef<HTMLDivElement>(null);
  const idleAnimRef = useRef<Animation | null>(null);
  const cycleAnimRef = useRef<Animation | null>(null);
  const isFirstMount = useRef(true);
  const bgLoaded = usePetSpriteLoad(pet);

  const playIdleLoop = () => {
    const el = ref.current;
    if (!el) return;
    cycleAnimRef.current?.cancel();
    cycleAnimRef.current = null;
    idleAnimRef.current?.cancel();
    if (prefersReducedMotion()) {
      el.style.backgroundPosition = "0% 0%";
      return;
    }
    idleAnimRef.current = el.animate(buildStateKeyframes(IDLE_STATE), {
      duration: stateDurationMs(IDLE_STATE),
      easing: `steps(${IDLE_STATE.frames})`,
      iterations: Infinity,
    });
  };

  const playCycleOnce = async () => {
    const el = ref.current;
    if (!el) return;
    idleAnimRef.current?.cancel();
    if (prefersReducedMotion()) {
      playIdleLoop();
      return;
    }
    for (const state of CODEX_PET_STATES) {
      cycleAnimRef.current?.cancel();
      const anim = el.animate(buildStateKeyframes(state), {
        duration: stateDurationMs(state),
        easing: `steps(${state.frames})`,
        iterations: 1,
        fill: "forwards",
      });
      cycleAnimRef.current = anim;
      try {
        await anim.finished;
      } catch {
        return; // canceled
      }
      if (cycleAnimRef.current !== anim) return;
    }
    playIdleLoop();
  };

  useEffect(() => {
    if (bgLoaded !== "ok") return;
    playIdleLoop();
    return () => {
      idleAnimRef.current?.cancel();
      cycleAnimRef.current?.cancel();
    };
    // playIdleLoop 仅访问 refs，无 stale closure 风险
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgLoaded]);

  useEffect(() => {
    if (mode !== "idleHoverCycle") return;
    if (triggerCycleKey === undefined) return;
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (bgLoaded !== "ok") return;
    void playCycleOnce();
    // playCycleOnce 仅访问 refs，无 stale closure 风险
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerCycleKey, mode]);

  if (bgLoaded === "fail") {
    return (
      <FallbackImage
        size={size}
        ariaLabel={ariaLabel}
        petName={pet.displayName}
        className={className}
      />
    );
  }

  return (
    <div
      ref={ref}
      role="img"
      aria-label={ariaLabel ?? pet.displayName}
      onMouseEnter={mode === "idleHoverCycle" ? () => void playCycleOnce() : undefined}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${buildSpriteUrl(pet)})`,
        backgroundSize: `${SPRITE_COLS * 100}% ${SPRITE_ROWS * 100}%`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "0% 0%",
      }}
      className={className}
    />
  );
}
