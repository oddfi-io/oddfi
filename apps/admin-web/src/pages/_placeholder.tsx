// M0 占位组件。各功能页真实内容在 M1+ 实现，本期只让路由/菜单/守卫成立。
import { Card } from "antd";

export function Placeholder({ title }: { title: string }) {
  return <Card title={title}>M1 待实现</Card>;
}
