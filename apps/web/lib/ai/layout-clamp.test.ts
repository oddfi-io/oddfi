import { describe, it, expect } from "vitest";
import { resolveLayout } from "./layout-clamp";
import {
  CHAT_MODAL_DEFAULT_INSET,
  CHAT_MODAL_DEFAULT_HEIGHT,
  CHAT_MODAL_DEFAULT_WIDTH,
  CHAT_MODAL_MIN_HEIGHT,
  CHAT_MODAL_MIN_WIDTH,
} from "@/stores/aiChatLayoutStore";

const VIEW = { width: 1440, height: 900 };

describe("resolveLayout", () => {
  it("defaults to bottom-right inset when position is null", () => {
    const r = resolveLayout(
      {
        position: null,
        size: { width: CHAT_MODAL_DEFAULT_WIDTH, height: CHAT_MODAL_DEFAULT_HEIGHT },
      },
      VIEW
    );
    expect(r.position.x).toBe(VIEW.width - CHAT_MODAL_DEFAULT_WIDTH - CHAT_MODAL_DEFAULT_INSET);
    expect(r.position.y).toBe(VIEW.height - CHAT_MODAL_DEFAULT_HEIGHT - CHAT_MODAL_DEFAULT_INSET);
  });

  it("clamps size up to min-width / min-height", () => {
    const r = resolveLayout({ position: { x: 0, y: 0 }, size: { width: 100, height: 100 } }, VIEW);
    expect(r.size.width).toBe(CHAT_MODAL_MIN_WIDTH);
    expect(r.size.height).toBe(CHAT_MODAL_MIN_HEIGHT);
  });

  it("clamps size down to viewport - inset cap", () => {
    const r = resolveLayout(
      { position: { x: 0, y: 0 }, size: { width: 9999, height: 9999 } },
      VIEW
    );
    expect(r.size.width).toBeLessThanOrEqual(VIEW.width - 32);
    expect(r.size.height).toBeLessThanOrEqual(VIEW.height - 32);
  });

  it("clamps overflow position back inside viewport", () => {
    const r = resolveLayout(
      { position: { x: 5000, y: 5000 }, size: { width: 400, height: 600 } },
      VIEW
    );
    expect(r.position.x).toBeLessThanOrEqual(VIEW.width - 400);
    expect(r.position.y).toBeLessThanOrEqual(VIEW.height - 600);
  });

  it("clamps negative position to 0", () => {
    const r = resolveLayout(
      { position: { x: -200, y: -300 }, size: { width: 400, height: 600 } },
      VIEW
    );
    expect(r.position.x).toBe(0);
    expect(r.position.y).toBe(0);
  });

  it("handles tiny viewports without negative max", () => {
    const r = resolveLayout(
      { position: null, size: { width: 400, height: 600 } },
      { width: 300, height: 200 }
    );
    expect(r.size.width).toBe(CHAT_MODAL_MIN_WIDTH);
    expect(r.size.height).toBe(CHAT_MODAL_MIN_HEIGHT);
    expect(r.position.x).toBeGreaterThanOrEqual(0);
    expect(r.position.y).toBeGreaterThanOrEqual(0);
  });
});
