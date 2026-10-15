"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";

interface SlippageModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: number;
  onChange: (v: number) => void;
}

const PRESETS = [0.1, 0.5, 1.0];

export default function SlippageModal({ isOpen, onClose, value, onChange }: SlippageModalProps) {
  const t = useTranslations("swap");
  const [customInput, setCustomInput] = useState("");

  const isPresetActive = (p: number) => value === p && !customInput;

  const handlePreset = (v: number) => {
    onChange(v);
    setCustomInput("");
  };

  const handleCustom = (s: string) => {
    setCustomInput(s);
    const n = Number(s);
    if (!isNaN(n) && n > 0 && n <= 50) {
      onChange(n);
    }
  };

  const handleClose = () => {
    setCustomInput("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("slippageSettings")}>
      <div className="pb-4 space-y-4">
        <p className="text-secondary text-sm">{t("slippageDescription")}</p>

        {/* Preset buttons */}
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className="flex-1 py-2.5 rounded-12 text-sm font-medium transition-all min-h-[44px]"
              style={{
                background: isPresetActive(p) ? "rgba(16,98,255,0.25)" : "rgba(255,255,255,0.06)",
                border: isPresetActive(p)
                  ? "1px solid rgba(16,98,255,0.7)"
                  : "1px solid rgba(255,255,255,0.12)",
                color: isPresetActive(p) ? "#60a5fa" : "#9ca3af",
              }}
            >
              {p}%
            </button>
          ))}
        </div>

        {/* Custom input */}
        {/* TODO: DD-050 Batch 2 — needs Figma confirmation */}
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-12"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: customInput
              ? "1px solid rgba(16,98,255,0.5)"
              : "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <input
            type="number"
            placeholder={t("custom")}
            value={customInput}
            onChange={(e) => handleCustom(e.target.value)}
            className="flex-1 bg-transparent text-primary text-sm outline-none"
            min="0.01"
            max="50"
            step="0.1"
          />
          <span className="text-secondary text-sm">%</span>
        </div>

        {/* Warning */}
        {value > 5 && (
          <p className="text-xs" style={{ color: "#ff2b3a" }}>
            ⚠️ {t("highSlippageWarning")}
          </p>
        )}

        {/* Current value display */}
        <div className="flex justify-between text-sm">
          <span className="text-secondary">{t("currentSlippage")}</span>
          <span className="text-primary font-medium">{value}%</span>
        </div>

        <button
          onClick={handleClose}
          className="w-full py-3 rounded-12 text-sm font-semibold transition-all min-h-[44px]"
          // TODO: DD-050 Batch 2 — needs Figma confirmation
          style={{ background: "#f9fafb", color: "#020617" }}
        >
          {t("confirm")}
        </button>
      </div>
    </Modal>
  );
}
