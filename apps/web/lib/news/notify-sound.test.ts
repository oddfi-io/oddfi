/**
 * @vitest-environment jsdom
 *
 * DD-110 §5 v3 — notify-sound 单测。
 * 覆盖：4 抑制条件 + 5s 节流 + play() reject 静默 + Audio construct 失败静默。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { playNotifySound, resetNotifySoundThrottleForTest } from "./notify-sound";
import { useAiAgentStore } from "@/stores/aiAgentStore";
import { useAiChatSessionStore } from "@/stores/aiChatSessionStore";

let audioInstances: MockAudio[] = [];
let playShouldReject = false;
let constructShouldThrow = false;

class MockAudio {
  src: string;
  volume = 1;
  constructor(src: string) {
    if (constructShouldThrow) throw new Error("decode failed");
    this.src = src;
    audioInstances.push(this);
  }
  play() {
    return playShouldReject ? Promise.reject(new Error("NotAllowedError")) : Promise.resolve();
  }
}

const originalAudio = globalThis.Audio;

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
}

function setSound(enabled: boolean, id: "ding" | "bell" | null = "ding") {
  useAiAgentStore.setState({
    config: { ...useAiAgentStore.getState().config, sound: { enabled, id } },
  });
}

function setSession(mode: "closed" | "dock" | "float", activeTab: "chat" | "news" | "analysis") {
  useAiChatSessionStore.setState({ mode, activeTab });
}

beforeEach(() => {
  audioInstances = [];
  playShouldReject = false;
  constructShouldThrow = false;
  (globalThis as unknown as { Audio: typeof Audio }).Audio = MockAudio as unknown as typeof Audio;
  resetNotifySoundThrottleForTest();
  setHidden(false);
  setSound(true, "ding");
  setSession("dock", "chat");
});

afterEach(() => {
  (globalThis as unknown as { Audio: typeof Audio }).Audio = originalAudio;
  vi.restoreAllMocks();
});

describe("playNotifySound — 抑制条件", () => {
  it("document.hidden=true → 不播", () => {
    setHidden(true);
    playNotifySound();
    expect(audioInstances.length).toBe(0);
  });

  it("浮窗 dock + activeTab=news → 不播（用户正在看）", () => {
    setSession("dock", "news");
    playNotifySound();
    expect(audioInstances.length).toBe(0);
  });

  it("浮窗 closed 即使 activeTab=news → 仍然播", () => {
    setSession("closed", "news");
    playNotifySound();
    expect(audioInstances.length).toBe(1);
  });

  it("master enabled=false → 不播", () => {
    setSound(false, "ding");
    playNotifySound();
    expect(audioInstances.length).toBe(0);
  });

  it("sound.id=null → 不播", () => {
    setSound(true, null);
    playNotifySound();
    expect(audioInstances.length).toBe(0);
  });

  it("所有条件满足 → 播一次，src + volume 正确", () => {
    playNotifySound();
    expect(audioInstances.length).toBe(1);
    expect(audioInstances[0].src).toContain("/sounds/notify-ding.mp3");
    expect(audioInstances[0].volume).toBe(0.6);
  });
});

describe("playNotifySound — 5s 节流", () => {
  it("5s 内连续调用 → 只播 1 次", () => {
    playNotifySound();
    playNotifySound();
    playNotifySound();
    expect(audioInstances.length).toBe(1);
  });

  it("跨过 5s 后可以再播", () => {
    const realDateNow = Date.now;
    let fakeNow = 10_000;
    Date.now = () => fakeNow;
    try {
      playNotifySound();
      fakeNow += 6_000;
      playNotifySound();
      expect(audioInstances.length).toBe(2);
    } finally {
      Date.now = realDateNow;
    }
  });
});

describe("playNotifySound — 错误静默", () => {
  it("play() reject → console.warn 但不抛错", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    playShouldReject = true;
    expect(() => playNotifySound()).not.toThrow();
    // 等 microtask flush，让 catch 跑完
    await new Promise((r) => setTimeout(r, 0));
    expect(warnSpy).toHaveBeenCalledWith("[news/notify-sound] play failed", expect.any(Error));
  });

  it("Audio 构造抛错 → console.warn 且不冒泡", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    constructShouldThrow = true;
    expect(() => playNotifySound()).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      "[news/notify-sound] Audio construct failed",
      expect.any(Error)
    );
  });
});
