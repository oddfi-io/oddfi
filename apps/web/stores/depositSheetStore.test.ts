import { describe, it, expect, beforeEach } from "vitest";
import { useDepositSheetStore } from "./depositSheetStore";
import type { TokenMeta } from "@/lib/token-registry";

const MOCK_ASSET: TokenMeta = {
  symbol: "BNB",
  name: "BNB",
  address: "0x0000000000000000000000000000000000000000",
  decimals: 18,
  isNative: true,
  iconUrl: "/images/chains/bsc.svg",
  tier: 1,
  chainId: 56,
};

describe("depositSheetStore", () => {
  beforeEach(() => {
    // 每个测试前重置 store
    useDepositSheetStore.setState({
      isOpen: false,
      step: "method",
      selectedAsset: null,
      usdAmount: "",
      txResult: null,
    });
  });

  it("初始状态正确", () => {
    const s = useDepositSheetStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.step).toBe("method");
    expect(s.selectedAsset).toBeNull();
    expect(s.usdAmount).toBe("");
  });

  it("open() 重置到 method 步骤并打开 modal", () => {
    useDepositSheetStore.getState().open();
    const s = useDepositSheetStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.step).toBe("method");
    expect(s.selectedAsset).toBeNull();
    expect(s.usdAmount).toBe("");
  });

  it("close() 关闭并重置所有状态", () => {
    useDepositSheetStore.setState({
      isOpen: true,
      step: "amount",
      selectedAsset: MOCK_ASSET,
      usdAmount: "50",
    });
    useDepositSheetStore.getState().close();
    const s = useDepositSheetStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.step).toBe("method");
    expect(s.selectedAsset).toBeNull();
    expect(s.usdAmount).toBe("");
  });

  describe("goNext() — wallet 路径线性推进", () => {
    it("method → select", () => {
      useDepositSheetStore.setState({ step: "method" });
      useDepositSheetStore.getState().goNext();
      expect(useDepositSheetStore.getState().step).toBe("select");
    });

    it("select → amount", () => {
      useDepositSheetStore.setState({ step: "select" });
      useDepositSheetStore.getState().goNext();
      expect(useDepositSheetStore.getState().step).toBe("amount");
    });

    it("amount → confirm", () => {
      useDepositSheetStore.setState({ step: "amount" });
      useDepositSheetStore.getState().goNext();
      expect(useDepositSheetStore.getState().step).toBe("confirm");
    });

    it("confirm → result", () => {
      useDepositSheetStore.setState({ step: "confirm" });
      useDepositSheetStore.getState().goNext();
      expect(useDepositSheetStore.getState().step).toBe("result");
    });

    it("result 不再前进", () => {
      useDepositSheetStore.setState({ step: "result" });
      useDepositSheetStore.getState().goNext();
      expect(useDepositSheetStore.getState().step).toBe("result");
    });

    it("receive 不前进（transfer 路径终点，不改变步骤）", () => {
      useDepositSheetStore.setState({ step: "receive" });
      useDepositSheetStore.getState().goNext();
      // receive 不在 wallet 线性路径中，goNext 应为 no-op
      expect(useDepositSheetStore.getState().step).toBe("receive");
    });
  });

  describe("goBack() — 分叉返回映射", () => {
    it("select → method", () => {
      useDepositSheetStore.setState({ step: "select" });
      useDepositSheetStore.getState().goBack();
      expect(useDepositSheetStore.getState().step).toBe("method");
    });

    it("receive → method（transfer 路径返回）", () => {
      useDepositSheetStore.setState({ step: "receive" });
      useDepositSheetStore.getState().goBack();
      expect(useDepositSheetStore.getState().step).toBe("method");
    });

    it("amount → select", () => {
      useDepositSheetStore.setState({ step: "amount" });
      useDepositSheetStore.getState().goBack();
      expect(useDepositSheetStore.getState().step).toBe("select");
    });

    it("confirm → amount", () => {
      useDepositSheetStore.setState({ step: "confirm" });
      useDepositSheetStore.getState().goBack();
      expect(useDepositSheetStore.getState().step).toBe("amount");
    });

    it("method 不后退", () => {
      useDepositSheetStore.setState({ step: "method" });
      useDepositSheetStore.getState().goBack();
      expect(useDepositSheetStore.getState().step).toBe("method");
    });
  });

  it("setStep() 直接跳转任意步骤", () => {
    useDepositSheetStore.getState().setStep("receive");
    expect(useDepositSheetStore.getState().step).toBe("receive");

    useDepositSheetStore.getState().setStep("confirm");
    expect(useDepositSheetStore.getState().step).toBe("confirm");

    useDepositSheetStore.getState().setStep("method");
    expect(useDepositSheetStore.getState().step).toBe("method");
  });

  it("selectAsset() 保存选中资产", () => {
    useDepositSheetStore.getState().selectAsset(MOCK_ASSET);
    expect(useDepositSheetStore.getState().selectedAsset).toEqual(MOCK_ASSET);
  });

  it("setUsdAmount() 更新金额", () => {
    useDepositSheetStore.getState().setUsdAmount("42.50");
    expect(useDepositSheetStore.getState().usdAmount).toBe("42.50");
  });
});
