"use client";

import { useState, useCallback } from "react";
import { truncateAddress } from "@/lib/proxy-wallet/utils";

interface AddressDisplayProps {
  address: string;
  /** Label shown above the address, e.g. "Receive address" */
  label?: string;
  /** Show full address (false) or truncated (true, default) */
  truncate?: boolean;
  /** Show copy button (default true) */
  copyable?: boolean;
}

/**
 * Reusable address display with optional label and one-tap copy.
 * Used in Deposit (receive address), Claim (destination), etc.
 */
export function AddressDisplay({
  address,
  label,
  truncate = true,
  copyable = true,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("[AddressDisplay] Failed to copy address", e);
    }
  }, [address]);

  const displayAddress = truncate ? truncateAddress(address) : address;

  return (
    <div className="w-full">
      {label && <div className="text-xs text-secondary mb-1">{label}</div>}
      <div className="flex items-center gap-2">
        <span className="text-sm text-primary font-mono break-all flex-1" title={address}>
          {displayAddress}
        </span>
        {copyable && (
          <button
            onClick={handleCopy}
            className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center
                       text-secondary hover:text-primary transition-colors touch-manipulation"
            aria-label="Copy address"
          >
            {copied ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
