import { describe, expect, it, vi } from "vitest";

import {
  buildSpriteUrl,
  CODEX_PETS,
  CODEX_PET_STATES,
  DEFAULT_PET_ID,
  findPet,
  preloadPetSprites,
  SPRITE_COLS,
  SPRITE_ROWS,
  stateDurationMs,
} from "./registry";

describe("codex-pets/registry", () => {
  it("CODEX_PETS 至少 9 条，且 id 全部唯一", () => {
    expect(CODEX_PETS.length).toBeGreaterThanOrEqual(9);
    const ids = new Set(CODEX_PETS.map((p) => p.id));
    expect(ids.size).toBe(CODEX_PETS.length);
  });

  it("DEFAULT_PET_ID 必须能在 CODEX_PETS 找到", () => {
    expect(findPet(DEFAULT_PET_ID)).toBeDefined();
  });

  it("每个 pet 都有非空 displayName 与正整数 version", () => {
    for (const pet of CODEX_PETS) {
      expect(pet.displayName.length).toBeGreaterThan(0);
      expect(Number.isInteger(pet.version)).toBe(true);
      expect(pet.version).toBeGreaterThan(0);
    }
  });

  it("buildSpriteUrl 按 codex-pets CDN 规则拼接", () => {
    const pet = CODEX_PETS[0];
    expect(buildSpriteUrl(pet)).toBe(
      `https://codex-pets.net/assets/pets/v/${pet.version}/${pet.id}/spritesheet.webp`
    );
  });

  it("findPet 找到时返回对应对象，找不到返回 undefined", () => {
    expect(findPet(CODEX_PETS[1].id)).toEqual(CODEX_PETS[1]);
    expect(findPet("not-a-pet")).toBeUndefined();
  });

  it("Atlas 维度常量符合 codex-pets 8×9 规格", () => {
    expect(SPRITE_COLS).toBe(8);
    expect(SPRITE_ROWS).toBe(9);
  });

  it("CODEX_PET_STATES 含 9 个 state，idle 在 row 0 / 6 帧", () => {
    expect(CODEX_PET_STATES.length).toBe(9);
    expect(CODEX_PET_STATES[0]).toMatchObject({ id: "idle", row: 0, frames: 6 });
  });

  it("stateDurationMs 至少 1400ms，超过则按 frames × 260ms", () => {
    expect(stateDurationMs({ id: "x", label: "x", row: 0, frames: 4 })).toBe(1400);
    expect(stateDurationMs({ id: "x", label: "x", row: 0, frames: 6 })).toBe(1560);
    expect(stateDurationMs({ id: "x", label: "x", row: 0, frames: 8 })).toBe(2080);
  });

  it("preloadPetSprites 为每个 pet 各创建一次 Image，且幂等（二次调用不再请求）", () => {
    const srcs: string[] = [];
    class FakeImage {
      set src(v: string) {
        srcs.push(v);
      }
    }
    // lib 测试跑 node 环境（无 jsdom）：stub 整个 window 供 typeof window 检查 + window.Image 构造
    vi.stubGlobal("window", { Image: FakeImage });
    try {
      preloadPetSprites();
      expect(srcs).toEqual(CODEX_PETS.map((p) => buildSpriteUrl(p)));
      preloadPetSprites(); // 幂等：module flag 已置位
      expect(srcs.length).toBe(CODEX_PETS.length);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
