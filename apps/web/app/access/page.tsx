"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AccessPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError("Please enter your invite code");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        // WAAPI 淡出 200ms 后跳转（animation.md 规范）
        const el = wrapperRef.current;
        if (el) {
          el.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 200,
            easing: "ease-in",
            fill: "forwards",
          }).onfinish = () => {
            router.push("/");
            router.refresh();
          };
        } else {
          router.push("/");
          router.refresh();
        }
      } else {
        const data = await res.json();
        setError(data.error || "Invalid invite code");
      }
    } catch {
      setError("Network error, please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary px-4">
      {/* 入场动画 CSS keyframe（无状态生命周期，符合 animation.md 例外规则） */}
      <style>{`
        @keyframes access-enter {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        ref={wrapperRef}
        className="w-full max-w-[340px] md:max-w-[380px]"
        style={{ animation: "access-enter 400ms ease-out both" }}
      >
        {/* Logo 区 */}
        <div className="flex flex-col items-center mb-10">
          <svg
            width="40"
            height="30"
            viewBox="0 0 222 167"
            xmlns="http://www.w3.org/2000/svg"
            className="text-fn-brand mb-3"
            aria-hidden="true"
          >
            <path
              d="M90.3306 0.193532C111.512 -1.04725 131.585 3.64665 149.622 15.1857C154.367 18.009 158.862 23.2867 164.342 24.4186C170.483 25.6868 173.13 20.542 176.927 17.0631C182.187 12.2446 187.571 5.43659 193.314 1.26328C209.582 16.539 220.307 41.1528 221.777 63.3155C223.54 89.254 214.788 114.812 197.495 134.249C181.79 152.144 156.994 165.188 133.092 166.75C109.586 168.203 89.1732 163.396 69.5197 150.271C64.1989 146.718 57.8262 139.203 51.2389 143.848C43.1198 149.573 36.5994 159.453 28.6555 165.297L28.3204 165.539C24.4841 162.552 21.4387 158.507 18.5667 154.635C7.73301 140.029 2.08671 123.884 0.418969 105.859C-1.89256 80.8735 5.4129 56.1383 21.0421 36.4072C38.7199 14.177 62.3015 2.97752 90.3306 0.193532ZM57.6019 133.971C63.7797 132.213 76.2222 116.858 82.5427 111.713C86.719 114.139 89.8771 117.241 94.1425 119.804C107.791 128.084 124.234 130.44 139.664 126.327C153.906 122.581 167.626 111.909 174.976 99.2603C182.792 85.8963 184.913 69.9618 180.865 55.0235C179.267 49.031 175.307 37.8008 169.674 34.4016C168.269 33.5536 166.503 33.3818 164.893 33.3618C155.736 34.7886 146.961 50.0525 139.371 54.4879C138.338 55.0917 125.932 46.2202 122.39 44.5131C97.0606 32.3767 66.6635 39.9988 50.084 62.6435C40.8733 75.3823 37.0868 91.2425 39.5525 106.76C40.805 114.578 44.7653 127.273 51.3133 132.359C53.1845 133.813 55.3061 133.92 57.6019 133.971Z"
              fill="currentColor"
            />
          </svg>
          <span className="font-orbitron font-bold text-primary text-[36px] md:text-[48px] leading-none tracking-[0.08em] mb-2">
            oddfi
          </span>
          <p className="text-secondary text-xs tracking-[0.12em] uppercase">Invite-only Beta</p>
        </div>

        {/* 装饰 1：分割线 */}
        <div className="w-full border-t border-divider my-8" />

        {/* Form 区（无卡片，直接置于黑底） */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label
              htmlFor="code"
              className="block text-[10px] text-tertiary tracking-[0.15em] uppercase mb-2"
            >
              INVITE CODE
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError("");
              }}
              placeholder="XXXXXXXX"
              autoComplete="off"
              className={[
                "w-full h-[48px] min-h-[44px] bg-fill-input border rounded-8 px-4",
                "font-mono text-sm text-primary placeholder:text-tertiary placeholder:font-mono",
                "tracking-[0.06em] transition-colors duration-150 outline-none",
                "focus:border-dt-hover",
                error ? "border-dt-error" : "border-divider",
              ].join(" ")}
            />
            {error && <p className="text-fn-red text-xs font-mono mt-1.5">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full h-[48px] min-h-[44px] flex items-center justify-center rounded-8 md:rounded-12 bg-btn-primary text-static-black text-sm font-semibold tracking-[0.04em] hover:brightness-110 active:brightness-95 active:scale-[0.99] transition-all duration-150 cursor-pointer border-0"
            style={{ touchAction: "manipulation" }}
          >
            {loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              "进入系统"
            )}
          </button>
        </form>

        {/* 装饰 2：底部视觉收尾 */}
        <div className="text-center text-tertiary text-xs tracking-[0.5em] mt-8 select-none">
          · · ·
        </div>
      </div>
    </div>
  );
}
