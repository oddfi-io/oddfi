// 链上 hash/地址 → BSCscan 链接（新标签）+ 截断显示 + 复制。
// 契约：04-components.md §5，03-pages.md §9。
import { Space, Typography } from "antd";
import { bscscanAddressUrl, bscscanTxUrl, truncateHash } from "@/lib/bscscan";

interface Props {
  value: string | null | undefined;
  // tx → /tx/<hash>；address → /address/<addr>。
  kind: "tx" | "address";
  // 是否提供复制按钮（config.larkWebhookUrl 等敏感字段传 false）。
  copyable?: boolean;
  // 是否截断显示（默认 true）。EOA 全量展示等场景传 false 显示完整 42 位地址。
  truncate?: boolean;
}

export function TxHashLink({ value, kind, copyable = true, truncate = true }: Props) {
  if (!value) return <Typography.Text type="secondary">—</Typography.Text>;
  const url = kind === "tx" ? bscscanTxUrl(value) : bscscanAddressUrl(value);
  return (
    <Space size={4}>
      <Typography.Link href={url} target="_blank" rel="noopener noreferrer" code>
        {truncate ? truncateHash(value) : value}
      </Typography.Link>
      {copyable && (
        <Typography.Text copyable={{ text: value }} style={{ marginInlineStart: 0 }} />
      )}
    </Space>
  );
}
