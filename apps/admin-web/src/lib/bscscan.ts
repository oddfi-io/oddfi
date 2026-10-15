// BSCscan 链接生成（BSC 主网）。契约：03-pages.md §9。
const BASE = "https://bscscan.com";

export function bscscanTxUrl(txHash: string): string {
  return `${BASE}/tx/${txHash}`;
}

export function bscscanAddressUrl(address: string): string {
  return `${BASE}/address/${address}`;
}

// 链上 hash/地址截断展示：0x1a2b…ef。
export function truncateHash(value: string, head = 6, tail = 4): string {
  if (!value) return "—";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
