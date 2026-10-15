// @vitest-environment node
import { describe, it, expect } from "vitest";
import { bsc, bscTestnet } from "wagmi/chains";
import { CONTRACTS, getContracts, requireContract } from "./contracts";

describe("lib/contracts", () => {
  describe("CONTRACTS map", () => {
    it("包含 bsc 与 bscTestnet 两条条目", () => {
      expect(CONTRACTS[bsc.id]).toBeDefined();
      expect(CONTRACTS[bscTestnet.id]).toBeDefined();
    });

    it("bsc 条目含 USDC / USDT 真实地址", () => {
      expect(CONTRACTS[bsc.id].usdc).toBe("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d");
      expect(CONTRACTS[bsc.id].usdt).toBe("0x55d398326f99059fF775485246999027B3197955");
    });

    it("bscTestnet 条目：oddToken / stakingPool / pools 配 2026-06-01 重部署权威地址，其余仍为 ZERO 占位", () => {
      const testnet = CONTRACTS[bscTestnet.id];
      const ZERO = "0x0000000000000000000000000000000000000000";
      // 与 oddfi-ODD/docs/development/api.md + 后端 web-api/spider config 一致
      expect(testnet.oddToken).toBe("0x4655079a3b35A68443fFa90A54a4Ab89e34D04d0");
      expect(testnet.stakingPool).toBe("0x05e971c8283c1dA923b07d2812C9C1aF7aa8080A");
      expect(testnet.depositVault).toBe(ZERO);
      expect(testnet.lending).toBe(ZERO);
      expect(testnet.referral).toBe(ZERO);
      expect(testnet.pools).toBe("0x0F7a2Dc0666578e7f6456a287a50F95e40e6A3Fa"); // LiquidityPool proxy
      expect(testnet.usdc).toBe(ZERO);
      expect(testnet.usdt).toBe("0xa8A74A6b4198F4C3650C8e6Fc2d2498a9B61377c");
    });
  });

  describe("getContracts", () => {
    it("返回对应 chainId 的 ContractAddresses", () => {
      expect(getContracts(bsc.id)).toBe(CONTRACTS[bsc.id]);
    });

    it("未知 chainId → 抛错", () => {
      expect(() => getContracts(999)).toThrow(/unsupported chainId: 999/);
    });
  });

  describe("requireContract", () => {
    it("真实地址 → 返回该地址", () => {
      expect(requireContract(bsc.id, "usdc")).toBe("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d");
    });

    it("真实地址 → 返回该地址（testnet USDT 已配置）", () => {
      expect(requireContract(bscTestnet.id, "usdt")).toBe(
        "0xa8A74A6b4198F4C3650C8e6Fc2d2498a9B61377c"
      );
    });

    it("ZERO 占位 → 抛错（mainnet depositVault 未配置）", () => {
      expect(() => requireContract(bsc.id, "depositVault")).toThrow(
        /depositVault not configured for chainId=56/
      );
    });

    it("未知 chainId → 透传 getContracts 的抛错", () => {
      expect(() => requireContract(12345, "oddToken")).toThrow(/unsupported chainId: 12345/);
    });
  });
});
