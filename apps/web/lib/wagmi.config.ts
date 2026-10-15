import { createConfig, http } from "wagmi";
import { ALL_CHAINS, ALL_CHAIN_RPC } from "./chains";
import { walletConnectors } from "./connectors";
import { IS_TESTNET } from "./network-mode";

// 清除残留 BSC Testnet (chainId=97) wagmi 连接缓存。
// 未清除时，wagmi connect() 比对缓存 chainId=97 与实际 connector=56 → ConnectorChainMismatchError。
// 必须在模块初始化时（WagmiProvider 挂载前）执行，否则 wagmi 已读取脏状态。
if (typeof window !== "undefined" && !IS_TESTNET) {
  try {
    const raw = localStorage.getItem("wagmi.store");
    if (raw && raw.includes('"chainId":97')) {
      localStorage.removeItem("wagmi.store");
    }
  } catch {
    // private browsing / storage unavailable
  }
}

// 动态构建 transports map，ALL_CHAINS 扩展时自动覆盖
// ALL_CHAIN_RPC[chainId] 为 undefined 时 fallback 到链默认公共 RPC
const transports = Object.fromEntries(
  ALL_CHAINS.map((chain) => [chain.id, http(ALL_CHAIN_RPC[chain.id])])
);

export const wagmiConfig = createConfig({
  chains: ALL_CHAINS,
  connectors: walletConnectors,
  transports,
});

// BUG-013 P0.5：dev 模式打印 EIP-6963 探测到的 provider rdns 列表，方便未来排查
// 多扩展 provider contention 类 bug 时第一时间识别污染源。
// 仅 dev 生效；Next.js DefinePlugin 静态折叠后，prod bundle 不含此块。
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  void import("mipd").then(({ createStore }) => {
    const store = createStore();
    const announced = new Set<string>();
    const unsub = store.subscribe(
      (providers) => {
        for (const p of providers) {
          if (!announced.has(p.info.rdns)) {
            announced.add(p.info.rdns);
            console.log(`[wagmi] EIP-6963 detected: ${p.info.rdns} (${p.info.name})`);
          }
        }
      },
      { emitImmediately: true }
    );
    setTimeout(() => {
      unsub();
      store.destroy();
    }, 3000);
  });
}

export { CORE_CHAIN, SUPPORTED_CHAINS } from "./chains";
