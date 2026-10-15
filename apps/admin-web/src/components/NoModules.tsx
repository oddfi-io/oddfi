// 无可用模块空态（finance 本期无任何预售权限时落地，避免白屏）。
// 契约：01-auth-rbac.md §3，07-ui-wireframes.md §1。
import { Result } from "antd";

export function NoModules() {
  return (
    <Result
      status="info"
      title="本期无可用模块"
      subTitle="你的角色当前没有可访问的功能模块，请联系管理员。"
    />
  );
}
