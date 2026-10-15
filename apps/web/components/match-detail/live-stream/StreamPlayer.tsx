"use client";

/**
 * StreamPlayer — DD-126 直播 iframe 容器（Figma 6123:94115 banner2 + 6123:94118 Live badge）。
 *
 * 安全模型（DD-126 §3.1/§3.2 + click-to-play + 免责门控）：
 * 聚合站 embed 为对抗性第三方：会借用户在 iframe 内的点击手势劫持顶层导航 / 弹窗到广告页
 * （实测 breezebrowsing.com / paychat.fuse-cloud.com / adexchangerapid.com 等）。sandbox 能禁
 * top-navigation 但该源检测到 sandbox 即拒播，故无法用 sandbox。改用 **click-to-play** 缓解：
 *   - 默认**不挂载 iframe**，只渲染 loading 骨架 + 播放按钮 → 杜绝首屏自动加载 / 误触跳转
 *     （2026-06-14 实测：一旦自动挂载 iframe，聚合站广告/追踪请求会在页面打开瞬间全部发出）
 *   - 用户主动点播放按钮才挂载 iframe 加载（点的是本站按钮，不会触发聚合站劫持）
 *   - 切源（embedUrl 变）→ 回退未播放态，重新要求点击，避免新源自动加载被劫持
 *   - 当天首次点击播放前先弹**第三方免责 Modal**（一天一次，localStorage 24h），让用户知悉
 *     广告来自第三方、非本站行为；确认后才挂载 iframe。Modal 期间 iframe 仍未挂载 → 不连第三方。
 * 其余三层不变：跨域 SOP（读不到主站 cookie/JWT）+ CSP frame-src 白名单 + referrerpolicy=no-referrer。
 *
 * 残余风险：用户主动点播放后，在 iframe 内继续点击仍可能被聚合站劫持。彻底禁止前端无解 ——
 * sandbox 能禁 top-nav，但该聚合站行为探测到 sandbox 环境即拒播（牺牲源 wrapper PoC 2026-06-04
 * 浏览器实测：sandbox 拦劫持成功但聚合站拒播，已回退，见 sandbox-wrapper-poc.md）。autoplay 直挂
 * 亦无效（2026-06-14 实测：embed.st 不吃 allow=autoplay，仍显示自己的播放按钮 + 加载即跑广告）。
 * 唯一彻底解在源头：后端换非对抗性源 / 服务端转码成干净 HLS。
 *
 * 纯展示：无 i18n 依赖，liveLabel 与 disclaimer 文案均由父级（LiveStreamSection）注入。
 */
import { useEffect, useRef, useState } from "react";
import { PlayIcon } from "@phosphor-icons/react";
import LiveTag from "@/components/game-markets/LiveTag";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

// 免责弹窗"一天一次"门控：localStorage 存确认时间戳，24h 内不再弹（全局，跨比赛共享）。
const DISCLAIMER_ACK_KEY = "oddfi_stream_disclaimer_ack";
const DISCLAIMER_ACK_TTL_MS = 24 * 60 * 60 * 1000;

function isDisclaimerAcked(): boolean {
  try {
    const ts = window.localStorage.getItem(DISCLAIMER_ACK_KEY);
    return !!ts && Date.now() - Number(ts) < DISCLAIMER_ACK_TTL_MS;
  } catch {
    // 隐私模式 / storage 被禁：保守起见视为未确认，每次都弹（外部不确定性边界）
    return false;
  }
}

function markDisclaimerAcked(): void {
  try {
    window.localStorage.setItem(DISCLAIMER_ACK_KEY, String(Date.now()));
  } catch {
    // storage 不可用：忽略写入，下次仍会弹，可接受
  }
}

interface Props {
  embedUrl: string;
  /** "Live" 文案（已本地化） */
  liveLabel: string;
  /** 第三方免责弹窗文案（已本地化，由父级注入，沿用本组件"文字父级注入"模式） */
  disclaimer: { title: string; body: string; confirm: string };
  /** iframe 加载失败回调（切下一条源） */
  onError?: () => void;
  className?: string;
}

export default function StreamPlayer({
  embedUrl,
  liveLabel,
  disclaimer,
  onError,
  className,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // click-to-play：默认 false → 不挂载 iframe（杜绝聚合站首屏/误触劫持跳转到广告页）
  const [playing, setPlaying] = useState(false);
  // 第三方免责 Modal 开关（当天首次点击播放时弹）
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // 切源（embedUrl 变）→ 回到未播放态，要求用户重新点击，避免新源自动加载被劫持
  useEffect(() => {
    setPlaying(false);
  }, [embedUrl]);

  // iframe 的 error 事件用原生 addEventListener 绑定：React 合成 onError 对 iframe 不可靠。
  // 仅 playing（iframe 已挂载）后绑定。
  useEffect(() => {
    if (!playing) return;
    const el = iframeRef.current;
    if (!el || !onError) return;
    const handler = () => onError();
    el.addEventListener("error", handler);
    return () => el.removeEventListener("error", handler);
  }, [playing, onError]);

  // 点击播放按钮：当天已确认过 → 直接挂载播放；当天首次 → 先弹免责 Modal（确认后才挂载）。
  const handlePlayClick = () => {
    if (isDisclaimerAcked()) {
      setPlaying(true);
    } else {
      setShowDisclaimer(true);
    }
  };

  // Modal 确认：记录 24h 门控 → 关闭 Modal → 挂载 iframe 播放
  const handleDisclaimerConfirm = () => {
    markDisclaimerAcked();
    setShowDisclaimer(false);
    setPlaying(true);
  };

  return (
    <div
      className={`relative h-[217px] w-full overflow-hidden rounded-12 bg-secondary ${className ?? ""}`}
    >
      {playing ? (
        <iframe
          // key=embedUrl：切源时强制重建 iframe，避免旧 src 残留
          key={embedUrl}
          ref={iframeRef}
          src={embedUrl}
          title={liveLabel}
          // 不加 sandbox：聚合站检测到即拒播；安全靠 click-to-play + 免责门控 + CSP frame-src 白名单 + 跨域 SOP（见顶部注释）
          allow="encrypted-media; fullscreen"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        // 未播放：loading 骨架 + 中央播放按钮（点击先过免责门控，确认后才挂载 iframe，期间绝不会跳转）
        <button
          type="button"
          onClick={handlePlayClick}
          aria-label={liveLabel}
          style={{ touchAction: "manipulation" }}
          className="group absolute inset-0 flex items-center justify-center"
        >
          {/* loading 骨架背景（Skeleton 优于 Spinner） */}
          <span className="absolute inset-0 animate-pulse bg-gradient-to-b from-tertiary/40 to-secondary" />
          {/* 播放按钮（品牌色圆形 CTA，热区 56px > 44px） */}
          <span className="relative flex size-[56px] items-center justify-center rounded-full bg-fn-brand transition-transform duration-200 group-hover:scale-105">
            <PlayIcon size={28} weight="fill" className="ml-[2px] text-static-black" />
          </span>
        </button>
      )}

      {/* Live 角标 — 右上角（复用赛事卡片 MatchCard 的红底白 LIVE tag） */}
      <div className="pointer-events-none absolute right-[12px] top-[12px]">
        <LiveTag />
      </div>

      {/* 第三方免责 Modal（当天首次点击播放时弹，确认后才挂载 iframe；Modal 自带 PC 居中 / H5 底部 sheet） */}
      <Modal
        isOpen={showDisclaimer}
        onClose={() => setShowDisclaimer(false)}
        title={disclaimer.title}
      >
        <div className="flex flex-col gap-[20px] pb-[8px]">
          <p className="text-[14px] leading-[22px] text-secondary">{disclaimer.body}</p>
          <Button
            type="button"
            variant="primary"
            fullWidth
            onClick={handleDisclaimerConfirm}
            style={{ touchAction: "manipulation" }}
            className="min-h-[44px]"
          >
            {disclaimer.confirm}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
