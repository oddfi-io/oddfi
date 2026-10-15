// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import LiveStreamSection from "./LiveStreamSection";
import type { FixtureStreamItem, StreamStatus } from "@/types/streams";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/useFixtureStreams", () => ({
  useFixtureStreams: vi.fn(),
}));
import { useFixtureStreams } from "@/hooks/useFixtureStreams";

const mk = (over: Partial<FixtureStreamItem>): FixtureStreamItem => ({
  provider: "streamed.pk",
  embed_url: "https://embedme.top/embed/a/1",
  language: "English",
  hd: true,
  stream_no: 1,
  ...over,
});

function setHook(over: {
  status?: StreamStatus | null;
  streams?: FixtureStreamItem[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  vi.mocked(useFixtureStreams).mockReturnValue({
    status: over.status ?? null,
    streams: over.streams ?? [],
    isLoading: over.isLoading ?? false,
    isError: over.isError ?? false,
    refetch: () => {},
  });
}

// click-to-play：StreamPlayer 默认只渲染播放按钮（aria-label=liveLabel="liveStream.live"），
// 点击后才挂载 iframe。各需要 iframe 的断言前先调用。
const clickPlay = (container: HTMLElement) =>
  fireEvent.click(container.querySelector('button[aria-label="liveStream.live"]')!);

describe("LiveStreamSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 免责门控置为"当天已确认"，让 clickPlay 直接挂载 iframe（免责弹窗本身在 StreamPlayer.test 覆盖）
    window.localStorage.setItem("oddfi_stream_disclaimer_ack", String(Date.now()));
  });

  it("unavailable → 不渲染（返回 null）", () => {
    setHook({ status: "unavailable" });
    const { container } = render(<LiveStreamSection fixtureId={1} />);
    expect(container.innerHTML).toBe("");
  });

  it("isError → 不渲染", () => {
    setHook({ status: "available", streams: [mk({})], isError: true });
    const { container } = render(<LiveStreamSection fixtureId={1} />);
    expect(container.innerHTML).toBe("");
  });

  it("首屏 loading → 不渲染（不闪占位）", () => {
    setHook({ isLoading: true });
    const { container } = render(<LiveStreamSection fixtureId={1} />);
    expect(container.innerHTML).toBe("");
  });

  it("available + 单源 → click-to-play：默认播放按钮无 iframe，点击后挂载 iframe，无多源 tab", () => {
    setHook({ status: "available", streams: [mk({})] });
    const { container, getByText } = render(<LiveStreamSection fixtureId={1} />);
    expect(getByText("liveStream.title")).toBeTruthy();
    // 默认不挂载 iframe（杜绝首屏/误触劫持跳转），只有播放按钮
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector('button[aria-label="liveStream.live"]')).not.toBeNull();
    // 点播放 → 挂载 iframe
    clickPlay(container);
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });

  it("available + 多源 → 渲染 source tabs（tab 不依赖播放态，常显）", () => {
    setHook({
      status: "available",
      streams: [
        mk({ language: "English", stream_no: 1 }),
        mk({
          language: "Spanish",
          hd: false,
          stream_no: 2,
          embed_url: "https://embedme.top/embed/b/2",
        }),
      ],
    });
    const { container } = render(<LiveStreamSection fixtureId={1} />);
    expect(container.querySelector('[role="tablist"]')).not.toBeNull();
  });

  it("pending → 默认折叠：标题可见，占位文案不渲染", () => {
    setHook({ status: "pending", streams: [] });
    const { container, getByText, queryByText } = render(<LiveStreamSection fixtureId={1} />);
    expect(getByText("liveStream.title")).toBeTruthy();
    expect(queryByText("liveStream.startingSoon")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("pending + 手动展开 → 渲染占位文案，无 iframe", () => {
    setHook({ status: "pending", streams: [] });
    const { container, getByText, getByLabelText } = render(<LiveStreamSection fixtureId={1} />);
    fireEvent.click(getByLabelText("liveStream.title"));
    expect(getByText("liveStream.startingSoon")).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("pending 轮询切到 available → 自动展开播放区", () => {
    setHook({ status: "pending", streams: [] });
    const { container, rerender, queryByText } = render(<LiveStreamSection fixtureId={1} />);
    expect(queryByText("liveStream.startingSoon")).toBeNull();
    setHook({ status: "available", streams: [mk({})] });
    rerender(<LiveStreamSection fixtureId={1} />);
    expect(container.querySelector('button[aria-label="liveStream.live"]')).not.toBeNull();
  });

  it("用户手动折叠后 pending 切 available → 保持折叠（手动操作优先）", () => {
    setHook({ status: "pending", streams: [] });
    const { container, getByLabelText, rerender } = render(<LiveStreamSection fixtureId={1} />);
    // 手动展开再折叠 → 用户意图 = 折叠
    fireEvent.click(getByLabelText("liveStream.title"));
    fireEvent.click(getByLabelText("liveStream.title"));
    setHook({ status: "available", streams: [mk({})] });
    rerender(<LiveStreamSection fixtureId={1} />);
    expect(container.querySelector('button[aria-label="liveStream.live"]')).toBeNull();
  });

  it("available + 单源 + 点播放后 iframe 加载失败 → 整块不渲染", () => {
    setHook({ status: "available", streams: [mk({})] });
    const { container } = render(<LiveStreamSection fixtureId={1} />);
    clickPlay(container);
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    // 唯一源失败 → exhausted → 不渲染
    fireEvent.error(iframe!);
    expect(container.innerHTML).toBe("");
  });

  it("available + 多源 + 首条点播放失败 → 切到下一条（click-to-play：需重新点播放）", () => {
    setHook({
      status: "available",
      streams: [
        mk({ embed_url: "https://embedme.top/embed/a/1", stream_no: 1 }),
        mk({ embed_url: "https://embedme.top/embed/b/2", stream_no: 2 }),
      ],
    });
    const { container } = render(<LiveStreamSection fixtureId={1} />);
    // 点播第一条
    clickPlay(container);
    expect(container.querySelector("iframe")!.getAttribute("src")).toBe(
      "https://embedme.top/embed/a/1"
    );
    // 第一条失败 → 切到第二条源 → StreamPlayer 回未播放态（切源不自动加载，防劫持）
    fireEvent.error(container.querySelector("iframe")!);
    expect(container.querySelector("iframe")).toBeNull();
    // 重新点播放 → 加载第二条源
    clickPlay(container);
    expect(container.querySelector("iframe")!.getAttribute("src")).toBe(
      "https://embedme.top/embed/b/2"
    );
  });

  it("折叠按钮收起 → 隐藏播放区（播放按钮 / iframe 消失），保留标题", () => {
    setHook({ status: "available", streams: [mk({})] });
    const { container, getByText, getByLabelText } = render(<LiveStreamSection fixtureId={1} />);
    clickPlay(container);
    expect(container.querySelector("iframe")).not.toBeNull();
    fireEvent.click(getByLabelText("liveStream.title"));
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector('button[aria-label="liveStream.live"]')).toBeNull();
    expect(getByText("liveStream.title")).toBeTruthy();
  });
});
