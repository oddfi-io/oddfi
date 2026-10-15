// 越权兜底页（admin-users 等资源直敲 URL 时展示）。契约：01-auth-rbac.md §5。
import { Result, Button } from "antd";
import { useNavigate } from "react-router";

export function Forbidden() {
  const navigate = useNavigate();
  return (
    <Result
      status="403"
      title="403"
      subTitle="你没有权限访问此页面。"
      extra={
        <Button type="primary" onClick={() => navigate("/dashboard", { replace: true })}>
          返回总览
        </Button>
      }
    />
  );
}
