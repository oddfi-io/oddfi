"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

export default function SearchInput({
  value,
  onChange,
  onClear,
  onExpandChange,
}: SearchInputProps) {
  const t = useTranslations("markets");
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value → localValue; if value is set externally, stay expanded
  useEffect(() => {
    setLocalValue(value);
    if (value) setIsExpanded(true);
  }, [value]);

  // Notify parent when expanded state changes
  useEffect(() => {
    onExpandChange?.(isExpanded);
  }, [isExpanded, onExpandChange]);

  // Auto-focus after expanding
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  // Debounced onChange
  const handleChange = useCallback(
    (v: string) => {
      setLocalValue(v);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(v), 300);
    },
    [onChange]
  );

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCancel = () => {
    setLocalValue("");
    if (timerRef.current) clearTimeout(timerRef.current);
    onClear();
    setIsExpanded(false);
  };

  // ── Collapsed: icon-only button ──────────────────────────────────────────
  if (!isExpanded) {
    return (
      <button
        type="button"
        aria-label="Search"
        onClick={() => setIsExpanded(true)}
        className="hidden lg:flex shrink-0 items-center justify-center size-10 rounded-12
          bg-fill-input border-[0.5px] border-secondary backdrop-blur-[15px]
          transition-colors hover:bg-white/[0.08]"
      >
        <MagnifyingGlassIcon size={20} className="text-secondary" />
      </button>
    );
  }

  // ── Expanded: full input bar ──────────────────────────────────────────────
  return (
    <div
      className={`hidden lg:flex items-center gap-2 w-[240px] h-10 px-3 rounded-12 bg-fill-input backdrop-blur-[15px] border-[0.5px] transition-colors ${
        isFocused ? "border-dt-hover" : "border-secondary"
      }`}
    >
      <MagnifyingGlassIcon size={20} className="text-secondary shrink-0" />

      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={t("searchPlaceholder")}
        spellCheck={false}
        className="flex-1 min-w-0 bg-transparent text-sm text-primary placeholder:text-secondary outline-none"
      />

      <button
        type="button"
        onClick={handleCancel}
        className="shrink-0 text-sm font-medium text-brand-default min-h-[44px] flex items-center"
      >
        {t("searchCancel")}
      </button>
    </div>
  );
}
