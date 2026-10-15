// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRelayTokenList } from "./useRelayTokenList";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "TestWrapper";
  return Wrapper;
}

// Realistic Arbitrum token fixtures
const MOCK_RESPONSE = [
  [
    {
      chainId: 42161,
      address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      metadata: { logoURI: "https://example.com/usdt.png", verified: true, isNative: false },
    },
    {
      chainId: 42161,
      address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      metadata: { logoURI: "https://example.com/usdc.png", verified: true, isNative: false },
    },
    {
      chainId: 42161,
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      metadata: { logoURI: "https://example.com/eth.png", verified: true, isNative: true },
    },
  ],
];

describe("useRelayTokenList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is disabled when chainId is undefined (no fetch call made)", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { result } = renderHook(() => useRelayTokenList(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.status).toBe("pending");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("fetches and maps token list correctly for a given chainId", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => MOCK_RESPONSE })
    );

    const { result } = renderHook(() => useRelayTokenList(42161), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const tokens = result.current.data!;
    expect(tokens).toHaveLength(3);
    expect(tokens[0].symbol).toBe("USDT");
    expect(tokens[0].decimals).toBe(6);
    expect(tokens[0].address).toBe("0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9");
    expect(tokens[2].isNative).toBe(true);
  });

  it("filters out entries whose chainId does not match the requested chainId", async () => {
    const mixedResponse = [
      [
        {
          chainId: 42161,
          address: "0xaaa",
          symbol: "USDT",
          name: "USDT",
          decimals: 6,
          metadata: {},
        },
        {
          chainId: 1, // ETH mainnet — should be excluded when requesting Arbitrum
          address: "0xbbb",
          symbol: "USDT",
          name: "USDT",
          decimals: 6,
          metadata: {},
        },
      ],
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => mixedResponse })
    );

    const { result } = renderHook(() => useRelayTokenList(42161), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!).toHaveLength(1);
    expect(result.current.data![0].symbol).toBe("USDT");
  });

  it("sets isError when the API returns a non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) })
    );

    const { result } = renderHook(() => useRelayTokenList(42161), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/status 502/);
  });

  it("sends POST to /api/relay/currencies/v1 with correct request body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        [
          {
            chainId: 42161,
            address: "0xabc",
            symbol: "USDT",
            name: "USDT",
            decimals: 6,
            metadata: {},
          },
        ],
      ],
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useRelayTokenList(42161), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetch).toHaveBeenCalledWith("/api/relay/currencies/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chainIds: [42161], defaultList: true, verified: true }),
    });
  });
});
