"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { EarlyAccessError, registerEarlyAccess } from "@/lib/api";
import type { ReferralSource } from "@/types/api";
import SourceField, { type SourceOption } from "./SourceField";

export type { SourceOption };

export interface Step1FormPayload {
  email: string;
  wallet: string;
  wish: string;
  source: SourceOption | "";
  sourceOther: string;
  rank: number;
}

interface Step1FormProps {
  onSubmit: (payload: Step1FormPayload) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BSC_WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

const SOURCE_MAP: Record<SourceOption, ReferralSource> = {
  telegram: "telegram",
  x: "x_twitter",
  discord: "discord",
  friends: "friend",
  kol: "kol",
  other: "other",
};

/**
 * Step1Form (DD-103)
 *
 * 早鸟登记表单：邮箱 + BSC 链地址 + 最期待的功能 + 来源。
 * 通过 Figma 6086:3537 像素实现；提交时调 POST /api/v1/early_access/register，
 * 成功后通过 onSubmit 携 rank 通知父组件切到 step2。
 */
export default function Step1Form({ onSubmit }: Step1FormProps) {
  const t = useTranslations("earlyBird.step1");
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [wish, setWish] = useState("");
  const [source, setSource] = useState<SourceOption | "">("");
  const [sourceOther, setSourceOther] = useState("");
  const [walletTouched, setWalletTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailServerError, setEmailServerError] = useState<string | null>(null);
  const [walletServerError, setWalletServerError] = useState<string | null>(null);
  const [wishServerError, setWishServerError] = useState<string | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);

  const kindToMessage = (kind: import("@/lib/api").EarlyAccessErrorKind): string => {
    switch (kind) {
      case "email_invalid":
        return t("emailInvalidServer");
      case "email_taken":
        return t("emailAlreadyRegistered");
      case "wallet_invalid":
        return t("walletError");
      case "wallet_taken":
        return t("walletAlreadyRegistered");
      case "wish_too_long":
        return t("wishTooLong");
      case "captcha_failed":
        return t("captchaFailed");
      case "required_missing":
        return t("requiredMissing");
      case "source_invalid":
        return t("sourceInvalid");
      case "too_many_requests":
        return t("tooManyRequests");
      case "network":
        return t("networkError");
      case "server":
      default:
        return t("submitError");
    }
  };

  const emailValid = EMAIL_RE.test(email);
  const walletValid = BSC_WALLET_RE.test(wallet);
  const sourceValid = source !== "" && (source !== "other" || sourceOther.trim().length > 0);
  const formValid = emailValid && walletValid && sourceValid;
  const walletError = walletTouched && wallet.length > 0 && !walletValid;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setWalletTouched(true);
    if (!formValid || submitting) return;

    setEmailServerError(null);
    setWalletServerError(null);
    setWishServerError(null);
    setGenericError(null);
    setSubmitting(true);

    try {
      const res = await registerEarlyAccess({
        email,
        wallet_address: wallet,
        expected_feature: wish || undefined,
        referral_source: source ? SOURCE_MAP[source] : undefined,
        referral_source_other: source === "other" ? sourceOther : undefined,
        source: "home",
      });
      onSubmit({ email, wallet, wish, source, sourceOther, rank: res.rank });
    } catch (err) {
      const kind = err instanceof EarlyAccessError ? err.kind : "server";
      const message = kindToMessage(kind);
      if (kind === "email_invalid" || kind === "email_taken") {
        setEmailServerError(message);
      } else if (kind === "wallet_invalid" || kind === "wallet_taken") {
        setWalletServerError(message);
      } else if (kind === "wish_too_long") {
        setWishServerError(message);
      } else {
        setGenericError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 w-full">
      {/* Field group - Figma 6144:57381 gap-32 between inputs */}
      <div className="flex flex-col gap-8">
        {/* Email */}
        <Field
          label={t("emailLabel")}
          hint={t("emailHint")}
          inputId="early-bird-email"
          required
          errorText={emailServerError ?? undefined}
        >
          <input
            id="early-bird-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailServerError) setEmailServerError(null);
            }}
            placeholder={t("emailPlaceholder")}
            required
            autoComplete="email"
            className="h-[48px] w-full rounded-8 bg-fill-input-modal px-3 text-[14px] leading-[18px] text-primary outline-none placeholder:opacity-30 touch-manipulation"
          />
        </Field>

        {/* BSC wallet */}
        <Field
          label={t("walletLabel")}
          hint={t("walletHint")}
          inputId="early-bird-wallet"
          required
          errorText={walletServerError ?? (walletError ? t("walletError") : undefined)}
        >
          <input
            id="early-bird-wallet"
            type="text"
            value={wallet}
            onChange={(e) => {
              setWallet(e.target.value);
              if (walletServerError) setWalletServerError(null);
            }}
            onBlur={() => setWalletTouched(true)}
            placeholder={t("walletPlaceholder")}
            required
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            className="h-[48px] w-full rounded-8 bg-fill-input-modal px-3 text-[14px] leading-[18px] text-primary outline-none placeholder:opacity-30 touch-manipulation"
          />
        </Field>

        {/* Wish (optional) */}
        <Field
          label={t("wishLabel")}
          hint={t("wishHint")}
          inputId="early-bird-wish"
          errorText={wishServerError ?? undefined}
        >
          <textarea
            id="early-bird-wish"
            value={wish}
            onChange={(e) => {
              setWish(e.target.value);
              if (wishServerError) setWishServerError(null);
            }}
            placeholder={t("wishPlaceholder")}
            rows={3}
            className="min-h-[48px] w-full resize-y rounded-8 bg-fill-input-modal px-3 py-3 text-[14px] leading-[18px] text-primary outline-none placeholder:opacity-30 touch-manipulation"
          />
        </Field>

        {/* Source — How did you hear about Oddfi? (Figma 6086:4441, 自建 SourceField) */}
        <SourceField
          value={source}
          onChange={setSource}
          other={sourceOther}
          onOtherChange={setSourceOther}
          label={t("sourceLabel")}
          hint={t("sourceHint")}
          required
        />
      </div>

      {genericError && (
        <p className="text-[12px] leading-[18px] font-medium text-fn-red" role="alert">
          {genericError}
        </p>
      )}

      {/* Submit - Figma: 48h, white bg, static-black text */}
      <button
        type="submit"
        disabled={!formValid || submitting}
        className="inline-flex h-[48px] w-full items-center justify-center rounded-12 bg-white px-4 text-[14px] leading-[18px] font-medium text-static-black transition-opacity disabled:opacity-40 touch-manipulation"
        style={{ touchAction: "manipulation" }}
      >
        {submitting ? t("submitting") : t("submitCta")}
      </button>
    </form>
  );
}

interface FieldProps {
  label: string;
  hint: string;
  inputId: string;
  required?: boolean;
  errorText?: string;
  children: React.ReactNode;
}

function Field({ label, hint, inputId, required, errorText, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-[14px] leading-[18px] text-primary">
          {label}
          {required && <span className="ml-1 text-fn-red">*</span>}
        </label>
        <p className="text-[12px] leading-[18px] font-medium text-tertiary">{hint}</p>
      </div>
      <div className="flex flex-col gap-1">
        {children}
        {errorText && (
          <p className="text-[10px] leading-[14px] font-medium text-fn-red" role="alert">
            {errorText}
          </p>
        )}
      </div>
    </div>
  );
}
