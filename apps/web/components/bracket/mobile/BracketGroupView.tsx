// DD-095 BracketGroupView — H5 Group 列表视图
// Figma 节点：4702:148741
// 渲染 12 张 BracketGroupCard variant="h5-list"，纵向 stack gap-[12px]

import { MOCK_BRACKET } from "@/lib/bracket/mock-data";

import BracketGroupCard from "../BracketGroupCard";

export default function BracketGroupView() {
  const { groups } = MOCK_BRACKET;

  return (
    <div className="flex flex-col items-center gap-[12px] pb-[env(safe-area-inset-bottom)]">
      {groups.map((group) => (
        <BracketGroupCard key={group.groupKey} variant="h5-list" group={group} />
      ))}
    </div>
  );
}
