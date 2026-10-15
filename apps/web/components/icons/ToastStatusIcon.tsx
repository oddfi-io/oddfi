interface ToastStatusIconProps {
  type: "success" | "error" | "warning" | "info";
}

const ICON_FILLS: Record<ToastStatusIconProps["type"], string> = {
  success: "var(--fn-green)",
  error: "var(--fn-red)",
  warning: "var(--fn-orange)",
  info: "var(--fn-brand)",
};

export function ToastStatusIcon({ type }: ToastStatusIconProps) {
  const fill = ICON_FILLS[type];

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6.67" fill={fill} />
      {type === "success" && (
        <path
          d="M5.25 8.2L7 10L10.75 6"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {type === "error" && (
        <path
          d="M5.75 5.75L10.25 10.25M10.25 5.75L5.75 10.25"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
      {type === "warning" && (
        <>
          <path d="M8 5.5V8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="10.5" r="0.75" fill="white" />
        </>
      )}
      {type === "info" && (
        <>
          <circle cx="8" cy="5.5" r="0.75" fill="white" />
          <path d="M8 7.5V10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
