import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadYamlFile } from "./yaml-loader.js";
import { oddAgentConfigSchema } from "./odd-agent-config.js";

describe("oddAgentConfigSchema", () => {
  it("loads the example config with shared centrifugo/tweet catcher and user-tag llm", async () => {
    const config = await loadYamlFile(
      join(process.cwd(), "config", "odd-agent.example.yaml"),
      oddAgentConfigSchema
    );

    expect(config.centrifugo.endpoint).toBe("http://127.0.0.1:18000/api/publish");
    expect(config.tweetCatcher.websocketEndpoint).toBe(
      "wss://monitor-api.tweet-catcher.com/websocket"
    );
    expect(config.userTag.llm.model).toBe("MiniMax-M2.7");
    expect(config.chatllm.model).toBe("MiniMax-M2.7");
    expect(config.tools.maxToolCalls).toBe(100);
    expect(config.tools.braveSearch.enabled).toBe(true);
    expect(config.tools.braveSearch.apiKeySecretRef).toBe("ODD_AGENT_BRAVE_SEARCH_API_KEY");
    expect(config.tools.braveSearch.command).toBe("node");
    expect(config.memory.llm.model).toBe("MiniMax-M2.7");
    expect(config.memory.embeddingDb.provider).toBe("pinecone");
    expect(config.memory.embeddingDb.namespace).toBe("oddfi");
    expect(config.memory.embeddingLlm.model).toBe("text-embedding-v4");
    expect(config.memory.embeddingLlm.dimensions).toBe(512);
    expect(config.memory.memoryTopK).toBe(5);
    expect(config.userTag).not.toHaveProperty("push");
    expect(config.userTag).not.toHaveProperty("tweetCatcher");
    expect(config).not.toHaveProperty("foundation");
    expect(config).not.toHaveProperty("memoryComponent");
    expect(config).not.toHaveProperty("chatAgent");
  });
});
