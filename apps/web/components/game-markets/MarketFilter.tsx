"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/Select";
import type { OddsFilter } from "@/types/betting";

interface MarketFilterProps {
  value: OddsFilter;
  onChange: (value: OddsFilter) => void;
}

const FILTER_KEYS: {
  value: OddsFilter;
  labelKey: "filterWinner" | "filterHandicap" | "filterTotal";
}[] = [
  { value: "winner", labelKey: "filterWinner" },
  { value: "handicap", labelKey: "filterHandicap" },
  { value: "total", labelKey: "filterTotal" },
];

export default memo(function MarketFilter({ value, onChange }: MarketFilterProps) {
  const t = useTranslations("markets");
  return (
    <Select value={value} onValueChange={(v) => onChange(v as OddsFilter)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FILTER_KEYS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {t(opt.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
