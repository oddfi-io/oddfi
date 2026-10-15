// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import StreamPlayer from "./StreamPlayer";

const EMBED = "https://embedme.top/embed/alpha/xxx/1";
const ACK_KEY = "oddfi_stream_disclaimer_ack";
const DISCLAIMER = {
  title: "第三方直播免责声明",
  body: "本直播由第三方平台提供，播放后可能弹出第三方广告或跳转窗口，属第三方行为。",
  confirm: "我已知晓，继续观看",
};

function renderPlayer(extra: Record<string, unknown> = {}) {
  return render(
    <StreamPlayer embedUrl={EMBED} liveLabel="直播中" disclaimer={DISCLAIMER} {...extra} />
  );
}

// 已确认过（当天）→ 点击播放直接挂载 iframe，跳过免责 Modal
function renderPlayedAcked(extra: Record<string, unknown> = {}) {
  window.localStorage.setItem(ACK_KEY, String(Date.now()));
  const utils = renderPlayer(extra);
  fireEvent.click(utils.getByRole("button", { name: "直播中" }));
  return utils;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("StreamPlayer — click-to-play + 免责门控", () => {
  it("默认不挂载 iframe，只渲染播放按钮（杜绝首屏/误触劫持跳转）", () => {
    const { container, getByRole } = renderPlayer();
    expect(container.querySelector("iframe")).toBeNull();
    expect(getByRole("button", { name: "直播中" })).toBeTruthy();
  });

  it("当天首次点击播放 → 先弹免责 Modal，iframe 仍不挂载（不连第三方）", () => {
    const { container, getByRole, getByText } = renderPlayer();
    fireEvent.click(getByRole("button", { name: "直播中" }));
    // 免责文案出现
    expect(getByText(DISCLAIMER.title)).toBeTruthy();
    expect(getByText(DISCLAIMER.body)).toBeTruthy();
    // 关键：Modal 期间 iframe 仍未挂载 → 不会触发聚合站广告/追踪
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("点免责确认 → 才挂载 iframe（src=embed_url）并写入 localStorage 24h 门控", () => {
    const { container, getByRole, getByText } = renderPlayer();
    fireEvent.click(getByRole("button", { name: "直播中" }));
    fireEvent.click(getByText(DISCLAIMER.confirm));
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("src")).toBe(EMBED);
    expect(window.localStorage.getItem(ACK_KEY)).toBeTruthy();
  });

  it("当天已确认 → 点击播放直接挂载 iframe，不再弹 Modal", () => {
    const { container, queryByText } = renderPlayedAcked();
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(queryByText(DISCLAIMER.title)).toBeNull();
  });

  it("LiveTag（红底白 LIVE）始终展示", () => {
    const { getByText } = renderPlayer();
    expect(getByText("LIVE")).toBeTruthy();
  });
});

describe("StreamPlayer — 播放后安全属性", () => {
  it("【安全模型】不加 sandbox（源拒 sandbox），安全靠 click-to-play + 免责门控 + CSP frame-src + 跨域 SOP", () => {
    const { container } = renderPlayedAcked();
    const iframe = container.querySelector("iframe")!;
    expect(iframe.hasAttribute("sandbox")).toBe(false);
    // 不扩权：未放开 top-navigation、未放开 autoplay（2026-06-14 实测 autoplay 无效且加载即跑广告）
    expect(iframe.getAttribute("allow") || "").not.toContain("top-navigation");
    expect(iframe.getAttribute("allow") || "").not.toContain("autoplay");
  });

  it("referrerpolicy=no-referrer + liveLabel 进 iframe title", () => {
    const { container } = renderPlayedAcked();
    const iframe = container.querySelector("iframe")!;
    expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(iframe.getAttribute("title")).toBe("直播中");
  });

  it("iframe onError → 触发 onError 回调（切源）", () => {
    const onError = vi.fn();
    const { container } = renderPlayedAcked({ onError });
    fireEvent.error(container.querySelector("iframe")!);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
