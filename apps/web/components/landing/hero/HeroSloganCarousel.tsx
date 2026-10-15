"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";

const OUT_MS = 320;
const IN_MS = 380;
const CYCLE_MS = 3000;
const OUT_EASING = "cubic-bezier(0.55, 0.055, 0.675, 0.19)";
const IN_EASING = "cubic-bezier(0.175, 0.885, 0.32, 1.275)";

export default function HeroSloganCarousel() {
  const t = useTranslations("landing.hero");
  const SLOGANS = useMemo(() => t.raw("slogans") as string[], [t]);
  const wordsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const words = wordsRef.current.filter((w): w is HTMLSpanElement => w !== null);
    if (words.length < 2) return;

    const cancelAll = (el: HTMLElement) => {
      el.getAnimations().forEach((a) => {
        try {
          a.cancel();
        } catch {
          /* noop */
        }
      });
    };

    // Hard reset — clear stale animations from HMR / StrictMode re-mount.
    words.forEach((el, i) => {
      cancelAll(el);
      el.style.transform = i === 0 ? "rotateX(0deg)" : "rotateX(90deg)";
      el.style.opacity = i === 0 ? "1" : "0";
    });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let active = 0;

    // 动画结束后立刻把末态写进 inline style 再 cancel —— 这样后续 cancelAll 不会
    // 把元素反弹回 JSX 里的初始 inline，避免上一个词在下一轮被错误唤醒。
    const animate = (el: HTMLElement, keyframes: Keyframe[], opts: KeyframeAnimationOptions) => {
      const anim = el.animate(keyframes, opts);
      anim.finished
        .then(() => {
          try {
            anim.commitStyles();
            anim.cancel();
          } catch {
            /* element detached */
          }
        })
        .catch(() => {
          /* aborted */
        });
      return anim;
    };

    const tick = () => {
      const next = (active + 1) % words.length;

      // 把所有非参与本轮的词锁回隐藏态，防止前一轮残留 fill:forwards 漏出来
      words.forEach((w, i) => {
        if (i !== active && i !== next) {
          cancelAll(w);
          w.style.transform = "rotateX(90deg)";
          w.style.opacity = "0";
        }
      });

      cancelAll(words[active]);
      cancelAll(words[next]);

      animate(
        words[active],
        [
          { transform: "rotateX(0deg)", opacity: 1 },
          { transform: "rotateX(-90deg)", opacity: 0 },
        ],
        { duration: OUT_MS, easing: OUT_EASING, fill: "forwards" }
      );

      animate(
        words[next],
        [
          { transform: "rotateX(90deg)", opacity: 0 },
          { transform: "rotateX(0deg)", opacity: 1 },
        ],
        {
          duration: IN_MS,
          easing: IN_EASING,
          fill: "forwards",
          delay: OUT_MS,
        }
      );

      active = next;
    };

    const intervalId = window.setInterval(tick, CYCLE_MS);

    return () => {
      window.clearInterval(intervalId);
      words.forEach(cancelAll);
    };
  }, []);

  return (
    <div
      className="grid h-[64px] w-fit"
      style={{ perspective: "1000px" }}
      aria-label={SLOGANS.join("，")}
    >
      {SLOGANS.map((s, i) => (
        <span
          key={s}
          ref={(el) => {
            wordsRef.current[i] = el;
          }}
          aria-hidden={i !== 0}
          className="font-noto-sc text-[48px] font-bold leading-[64px] tracking-[-1.44px] text-brand-default whitespace-nowrap"
          style={{
            gridArea: "1 / 1",
            backfaceVisibility: "hidden",
            transformOrigin: "50% 50% -50px",
            willChange: "transform, opacity",
            // 初始 inline 态：非 active 词隐身，避免 useEffect 落地前那 1 帧三词叠在一起
            transform: i === 0 ? "rotateX(0deg)" : "rotateX(90deg)",
            opacity: i === 0 ? 1 : 0,
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}
