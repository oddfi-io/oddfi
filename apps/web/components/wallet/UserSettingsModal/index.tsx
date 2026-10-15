"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import { useUserProfile } from "@/hooks/useUserProfile";
import { validateUsername, type UsernameErrorCode } from "@/lib/username-validation";
import { toastSuccess } from "@/lib/toast";
import UsernameField from "./UsernameField";
import AddressField from "./AddressField";
import SocialConnectList from "./SocialConnectList";

interface UserSettingsModalProps {
  open: boolean;
  onClose: () => void;
  /** 用户身份地址（profileAddress = proxyWallet?.address ?? eoaAddress） */
  address: string;
}

export default function UserSettingsModal({ open, onClose, address }: UserSettingsModalProps) {
  const t = useTranslations("userSettings");
  const { profile, save } = useUserProfile(open ? address : undefined);

  const [username, setUsername] = useState("");
  const [error, setError] = useState<UsernameErrorCode | null>(null);
  const [touched, setTouched] = useState(false);

  // Sync local form state when modal opens or profile hydrates.
  useEffect(() => {
    if (!open) return;
    setUsername(profile?.username ?? "");
    setError(null);
    setTouched(false);
  }, [open, profile?.username]);

  const handleChange = (next: string) => {
    setUsername(next);
    if (touched) setError(validateUsername(next));
  };

  const handleBlur = () => {
    setTouched(true);
    setError(validateUsername(username));
  };

  const trimmed = username.trim();
  const dirty = trimmed !== (profile?.username ?? "");
  const isValid = validateUsername(trimmed) === null;
  const canSave = dirty && isValid;

  const handleSave = () => {
    const validation = validateUsername(trimmed);
    if (validation !== null) {
      setTouched(true);
      setError(validation);
      return;
    }
    save({ username: trimmed });
    toastSuccess(t("saved"));
    onClose();
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={t("title")}>
      <div className="flex flex-col gap-8 w-full pb-6 md:pb-0">
        <div className="flex flex-col gap-6 w-full">
          <UsernameField
            value={username}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched ? error : null}
          />
          <AddressField address={address} />
          <SocialConnectList />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="flex items-center justify-center h-12 w-full rounded-12 bg-white text-static-black text-[14px] leading-[18px] font-medium cursor-pointer touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {t("save")}
        </button>
      </div>
    </Modal>
  );
}
