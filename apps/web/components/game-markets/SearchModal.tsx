"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { MagnifyingGlassIcon, XCircleIcon } from "@phosphor-icons/react";
import Modal from "@/components/ui/Modal";
import MatchCard from "./MatchCard";
import { getFixtureStatus } from "@/lib/fixture-state";
import type { SportmonksFixture } from "@/types/api";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  fixtures: SportmonksFixture[];
  locale: string;
  onSelectFixture: (fixtureId: number) => void;
}

export default function SearchModal({
  isOpen,
  onClose,
  fixtures,
  locale,
  onSelectFixture,
}: SearchModalProps) {
  const t = useTranslations("markets");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset query when modal opens, then focus input
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      // Delay focus to after modal animation
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];

    const q = query.toLowerCase();
    return fixtures
      .filter((f) => {
        const status = getFixtureStatus(f.state_id);
        return status === "live" || status === "upcoming";
      })
      .filter(
        (f) =>
          f.participants.some((p) => p.name.toLowerCase().includes(q)) ||
          f.league?.name?.toLowerCase().includes(q)
      );
  }, [fixtures, query]);

  const handleSelect = (fixtureId: number) => {
    onClose();
    onSelectFixture(fixtureId);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideHeader
      className="md:max-w-[900px] w-full max-md:max-h-[80vh] md:max-h-[80vh] md:flex md:flex-col border-[var(--line-border-primary)]"
      containerStyle={{
        background: "rgba(25, 27, 32, 0.90)",
        backdropFilter: "blur(6.5px)",
        WebkitBackdropFilter: "blur(6.5px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
      }}
    >
      {/* Search input + close button row */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 h-11 px-3 rounded-12 bg-fill-input-modal">
          <MagnifyingGlassIcon size={20} className="text-secondary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            spellCheck={false}
            className="flex-1 bg-transparent text-sm text-primary placeholder:text-secondary outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-secondary hover:text-primary transition-colors"
              aria-label="Clear"
            >
              <XCircleIcon size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Results area — scrollable within modal, min-height fits one MatchCard row */}
      <div
        className="mt-4 flex-1 overflow-y-auto"
        style={{ maxHeight: "calc(80vh - 140px)", minHeight: 130 }}
      >
        {query.trim() && filtered.length === 0 ? (
          /* No results */
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-secondary">{t("noMatches")}</span>
          </div>
        ) : filtered.length > 0 ? (
          /* Results grid: 1 result = full width, 2+ = two columns */
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns:
                filtered.length === 1 ? "1fr" : "repeat(auto-fill, minmax(min(100%, 380px), 1fr))",
            }}
          >
            {filtered.map((f) => (
              <MatchCard
                key={f.id}
                fixture={f}
                locale={locale}
                onClick={() => handleSelect(f.id)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
