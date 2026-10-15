import { describe, expect, it } from "vitest";
import { buildUserChannel, normalizeTagName } from "./centrifugo-publisher.js";

describe("normalizeTagName", () => {
  it("keeps tag channel names safe and readable", () => {
    expect(normalizeTagName("Ronaldo")).toBe("Ronaldo");
    expect(normalizeTagName("Son Heung-min")).toBe("Son_Heung-min");
    expect(normalizeTagName("Côte d'Ivoire")).toBe("C_te_d_Ivoire");
  });
});

describe("buildUserChannel", () => {
  it("builds the personal channel matching the main backend token grant", () => {
    // 默认模板 user#{user_id}：必须与主后端连接 token 授权频道逐字一致。
    expect(buildUserChannel("user#{user_id}", "42")).toBe("user#42");
    // 十进制 user_id 字符串原样替换，无前导零处理。
    expect(buildUserChannel("user#{user_id}", "1000000000000000001")).toBe(
      "user#1000000000000000001"
    );
    // 模板可被配置覆盖，仍按占位符替换。
    expect(buildUserChannel("news:{user_id}", "7")).toBe("news:7");
  });
});
