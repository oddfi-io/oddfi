"use client";

import CaretDownCustomIcon from "@/components/icons/CaretDownCustomIcon";
import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
import { CHAIN_ICON_MAP, type TokenMeta } from "@/lib/token-registry";
import { getChainMeta } from "@/lib/chain-registry";

interface TokenSelectorProps {
  value: TokenMeta;
  /** 点击后由父级打开 TokenPickerModal（原 DropdownMenu 改为外部 Picker） */
  onClick: () => void;
  /** testnet 模式下锁定代币，隐藏箭头且禁止打开 picker */
  locked?: boolean;
}

/**
 * 纯触发器：Swap "支付" / "收到" 区域的 token 选择按钮。
 * 点击后通过 onClick 通知父级 SwapCard 打开 TokenPickerModal。
 */
export default function TokenSelector({ value, onClick, locked }: TokenSelectorProps) {
  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      className={`flex min-h-[44px] shrink-0 items-center gap-[8px] ${locked ? "cursor-default" : "transition-opacity hover:opacity-90"}`}
      style={{ touchAction: "manipulation" }}
    >
      <TokenIconWithChain
        tokenIconUrl={value.iconUrl}
        tokenSymbol={value.symbol}
        chainIconUrl={CHAIN_ICON_MAP[value.chainId] ?? ""}
        size={28}
        mainIconTopOffset={2}
      />

      <div className="flex flex-col items-start">
        <div className="flex items-center gap-[4px]">
          <span className="text-[18px] font-semibold leading-[26px] text-primary">
            {value.symbol}
          </span>
          {!locked && <CaretDownCustomIcon size={16} className="text-secondary" />}
        </div>
        <span className="text-[12px] leading-[18px] text-tertiary">
          {getChainMeta(value.chainId).name}
        </span>
      </div>
    </button>
  );
}
