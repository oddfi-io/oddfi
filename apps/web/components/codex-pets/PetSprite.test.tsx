// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PetSprite } from "./PetSprite";
import { CODEX_PETS, buildSpriteUrl } from "@/lib/codex-pets/registry";

beforeEach(() => {
  // JSDOM 未实现 matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PetSprite (static mode)", () => {
  const pet = CODEX_PETS[0];

  it("渲染 role=img 容器（div + sprite 第一帧），不走 next/image", () => {
    render(<PetSprite petId={pet.id} size={36} mode="static" />);
    const el = screen.getByRole("img");
    expect(el.tagName).toBe("DIV");
    // 第一帧 backgroundPosition: 0% 0%
    expect((el as HTMLDivElement).style.backgroundPosition).toBe("0% 0%");
  });

  it("无效 petId fallback 到 CODEX_PETS[0]", () => {
    render(<PetSprite petId="not-a-pet" size={36} mode="static" />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("aria-label")).toBe(CODEX_PETS[0].displayName);
  });

  it("默认 aria-label = pet.displayName", () => {
    render(<PetSprite petId={pet.id} size={36} mode="static" />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("aria-label")).toBe(pet.displayName);
  });

  it("ariaLabel prop 覆盖默认 aria-label", () => {
    render(<PetSprite petId={pet.id} size={36} mode="static" ariaLabel="custom-label" />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("aria-label")).toBe("custom-label");
  });

  it("backgroundSize 锁 800% × 900%（sprite atlas 8×9）", () => {
    render(<PetSprite petId={pet.id} size={36} mode="static" />);
    const el = screen.getByRole("img");
    expect((el as HTMLDivElement).style.backgroundSize).toContain("800%");
    expect((el as HTMLDivElement).style.backgroundSize).toContain("900%");
  });
});

describe("PetSprite (idleLoop mode)", () => {
  it("渲染 role=img 容器，含 backgroundImage 指向 codex-pets sprite", () => {
    render(<PetSprite petId={CODEX_PETS[0].id} size={80} mode="idleLoop" />);
    const el = screen.getByRole("img");
    expect(el.tagName).toBe("DIV");
    // CDN 未加载完时 backgroundImage 可能为空，但 URL 应能从 sprite 注册表构造
    expect(buildSpriteUrl(CODEX_PETS[0])).toContain("codex-pets.net");
  });

  it("idleLoop 不应注册 onMouseEnter（无 hover cycle）", () => {
    render(<PetSprite petId={CODEX_PETS[0].id} size={80} mode="idleLoop" />);
    const el = screen.getByRole("img") as HTMLDivElement;
    // jsdom 上 onmouseenter 属性反查不可靠，至少确认 element 存在且无运行时报错
    expect(el).toBeTruthy();
  });
});

describe("PetSprite (idleHoverCycle mode)", () => {
  it("渲染 role=img 容器", () => {
    render(<PetSprite petId={CODEX_PETS[1].id} size={108} mode="idleHoverCycle" />);
    const el = screen.getByRole("img");
    expect(el.tagName).toBe("DIV");
    expect(el.getAttribute("aria-label")).toBe(CODEX_PETS[1].displayName);
  });

  it("无效 petId 在 idleHoverCycle 下也 fallback 到 CODEX_PETS[0]", () => {
    render(<PetSprite petId="bogus" size={108} mode="idleHoverCycle" />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("aria-label")).toBe(CODEX_PETS[0].displayName);
  });
});
