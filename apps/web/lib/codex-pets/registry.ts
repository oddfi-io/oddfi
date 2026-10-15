/**
 * Codex Pets 注册表（DD-112）。
 *
 * 9 个 sprite-sheet 宠物的元数据 + URL 构造函数 + state 表，
 * 替换原 AI Agent 占位 dog PNG。spritesheet 走 codex-pets.net CDN
 * （immutable，version 锁路径），不本地下载。
 */

export interface CodexPet {
  id: string;
  version: number;
  displayName: string;
}

export const CODEX_PETS: readonly CodexPet[] = [
  { id: "cr7-striker", version: 1778763881731, displayName: "CR7" },
  { id: "goat", version: 1778196660686, displayName: "GOAT" },
  { id: "apupepe", version: 1777725238300, displayName: "Pepe" },
  { id: "golden-retriever", version: 1779193601711, displayName: "Golden" },
  { id: "ku", version: 1778839468010, displayName: "Ku" },
  { id: "goku", version: 1777711765138, displayName: "Goku" },
  { id: "doge", version: 1777715762673, displayName: "Doge" },
  { id: "octo", version: 1777692631573, displayName: "Octo" },
  { id: "kirby", version: 1778000704711, displayName: "Kirby" },
] as const;

export const DEFAULT_PET_ID = "cr7-striker";

/** Atlas 8 列 × 9 行 cells；每行有效帧数见 CODEX_PET_STATES。 */
export const SPRITE_COLS = 8;
export const SPRITE_ROWS = 9;

/**
 * codex-pets 协议 9 个 state（抄自官方 JS bundle）。
 * 每行有效帧数 frames 不一定 = SPRITE_COLS。col 0 是静态 pose（static 预览用），
 * anim 跑 from col 0 to col frames，jump-end 后实际显示 col 1..col frames。
 */
export interface CodexPetState {
  id: string;
  label: string;
  row: number;
  frames: number;
}

export const CODEX_PET_STATES: readonly CodexPetState[] = [
  { id: "idle", label: "Idle", row: 0, frames: 6 },
  { id: "running-right", label: "Run right", row: 1, frames: 8 },
  { id: "running-left", label: "Run left", row: 2, frames: 8 },
  { id: "waving", label: "Waving", row: 3, frames: 4 },
  { id: "jumping", label: "Jumping", row: 4, frames: 5 },
  { id: "failed", label: "Failed", row: 5, frames: 8 },
  { id: "waiting", label: "Waiting", row: 6, frames: 6 },
  { id: "running", label: "Running", row: 7, frames: 6 },
  { id: "review", label: "Review", row: 8, frames: 6 },
] as const;

/** 每帧 260ms / 最小循环 1400ms（与 codex-pets 官方 `Math.max(frames * 260, 1400)` 一致）。 */
export function stateDurationMs(state: CodexPetState): number {
  return Math.max(state.frames * 260, 1400);
}

const BASE = "https://codex-pets.net/assets/pets/v";

export function buildSpriteUrl(pet: CodexPet): string {
  return `${BASE}/${pet.version}/${pet.id}/spritesheet.webp`;
}

export function findPet(id: string): CodexPet | undefined {
  return CODEX_PETS.find((p) => p.id === id);
}

let spritesPreloaded = false;

/**
 * 预热全部 9 张 spritesheet 到浏览器缓存（DD-135 验收增强）。
 *
 * CDN URL 带 version 锁路径（immutable），new Image() 触发下载后，
 * PetSprite 的 usePetSpriteLoad 同 URL 直接命中缓存，避免进设置页
 * 才开始逐张拉图卡在空白/骨架态。幂等：module 级 flag，仅首次生效。
 * 调用点：AI 聊天窗口打开时（MobileAiChatSheet）。
 */
export function preloadPetSprites(): void {
  if (spritesPreloaded || typeof window === "undefined") return;
  spritesPreloaded = true;
  for (const pet of CODEX_PETS) {
    const img = new window.Image();
    img.src = buildSpriteUrl(pet);
  }
}
