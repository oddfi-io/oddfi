// /login — Lark 登录入口。读 sessionStorage['lark_login_error']（bootstrap 写入）展示文案。
// 契约：03-pages.md §1，02-data-layer.md §4.2，07-ui-wireframes.md §2。
import { useMemo } from "react";
import { useLogin } from "@refinedev/core";
import { Card, Button, Typography, Alert, Space, theme } from "antd";

const { Title, Paragraph, Text } = Typography;

// Lark OAuth 错误码 → 中文文案（02 §4.2）。原始码已在 bootstrap 阶段白名单过滤。
const ERROR_TEXT: Record<string, string> = {
  NOT_ADMIN: "你的 Lark 账号不在运营后台白名单，请联系超级管理员添加后重试。",
  LARK_STATE_MISMATCH: "登录会话已过期，请重新发起登录。",
  LARK_EXCHANGE_FAILED: "Lark 授权服务异常，请重试。",
  LARK_USER_INFO_FAILED: "获取 Lark 用户信息失败，请重试。",
  UNKNOWN: "登录失败，请重试。",
};

export function LoginPage() {
  const { token } = theme.useToken();
  const { mutate: login } = useLogin();

  // 一次性读取并清除错误码（避免刷新后残留）。
  const errorCode = useMemo(() => {
    const code = sessionStorage.getItem("lark_login_error");
    if (code) sessionStorage.removeItem("lark_login_error");
    return code;
  }, []);

  // NOT_ADMIN 特例：展示「未授权」态，无重试按钮。
  const isNotAdmin = errorCode === "NOT_ADMIN";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: token.colorBgLayout,
      }}
    >
      <Card style={{ width: 380 }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <Title level={4} style={{ marginBottom: 4 }}>
              OddFi 运营后台
            </Title>
            <Text type="secondary">内部工具 · 仅授权成员</Text>
          </div>

          {errorCode ? (
            <Alert
              type={isNotAdmin ? "warning" : "error"}
              showIcon
              message={isNotAdmin ? "未授权" : "登录失败"}
              description={ERROR_TEXT[errorCode] ?? ERROR_TEXT.UNKNOWN}
            />
          ) : null}

          {isNotAdmin ? (
            <Paragraph type="secondary" style={{ marginBottom: 0, textAlign: "center" }}>
              如需访问，请联系超级管理员将你的 Lark 账号加入白名单。
            </Paragraph>
          ) : (
            <Button type="primary" block onClick={() => login({})}>
              使用 Lark 登录
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
}
