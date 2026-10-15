// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, render, cleanup, act } from "@testing-library/react";
import { useInViewport } from "./useInViewport";

interface ObserverCb {
  (entries: IntersectionObserverEntry[]): void;
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  cb: ObserverCb;
  observed: Element[] = [];
  disconnected = false;
  constructor(cb: ObserverCb) {
    this.cb = cb;
    MockIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {}
  fire(isIntersecting: boolean) {
    this.cb(
      this.observed.map(
        (target) =>
          ({
            target,
            isIntersecting,
            intersectionRatio: isIntersecting ? 1 : 0,
            time: Date.now(),
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
          }) as IntersectionObserverEntry
      )
    );
  }
}

let visibilityValue = false;
function TestHarness() {
  const [ref, isVisible] = useInViewport<HTMLDivElement>();
  visibilityValue = isVisible;
  return <div ref={ref} data-testid="probe" />;
}

describe("useInViewport", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    visibilityValue = false;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("defaults to false (initial state)", () => {
    const { result } = renderHook(() => useInViewport());
    expect(result.current[1]).toBe(false);
  });

  it("creates an observer and observes the attached element", () => {
    render(<TestHarness />);
    expect(MockIntersectionObserver.instances.length).toBe(1);
    expect(MockIntersectionObserver.instances[0].observed.length).toBe(1);
  });

  it("flips visible flag when observer reports intersection", () => {
    render(<TestHarness />);
    const observer = MockIntersectionObserver.instances[0];
    act(() => observer.fire(true));
    expect(visibilityValue).toBe(true);
    act(() => observer.fire(false));
    expect(visibilityValue).toBe(false);
  });

  it("does not create observer when disabled", () => {
    renderHook(() => useInViewport({ disabled: true }));
    expect(MockIntersectionObserver.instances.length).toBe(0);
  });

  it("disconnects observer on unmount", () => {
    const { unmount } = render(<TestHarness />);
    const observer = MockIntersectionObserver.instances[0];
    expect(observer.disconnected).toBe(false);
    unmount();
    expect(observer.disconnected).toBe(true);
  });
});
