// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUserProfile, loadProfile, saveProfile } from "./useUserProfile";

const STORAGE_KEY = "oddfi_user_profile_v1";
const ADDR_A = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const ADDR_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("loadProfile / saveProfile", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadProfile returns null when storage empty", () => {
    expect(loadProfile(ADDR_A)).toBeNull();
  });

  it("loadProfile returns null when address falsy", () => {
    expect(loadProfile("")).toBeNull();
  });

  it("saveProfile then loadProfile round-trips", () => {
    saveProfile(ADDR_A, { username: "will.eth" });
    const p = loadProfile(ADDR_A);
    expect(p?.username).toBe("will.eth");
    expect(p?.updatedAt).toBeGreaterThan(0);
  });

  it("normalizes address to lowercase — case-insensitive namespace", () => {
    saveProfile(ADDR_A, { username: "will.eth" });
    expect(loadProfile(ADDR_A.toLowerCase())?.username).toBe("will.eth");
    expect(loadProfile(ADDR_A.toUpperCase())?.username).toBe("will.eth");
  });

  it("isolates profiles by address", () => {
    saveProfile(ADDR_A, { username: "alice" });
    saveProfile(ADDR_B, { username: "bob" });
    expect(loadProfile(ADDR_A)?.username).toBe("alice");
    expect(loadProfile(ADDR_B)?.username).toBe("bob");
  });

  it("merges patch into existing profile (socials preserved)", () => {
    saveProfile(ADDR_A, { username: "alice", socials: { x: { username: "@alice" } } });
    saveProfile(ADDR_A, { username: "alice2" });
    const p = loadProfile(ADDR_A);
    expect(p?.username).toBe("alice2");
    expect(p?.socials.x?.username).toBe("@alice");
  });

  it("survives malformed JSON in storage", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadProfile(ADDR_A)).toBeNull();
    // save should still succeed (overwrites bad data)
    const result = saveProfile(ADDR_A, { username: "alice" });
    expect(result?.username).toBe("alice");
    expect(loadProfile(ADDR_A)?.username).toBe("alice");
  });

  it("survives non-object JSON in storage", () => {
    localStorage.setItem(STORAGE_KEY, '"a string"');
    expect(loadProfile(ADDR_A)).toBeNull();
  });
});

describe("useUserProfile", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null profile when address is undefined", () => {
    const { result } = renderHook(() => useUserProfile(undefined));
    expect(result.current.profile).toBeNull();
    expect(result.current.isHydrated).toBe(true);
  });

  it("hydrates from localStorage on mount", () => {
    saveProfile(ADDR_A, { username: "preexisting" });
    const { result } = renderHook(() => useUserProfile(ADDR_A));
    expect(result.current.profile?.username).toBe("preexisting");
  });

  it("save() updates state and storage", () => {
    const { result } = renderHook(() => useUserProfile(ADDR_A));
    act(() => {
      result.current.save({ username: "new.name" });
    });
    expect(result.current.profile?.username).toBe("new.name");
    expect(loadProfile(ADDR_A)?.username).toBe("new.name");
  });

  it("re-hydrates when address prop changes", () => {
    saveProfile(ADDR_A, { username: "alice" });
    saveProfile(ADDR_B, { username: "bob" });
    const { result, rerender } = renderHook(({ addr }) => useUserProfile(addr), {
      initialProps: { addr: ADDR_A },
    });
    expect(result.current.profile?.username).toBe("alice");
    rerender({ addr: ADDR_B });
    expect(result.current.profile?.username).toBe("bob");
  });

  it("save() with undefined address is a no-op", () => {
    const { result } = renderHook(() => useUserProfile(undefined));
    let returned: ReturnType<typeof result.current.save> = null;
    act(() => {
      returned = result.current.save({ username: "x" });
    });
    expect(returned).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it("syncs across two hook instances on save (same window)", () => {
    const a = renderHook(() => useUserProfile(ADDR_A));
    const b = renderHook(() => useUserProfile(ADDR_A));
    expect(a.result.current.profile).toBeNull();
    expect(b.result.current.profile).toBeNull();
    act(() => {
      a.result.current.save({ username: "alice" });
    });
    expect(a.result.current.profile?.username).toBe("alice");
    expect(b.result.current.profile?.username).toBe("alice");
  });

  it("reacts to storage event from another tab", () => {
    const { result } = renderHook(() => useUserProfile(ADDR_A));
    expect(result.current.profile).toBeNull();
    act(() => {
      // Simulate another tab writing then dispatching storage event
      localStorage.setItem(
        "oddfi_user_profile_v1",
        JSON.stringify({
          [ADDR_A.toLowerCase()]: {
            username: "from-other-tab",
            socials: {},
            updatedAt: Date.now(),
          },
        })
      );
      window.dispatchEvent(new StorageEvent("storage", { key: "oddfi_user_profile_v1" }));
    });
    expect(result.current.profile?.username).toBe("from-other-tab");
  });
});
