/**
 * Shared tag color classes for bet display components.
 * Extracted from 8+ Portfolio/BetSlip components — DD-059 §4.7.
 */
export function tagClasses(type: "market" | "selection" | "odds"): string {
  switch (type) {
    case "market":
      return "bg-white/[0.08] text-primary";
    case "selection":
      // @figma-hardcoded: rgba(244,208,58,0.1) selection-tag-bg / #f1c409 selection-tag-text — pending design token
      return "bg-[rgba(244,208,58,0.1)] text-[#f1c409]";
    case "odds":
      // @figma-hardcoded: rgba(237,116,66,0.2) odds-tag-bg / #ed7442 odds-tag-text — pending design token
      return "bg-[rgba(237,116,66,0.2)] text-[#ed7442]";
  }
}
