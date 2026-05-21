import { storageKey } from "./constants";
import type { SessionState } from "./types";

export function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function getDiskStatusClassName(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "ready") {
    return "statusBadgeReady";
  }

  if (["deleting", "deleted", "failed", "error"].includes(normalized)) {
    return normalized === "deleting" || normalized === "deleted"
      ? "statusBadgeDeleting"
      : "statusBadgeError";
  }

  return "statusBadgePending";
}

export function formatCompactBytesPerSecond(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B/s";
  }

  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  let next = value;
  let unitIndex = 0;

  while (next >= 1024 && unitIndex < units.length - 1) {
    next /= 1024;
    unitIndex += 1;
  }

  return `${next >= 100 ? next.toFixed(0) : next >= 10 ? next.toFixed(1) : next.toFixed(2)} ${units[unitIndex]}`;
}

export function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat("ru-RU", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100 ? 0 : 1
  }).format(value);
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

export function readStoredSession(): SessionState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}
