// DD-095 BracketMobileConnector — H5 bracket 连接线段
// Figma 节点：4676:135146（长版）/ DD §A 短版
// props: length "short" | "long"
// CSS border 实现，不用 SVG

interface BracketMobileConnectorProps {
  length: "short" | "long";
}

export default function BracketMobileConnector({ length }: BracketMobileConnectorProps) {
  return (
    <div
      className={[
        "border-t border-border-divider",
        length === "short" ? "w-[25px]" : "w-[40px]",
      ].join(" ")}
    />
  );
}
