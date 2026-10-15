import { keccak256, toHex } from "viem";
import type { Hex } from "viem";

/**
 * SportMonks fixture_id → on-chain matchId (bytes32) 编码约定。
 *
 * ⛳ 注意：本函数 **非** DD-097-FRONTEND-BFF 临时代码，长期保留。
 *    deposit/withdraw 写操作仍需前端从 fixture_id 派生 matchId 调合约。
 *
 * 与合约 operator 工具一致（.claude/skills/odd/script/config.ts · idFromText）：
 *   matchId = keccak256(utf8Bytes(String(fixture_id)))
 *
 * 三方对齐前置（详见 ADR-0004）：
 *   - 合约 operator 创池命令固定为传 fixture_id 字符串，禁止人工命名
 *   - 后端按相同规则索引 redis key（fixture_id 维度）
 *   - 前端单点函数，全仓共享
 */
export function fixtureIdToMatchId(fixtureId: number | string): Hex {
  return keccak256(toHex(String(fixtureId)));
}
