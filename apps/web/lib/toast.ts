import { toast as sonnerToast } from "sonner";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastOptions {
  /** Action button label */
  actionLabel?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Custom duration in ms. Defaults: success/info 3000, error/warning 5000 */
  duration?: number;
  /** Optional description text below the main message */
  description?: string;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 5000,
  info: 3000,
};

/**
 * Global imperative toast API. Accepts pre-translated strings.
 * In React components: `const t = useTranslations('toast'); showToast(t('key'))`
 * In stores/non-React: pass English fallback strings directly.
 */
export function showToast(message: string, type: ToastType = "info", options?: ToastOptions) {
  const duration = options?.duration ?? DEFAULT_DURATION[type];
  const action =
    options?.actionLabel && options?.onAction
      ? { label: options.actionLabel, onClick: options.onAction }
      : undefined;

  const toastFn = sonnerToast[type];
  toastFn(message, {
    description: options?.description,
    duration,
    action,
  });
}

export const toastSuccess = (msg: string, opts?: ToastOptions) => showToast(msg, "success", opts);
export const toastError = (msg: string, opts?: ToastOptions) => showToast(msg, "error", opts);
export const toastWarning = (msg: string, opts?: ToastOptions) => showToast(msg, "warning", opts);
export const toastInfo = (msg: string, opts?: ToastOptions) => showToast(msg, "info", opts);
