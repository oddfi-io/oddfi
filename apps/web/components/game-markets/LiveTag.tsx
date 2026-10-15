/**
 * LiveTag — 红底白「LIVE」标签。
 *
 * 原为 MatchCard 内 inline 片段，DD-126 提取为共享组件：
 * 赛事卡片（MatchCard）live 态 + 直播角标（StreamPlayer）共用，单一来源。
 * 纯展示无状态，定位（absolute 等）由调用方外层容器负责。
 */
export default function LiveTag() {
  return (
    <span className="flex items-center bg-fn-red rounded-8 h-[18px] px-[6px]">
      <span className="text-[12px] leading-[18px] font-medium text-static-white">LIVE</span>
    </span>
  );
}
