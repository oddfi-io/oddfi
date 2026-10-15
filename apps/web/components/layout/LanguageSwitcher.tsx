"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { CheckIcon } from "@phosphor-icons/react";
import GlobeCustomIcon from "@/components/icons/GlobeCustomIcon";

const LANG_OPTIONS: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "zh", label: "\u4E2D\u6587", flag: "\u{1F1E8}\u{1F1F3}" },
  { code: "pt", label: "Portugu\u00EAs", flag: "\u{1F1F5}\u{1F1F9}" },
  { code: "ja", label: "\u65E5\u672C\u8A9E", flag: "\u{1F1EF}\u{1F1F5}" },
  { code: "hi", label: "\u0939\u093F\u0928\u094D\u0926\u0940", flag: "\u{1F1EE}\u{1F1F3}" },
  { code: "es", label: "Espa\u00F1ol", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "tr", label: "T\u00FCrk\u00E7e", flag: "\u{1F1F9}\u{1F1F7}" },
  { code: "de", label: "Deutsch", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "fr", label: "Fran\u00E7ais", flag: "\u{1F1EB}\u{1F1F7}" },
];

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const intlRouter = useRouter();
  const intlPathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startClose = useCallback(() => setIsClosing(true), []);

  const handleAnimationEnd = useCallback(() => {
    if (isClosing) {
      setIsOpen(false);
      setIsClosing(false);
    }
  }, [isClosing]);

  const handleSelect = useCallback(
    (code: Locale) => {
      startClose();
      startTransition(() => {
        intlRouter.replace(intlPathname, { locale: code });
      });
    },
    [intlRouter, intlPathname, startClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        startClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") startClose();
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, startClose]);

  return (
    <div ref={containerRef} className="relative">
      <button
        className="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-full bg-secondary cursor-pointer touch-manipulation border-0 p-0 hover:brightness-125 transition-all"
        onClick={() => {
          if (isOpen) startClose();
          else setIsOpen(true);
        }}
        disabled={isPending}
        aria-label="Switch language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <GlobeCustomIcon size={22} className="text-secondary" />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full right-0 mt-2 z-50 w-[200px] flex flex-col py-2 rounded-12 border ${
            isClosing ? "animate-dropdown-out" : "animate-dropdown-in"
          }`}
          style={{
            // @intentional-deviation: Figma=0.95, actual=0.78 — 深色背景(#04060C)下毛玻璃需 ≤0.85，blur(14px)配合更低透明度
            background: "rgba(20, 22, 28, 0.78)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
          }}
          onAnimationEnd={handleAnimationEnd}
          role="listbox"
          aria-label="Select language"
        >
          <div className="flex flex-col" style={{ padding: "0 8px", gap: 2 }}>
            {LANG_OPTIONS.map(({ code, label, flag }) => (
              <button
                key={code}
                className={`flex items-center gap-2.5 w-full min-h-[36px] px-2 text-left transition-colors border-0 bg-transparent cursor-pointer touch-manipulation rounded-8 ${
                  code === locale
                    ? "bg-white/10 text-primary font-semibold"
                    : "text-secondary hover:bg-white/[0.06] hover:text-primary"
                }`}
                style={{ fontSize: 14 }}
                onClick={() => handleSelect(code)}
                disabled={isPending}
                role="option"
                aria-selected={code === locale}
              >
                <span className="text-base leading-none">{flag}</span>
                <span className="flex-1">{label}</span>
                {code === locale && <CheckIcon size={14} weight="bold" className="text-green" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
