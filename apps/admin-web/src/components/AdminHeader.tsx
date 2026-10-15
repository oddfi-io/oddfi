// 顶部 Header：审批中心铃铛（DD002 T08）+ 身份区（头像 + 姓名 + 角色 Tag + 退出）。
// Header 下方紧跟 CutoverBanner（切换期横幅，minSubscribeUsd=0.01 时显示）。
// 契约：07-ui-wireframes.md §1（Header 64px，右侧身份区），04-components.md §3（CutoverBanner）。
import { useState } from "react";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { Layout, Space, Avatar, Typography, Tag, Button, Badge, theme } from "antd";
import { BellOutlined } from "@ant-design/icons";
import type { Identity } from "@/types/admin-user";
import { ROLE_NAMES } from "@/types/admin-user";
import { CutoverBanner } from "@/components/CutoverBanner";
import { ApprovalCenterModal } from "@/components/ApprovalCenterModal";
import { useApprovalCounts, badgeValue } from "@/hooks/useApprovalCounts";

export function AdminHeader() {
  const { token } = theme.useToken();
  const { data: identity } = useGetIdentity<Identity>();
  const { mutate: logout } = useLogout();

  // ── 审批中心：badge = 服务端红灯未决策数 − 本地乐观减扣（§3.3 状态机）──
  const { counts, refetch: refetchCounts } = useApprovalCounts();
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [locallyDecided, setLocallyDecided] = useState<string[]>([]);
  const eventCount = counts?.event_count;
  // 服务端计数值变化 = 已收敛（决策落库/新红灯）→ 清空本地减扣。
  // 渲染期调整 state（react.dev「Adjusting state when a prop changes」范式，避免 effect 级联渲染）。
  // 注：真实环境 summary 有 60s 聚合缓存，缓存期内 badge 可能短暂回弹，最终一致（可接受，见 DD §3.3 时效说明）。
  const [prevCount, setPrevCount] = useState(eventCount);
  if (prevCount !== eventCount) {
    setPrevCount(eventCount);
    if (locallyDecided.length > 0) setLocallyDecided([]);
  }
  const badge = badgeValue(eventCount, locallyDecided.length);

  return (
    <>
      <Layout.Header
        style={{
          height: 64,
          paddingInline: 24,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <Space size="middle" align="center">
          <Badge count={badge} size="small">
            <Button
              type="text"
              icon={<BellOutlined />}
              aria-label="审批中心"
              onClick={() => setApprovalOpen(true)}
            />
          </Badge>
          {identity ? (
            <Space size="small" align="center">
              <Avatar size="small" src={identity.avatar || undefined}>
                {identity.name?.[0] ?? "?"}
              </Avatar>
              <Typography.Text>{identity.name}</Typography.Text>
              <Tag>{ROLE_NAMES[identity.role] ?? identity.role}</Tag>
            </Space>
          ) : null}
          <Button type="text" onClick={() => logout()}>
            退出
          </Button>
        </Space>
      </Layout.Header>
      <CutoverBanner />
      <ApprovalCenterModal
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        eventCount={badge}
        locallyDecided={locallyDecided}
        onDecided={(id) => setLocallyDecided((prev) => [...prev, id])}
        refetchCounts={refetchCounts}
      />
    </>
  );
}
