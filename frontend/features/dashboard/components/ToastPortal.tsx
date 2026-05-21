"use client";

import { createPortal } from "react-dom";

import type { ToastState } from "../types";

type ToastPortalProps = {
  toast: ToastState | null;
};

export function ToastPortal({ toast }: ToastPortalProps) {
  if (!toast || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="toastViewport" aria-live="polite" aria-atomic="true">
      <div className={`toast toast${toast.kind === "success" ? "Success" : "Error"}`}>
        <p className="toastText">{toast.message}</p>
      </div>
    </div>,
    document.body
  );
}
