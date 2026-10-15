// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import StreamSourceTabs from "./StreamSourceTabs";
import type { FixtureStreamItem } from "@/types/streams";

const mk = (over: Partial<FixtureStreamItem>): FixtureStreamItem => ({
  provider: "streamed.pk",
  embed_url: "https://embedme.top/e/x",
  language: "English",
  hd: true,
  stream_no: 1,
  ...over,
});

describe("StreamSourceTabs", () => {
  it("少于 2 条源 → 不渲染（null）", () => {
    const { container } = render(
      <StreamSourceTabs
        streams={[mk({})]}
        activeIndex={0}
        onSelect={() => {}}
        sourceFallbackLabel="Source"
      />
    );
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });

  it("≥2 条 → 渲染语言标签 + HD 标记", () => {
    const streams = [
      mk({ language: "English", hd: true, stream_no: 1 }),
      mk({ language: "Spanish", hd: false, stream_no: 2 }),
    ];
    const { getByText, getAllByText } = render(
      <StreamSourceTabs
        streams={streams}
        activeIndex={0}
        onSelect={() => {}}
        sourceFallbackLabel="Source"
      />
    );
    expect(getByText("English")).toBeTruthy();
    expect(getByText("Spanish")).toBeTruthy();
    expect(getAllByText("HD")).toHaveLength(1); // 仅第一条 hd=true
  });

  it("language 为空 → 兜底 Source N", () => {
    const streams = [mk({ language: "", stream_no: 1 }), mk({ language: "  ", stream_no: 5 })];
    const { getByText } = render(
      <StreamSourceTabs
        streams={streams}
        activeIndex={0}
        onSelect={() => {}}
        sourceFallbackLabel="Source"
      />
    );
    expect(getByText("Source 1")).toBeTruthy();
    expect(getByText("Source 5")).toBeTruthy();
  });

  it("点击非激活 tab → onSelect(index)", () => {
    const onSelect = vi.fn();
    const streams = [
      mk({ language: "English", stream_no: 1 }),
      mk({ language: "Spanish", stream_no: 2 }),
    ];
    const { getByText } = render(
      <StreamSourceTabs
        streams={streams}
        activeIndex={0}
        onSelect={onSelect}
        sourceFallbackLabel="Source"
      />
    );
    fireEvent.click(getByText("Spanish"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("激活 tab aria-selected=true", () => {
    const streams = [
      mk({ language: "English", stream_no: 1 }),
      mk({ language: "Spanish", stream_no: 2 }),
    ];
    const { getByText } = render(
      <StreamSourceTabs
        streams={streams}
        activeIndex={1}
        onSelect={() => {}}
        sourceFallbackLabel="Source"
      />
    );
    expect(getByText("Spanish").closest("button")!.getAttribute("aria-selected")).toBe("true");
    expect(getByText("English").closest("button")!.getAttribute("aria-selected")).toBe("false");
  });
});
