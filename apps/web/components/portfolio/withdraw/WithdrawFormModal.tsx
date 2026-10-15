"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { CaretDownIcon } from "@phosphor-icons/react";
import PlusSquareIcon from "@/components/icons/PlusSquareIcon";
import Modal from "@/components/ui/Modal";
import { formatAmount } from "@/lib/decimal";
import { PLATFORM_TOKEN, PLATFORM_TOKEN_DISPLAY } from "@/lib/platform-token";
import { useAccountBalance } from "@/hooks/useAccountBalance";
import { useWithdrawFee } from "@/hooks/useWithdrawFee";

import { TokenIconWithChain } from "@/components/ui/TokenIconWithChain";
const GAS_ICON = "/icons/gas.svg";

// ─── WithdrawFormModal (DD-080) ───────────────────────────────────────────────
// Figma [2009:95211] + [2009:95791] — Withdraw form with address/coin/network/amount
// 报价数据 fee/real_amount 来自 /account/withdraw/fee（useWithdrawFee）
// priceImpact/maxSlippage 非接口字段，保留硬编码占位

const WITHDRAW_QUOTE_STATIC = {
  priceImpact: "0.48%",
  maxSlippage: "Auto · 0.78%",
} as const;

// 最小提现金额（表单侧校验，后端另有校验）
const MIN_AMOUNT = 1;

interface WithdrawFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (args: { address: string; amount: string }) => void;
  /** tx 处于 signing/submitting 阶段时 true — 按钮转 loading 并阻断重复点击 */
  loading?: boolean;
}

function WithdrawFormModal({
  isOpen,
  onClose,
  onContinue,
  loading = false,
}: WithdrawFormModalProps) {
  const t = useTranslations("portfolio");
  const { address: eoaAddress } = useAccount();
  const { data: balanceData } = useAccountBalance();
  const availableBalance = balanceData?.available_balance ?? "0";

  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const addressInputRef = useRef<HTMLInputElement>(null);

  // 关闭后重置表单
  useEffect(() => {
    if (isOpen) {
      setAddress("");
      setAmount("");
    }
  }, [isOpen]);

  // 长地址默认展示尾部：非聚焦状态下（粘贴/「使用当前钱包」）将滚动条拉到末尾
  useEffect(() => {
    const el = addressInputRef.current;
    if (!el) return;
    if (document.activeElement !== el) {
      el.scrollLeft = el.scrollWidth;
    }
  }, [address]);

  const amountNum = Number(amount);
  const isAmountValid = Number.isFinite(amountNum) && amountNum >= MIN_AMOUNT;
  const isAddressValid = address.length > 0 && isAddress(address);
  const isValid = isAmountValid && isAddressValid;

  const { data: feeQuote, isFetching: isFetchingFee } = useWithdrawFee(amount, MIN_AMOUNT);

  const handleUseConnected = () => {
    if (eoaAddress) setAddress(eoaAddress);
  };

  const handleMax = () => {
    setAmount(availableBalance);
  };

  const receiveAmount = feeQuote?.real_amount ? formatAmount(feeQuote.real_amount) : null;
  const networkCost = feeQuote?.fee ? formatAmount(feeQuote.fee) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideHeader
      className="!border-[var(--line-border-primary)]"
      containerStyle={{ background: "var(--fill-modal)" }}
    >
      <div className="flex flex-col gap-[16px] pb-[8px]">
        {/* Title */}
        <h2 className="text-[18px] font-semibold text-primary leading-[26px] text-center -mt-[8px]">
          {t("withdraw")}
        </h2>

        {/* Receive Address */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex justify-between items-center">
            <label className="text-[14px] text-primary leading-[19px]">
              {t("wdReceiveAddress")}
            </label>
            <button
              onClick={handleUseConnected}
              disabled={!eoaAddress}
              className="text-[14px] text-brand-default leading-[19px] min-h-[44px] touch-manipulation disabled:opacity-40"
            >
              {t("wdUseConnected")}
            </button>
          </div>
          {/* @figma-hardcoded: #1c1c1f input-bg — pending design token */}
          <div className="w-full h-[48px] rounded-8 bg-[#1c1c1f] px-[12px] flex items-center">
            <input
              ref={addressInputRef}
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={(e) => {
                e.currentTarget.scrollLeft = e.currentTarget.scrollWidth;
              }}
              placeholder={t("wdPlaceholderInput")}
              className="flex-1 min-w-0 bg-transparent text-[14px] text-primary placeholder:text-tertiary outline-none"
            />
            {address.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAddress("");
                  addressInputRef.current?.focus();
                }}
                style={{ touchAction: "manipulation" }}
                className="shrink-0 ml-[8px] text-[14px] text-brand-default font-medium min-h-[44px]"
              >
                {t("wdClear")}
              </button>
            )}
          </div>
        </div>

        {/* Coin */}
        <div className="flex flex-col gap-[8px]">
          <label className="text-[14px] text-primary leading-[19px]">{t("wdCoin")}</label>
          {/* @figma-hardcoded: #1c1c1f input-bg — pending design token */}
          <div className="w-full h-[48px] rounded-8 bg-[#1c1c1f] px-[12px] flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-[8px]">
              <TokenIconWithChain
                tokenIconUrl={PLATFORM_TOKEN.iconUrl}
                tokenSymbol={PLATFORM_TOKEN_DISPLAY}
                size={20}
                hideChainBadge
              />
              <span className="text-[14px] font-bold text-primary">{PLATFORM_TOKEN_DISPLAY}</span>
              <span className="text-[14px] text-primary">{PLATFORM_TOKEN_DISPLAY}</span>
            </div>
            <CaretDownIcon size={16} weight="fill" className="text-tertiary" />
          </div>
        </div>

        {/* Network */}
        <div className="flex flex-col gap-[8px]">
          <label className="text-[14px] text-primary leading-[19px]">{t("wdNetwork")}</label>
          {/* @figma-hardcoded: #1c1c1f input-bg — pending design token */}
          <div className="w-full h-[48px] rounded-8 bg-[#1c1c1f] px-[12px] flex items-center justify-between cursor-pointer">
            <span className="text-[14px] text-primary">BNB (BNB Smart Chain)</span>
            <CaretDownIcon size={16} weight="fill" className="text-tertiary" />
          </div>
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex justify-between items-center">
            <label className="text-[14px] text-primary leading-[19px]">{t("wdAmount")}</label>
            <div className="flex items-center gap-[4px]">
              <span className="text-[12px] text-secondary leading-[18px]">{t("wdAvailable")}</span>
              <span className="text-[12px] text-primary leading-[18px] font-medium">
                {formatAmount(availableBalance)} {PLATFORM_TOKEN_DISPLAY}
              </span>
              <PlusSquareIcon size={16} className="text-brand-default" />
            </div>
          </div>
          {/* @figma-hardcoded: #1c1c1f input-bg — pending design token */}
          <div className="w-full h-[48px] rounded-8 bg-[#1c1c1f] px-[12px] flex items-center">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`≥ ${MIN_AMOUNT}`}
              className="flex-1 bg-transparent text-[14px] text-primary placeholder:text-tertiary outline-none"
            />
            <span className="text-[14px] text-secondary mx-[8px]">{PLATFORM_TOKEN_DISPLAY}</span>
            <button
              onClick={handleMax}
              className="text-[14px] text-brand-default font-medium min-h-[44px] touch-manipulation"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Info rows */}
        <div className="flex flex-col gap-[8px]">
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-secondary leading-[19px]">{t("wdPriceImpact")}</span>
            <span className="text-[14px] text-primary leading-[19px]">
              {isAmountValid ? WITHDRAW_QUOTE_STATIC.priceImpact : "-"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-secondary leading-[19px]">{t("wdMaxSlippage")}</span>
            <span className="text-[14px] text-primary leading-[19px]">
              {isAmountValid ? WITHDRAW_QUOTE_STATIC.maxSlippage : "-"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-secondary leading-[19px]">{t("wdNetworkCost")}</span>
            <span className="text-[14px] text-primary leading-[19px] flex items-center gap-[4px]">
              {networkCost && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={GAS_ICON} alt="" className="w-[14px] h-[14px] opacity-60" />
              )}
              {networkCost
                ? `${networkCost} ${PLATFORM_TOKEN_DISPLAY}`
                : isFetchingFee
                  ? "..."
                  : "-"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-secondary leading-[19px]">
              {t("wdReceiveAmount")}
            </span>
            <span
              className={`leading-[19px] ${receiveAmount ? "text-[16px] font-bold text-primary" : "text-[14px] text-primary"}`}
            >
              {receiveAmount
                ? `${receiveAmount} ${PLATFORM_TOKEN_DISPLAY}`
                : isFetchingFee
                  ? "..."
                  : "-"}
            </span>
          </div>
        </div>

        {/* Terms */}
        <p className="text-[11px] text-tertiary leading-[16px] text-center">
          {t("termsAgree")} <span className="text-primary underline">{t("termsOfUse")}</span>
        </p>

        {/* Continue button */}
        <button
          onClick={() => onContinue({ address, amount })}
          disabled={!isValid || loading}
          className="w-full h-[48px] rounded-12 bg-white text-[16px] font-semibold leading-[24px] min-h-[44px] touch-manipulation shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {/* @figma-hardcoded: #04060c static-black — pending design token */}
          <span className="text-[#04060c]">{loading ? t("confirming") : t("wdContinue")}</span>
        </button>
      </div>
    </Modal>
  );
}

export default memo(WithdrawFormModal);
