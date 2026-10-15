"use client";

import { Toaster as SonnerToaster } from "sonner";
import { ToastStatusIcon } from "@/components/icons/ToastStatusIcon";

export default function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      visibleToasts={3}
      theme="dark"
      closeButton
      offset={{ top: 80, right: 16 }}
      gap={13}
      icons={{
        success: <ToastStatusIcon type="success" />,
        error: <ToastStatusIcon type="error" />,
        warning: <ToastStatusIcon type="warning" />,
        info: <ToastStatusIcon type="info" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "oddfi-toast",
        },
      }}
    />
  );
}
