import { Refine, Authenticated, CanAccess, type TitleProps } from "@refinedev/core";
import { ThemedLayout, ThemedSider, ErrorComponent, useNotificationProvider } from "@refinedev/antd";
import routerBindings, {
  NavigateToResource,
  UnsavedChangesNotifier,
  DocumentTitleHandler,
} from "@refinedev/react-router";
import { BrowserRouter, Route, Routes, Outlet, Navigate } from "react-router";
import { ConfigProvider, App as AntdApp, theme as antdTheme } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

import "@refinedev/antd/dist/reset.css";
import { vercelTheme } from "@/theme/vercelTheme";
import "@/theme/vercel.css";

import { dataProvider } from "@/providers/dataProvider";
import { authProvider } from "@/providers/authProvider";
import { accessControlProvider } from "@/providers/accessControlProvider";
import { AdminHeader } from "@/components/AdminHeader";
import { Forbidden } from "@/components/Forbidden";
import { NoModules } from "@/components/NoModules";
import { usePermissionRole } from "@/hooks/usePermissionRole";
import { R_VIEW, RESOURCE_ROLES } from "@/lib/rbac";

import { LoginPage } from "@/pages/auth/login";
import { DashboardPage } from "@/pages/dashboard";
import { RoundsList } from "@/pages/rounds/list";
import { RoundsShow } from "@/pages/rounds/show";
import { DepositsList } from "@/pages/deposits/list";
import { DepositsShow } from "@/pages/deposits/show";
import { AnomalyList } from "@/pages/anomaly/list";
import { AnomalyShow } from "@/pages/anomaly/show";
import { ConfigPage } from "@/pages/config";
import { AuditList } from "@/pages/audit/list";
import { KolReferralList } from "@/pages/kol-referral/list";
import { AdminUsersList } from "@/pages/admin-users/list";
import { AdminUsersCreate } from "@/pages/admin-users/create";
import { EventsList } from "@/pages/events/list";

dayjs.locale("zh-cn");

// 布局品牌标题（字号走 token，符合 design-tokens.md：不硬编码字号）。
function LayoutTitle({ collapsed }: { collapsed: boolean }) {
  const { token } = antdTheme.useToken();
  return (
    <div style={{ fontWeight: 600, fontSize: token.fontSizeLG, padding: "0 12px" }}>
      {collapsed ? "OF" : "OddFi Admin"}
    </div>
  );
}

// DD003 W1a（走查 6/5）：Sider 只渲染菜单项，去掉底部默认 logout（右上角 AdminHeader
// 已有「退出」）。模块级具名常量（review M1）：内联箭头会被 ThemedLayout 当组件类型，
// 标识不稳会整树 remount——提到模块作用域一劳永逸。ThemedLayout 仅向 Sider 透传 Title。
function AppSider({ Title }: { Title?: React.FC<TitleProps> }) {
  return <ThemedSider Title={Title} render={({ items }) => <>{items}</>} />;
}

// 受保护区首页：有预售权限 → 总览；finance（DD002 起有赛事风险）→ 赛事风险；
// 角色非法 → 空态兜底，避免白屏。
function ProtectedIndex() {
  const { role, isLoading } = usePermissionRole();
  if (isLoading) return null;
  if (role && R_VIEW.includes(role)) {
    return <NavigateToResource resource="dashboard" />;
  }
  if (role && (RESOURCE_ROLES.events ?? []).includes(role)) {
    return <NavigateToResource resource="events" />;
  }
  return <NoModules />;
}

function App() {
  return (
    <ConfigProvider theme={vercelTheme} locale={zhCN}>
      <AntdApp>
        <BrowserRouter>
          <Refine
            dataProvider={dataProvider}
            authProvider={authProvider}
            accessControlProvider={accessControlProvider}
            routerProvider={routerBindings}
            notificationProvider={useNotificationProvider}
            resources={[
              // ── 一级：认购模块（无 list/show → Sider 渲染为可折叠父节点）──
              { name: "presale", meta: { label: "认购", roles: R_VIEW } },

              // ── 二级：认购下的功能页（meta.parent 指向 "presale"）──
              {
                name: "dashboard",
                list: "/dashboard",
                meta: { label: "总览", parent: "presale", roles: R_VIEW },
              },
              {
                name: "rounds",
                list: "/rounds",
                show: "/rounds/:id",
                meta: { label: "轮次管理", parent: "presale", roles: R_VIEW },
              },
              {
                name: "deposits",
                list: "/deposits",
                show: "/deposits/:txHash",
                meta: { label: "入账记录", parent: "presale", roles: R_VIEW },
              },
              {
                name: "anomaly",
                list: "/anomaly",
                show: "/anomaly/:id",
                meta: { label: "异常事件", parent: "presale", roles: R_VIEW },
              },
              {
                name: "config",
                list: "/config",
                meta: { label: "金库及TGE配置", parent: "presale", roles: R_VIEW },
              },
              {
                name: "audit",
                list: "/audit",
                meta: { label: "操作审计", parent: "presale", roles: R_VIEW },
              },
              {
                name: "kol-referral",
                list: "/kol-referral",
                meta: { label: "特殊返佣", parent: "presale", roles: R_VIEW },
              },

              // ── 赛事风险（DD002 信号灯，独立一级菜单，四角色全读）──
              {
                name: "events",
                list: "/events",
                meta: { label: "赛事风险", roles: RESOURCE_ROLES.events },
              },

              // ── 平台级（跨模块治理，不属于"认购"，保持顶层）──
              {
                name: "admin-users",
                list: "/admin-users",
                create: "/admin-users/create",
                meta: { label: "管理员管理", roles: RESOURCE_ROLES["admin-users"] },
              },
            ]}
            options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <Authenticated key="protected" fallback={<Navigate to="/login" replace />}>
                    <ThemedLayout Header={AdminHeader} Title={LayoutTitle} Sider={AppSider}>
                      <Outlet />
                    </ThemedLayout>
                  </Authenticated>
                }
              >
                <Route index element={<ProtectedIndex />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="rounds">
                  <Route index element={<RoundsList />} />
                  <Route path=":id" element={<RoundsShow />} />
                </Route>
                <Route path="deposits">
                  <Route index element={<DepositsList />} />
                  <Route path=":txHash" element={<DepositsShow />} />
                </Route>
                <Route path="anomaly">
                  <Route index element={<AnomalyList />} />
                  <Route path=":id" element={<AnomalyShow />} />
                </Route>
                <Route path="config" element={<ConfigPage />} />
                <Route path="audit" element={<AuditList />} />
                <Route path="kol-referral" element={<KolReferralList />} />
                {/* events 现为四角色全读，CanAccess 是对称性加固：将来收紧矩阵不会静默漏守卫 */}
                <Route
                  path="events"
                  element={
                    <CanAccess resource="events" action="list" fallback={<Forbidden />}>
                      <EventsList />
                    </CanAccess>
                  }
                />
                <Route path="admin-users">
                  {/* 资源级 accessControlProvider 已挡非 super_admin；越权直敲 URL 时这里再兜底 */}
                  <Route
                    index
                    element={
                      <CanAccess
                        resource="admin-users"
                        action="list"
                        fallback={<Forbidden />}
                      >
                        <AdminUsersList />
                      </CanAccess>
                    }
                  />
                  <Route
                    path="create"
                    element={
                      <CanAccess
                        resource="admin-users"
                        action="create"
                        fallback={<Forbidden />}
                      >
                        <AdminUsersCreate />
                      </CanAccess>
                    }
                  />
                </Route>
                <Route path="*" element={<ErrorComponent />} />
              </Route>
            </Routes>
            <UnsavedChangesNotifier />
            <DocumentTitleHandler />
          </Refine>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
