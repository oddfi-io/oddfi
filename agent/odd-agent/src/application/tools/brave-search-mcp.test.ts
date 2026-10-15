import { afterEach, describe, expect, it, vi } from "vitest";
import { BraveSearchMcpTool, formatRegisteredToolsPrompt } from "./brave-search-mcp.js";

describe("BraveSearchMcpTool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("renders registered tools prompt with call limit", () => {
    const prompt = formatRegisteredToolsPrompt(
      [
        {
          name: "web_search",
          description: "Search web.",
          definition: { type: "function", function: { name: "web_search" } },
          call: () => Promise.resolve({})
        }
      ],
      100
    );

    expect(prompt).toContain("<registered_tools>");
    expect(prompt).toContain('"max_tool_calls": 100');
    expect(prompt).toContain('"web_search"');
  });

  it("describes web_search as a general internet search tool", () => {
    const tool = new BraveSearchMcpTool(buildConfig(), buildSecretProvider());

    expect(tool.description).toContain("Search the internet");
    expect(tool.description).not.toMatch(/sports|event|market|trading/i);
    expect(JSON.stringify(tool.definition)).not.toMatch(/sport|league|team|market|trading/i);
  });

  it("normalizes Brave MCP text results", async () => {
    const client = {
      connect: vi.fn(),
      close: vi.fn(),
      listTools: vi.fn(() =>
        Promise.resolve({ tools: [{ name: "brave_web_search", inputSchema: { type: "object" } }] })
      ),
      callTool: vi.fn(() =>
        Promise.resolve({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                title: "NBA Schedule",
                url: "https://www.nba.com/schedule",
                description: "Official NBA schedule"
              })
            },
            { type: "text", text: "not json" }
          ],
          isError: false
        })
      )
    };
    vi.doMock("@modelcontextprotocol/sdk/client/index.js", () => ({
      Client: vi.fn(function ClientMock() {
        return client;
      })
    }));
    vi.doMock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
      getDefaultEnvironment: vi.fn(() => ({ PATH: "/usr/bin" })),
      StdioClientTransport: vi.fn(function StdioClientTransportMock() {
        return {};
      })
    }));
    vi.resetModules();
    const { BraveSearchMcpTool: MockedTool } = await import("./brave-search-mcp.js");
    const tool = new MockedTool(buildConfig(), buildSecretProvider());

    const result = await tool.call({ query: "NBA games today", count: 5 });

    expect(client.callTool).toHaveBeenCalledWith(
      {
        name: "brave_web_search",
        arguments: {
          query: "NBA games today",
          country: "US",
          search_lang: "en",
          ui_lang: "en-US",
          count: 5,
          safesearch: "moderate"
        }
      },
      undefined,
      { timeout: 1000 }
    );
    expect(result).toEqual({
      query: "NBA games today",
      results: [
        {
          title: "NBA Schedule",
          url: "https://www.nba.com/schedule",
          content: "Official NBA schedule"
        }
      ]
    });
  });
});

const buildConfig = () => ({
  enabled: true,
  apiKeySecretRef: "ODD_AGENT_BRAVE_SEARCH_API_KEY",
  command: "node",
  args: ["node_modules/@brave/brave-search-mcp-server/dist/index.js"],
  timeoutMs: 1000,
  maxResults: 5,
  country: "US",
  searchLang: "en",
  uiLang: "en-US",
  safesearch: "moderate" as const
});

const buildSecretProvider = () => ({
  getSecret: vi.fn(() => Promise.resolve("test_key"))
});
