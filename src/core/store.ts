import {
  AUTO_COLLAPSE_DELAY,
  AUTO_EXPAND_DELAY,
  DEFAULT_TOAST_DURATION,
  EXIT_DURATION,
} from "../constants";
import type { SileoOptions, SileoPosition, SileoState } from "../types";

export interface InternalSileoOptions extends SileoOptions {
  state?: SileoState;
}

export interface SileoItem extends InternalSileoOptions {
  id: string;
  instanceId: string;
  exiting?: boolean;
  autoExpandDelayMs?: number;
  autoCollapseDelayMs?: number;
}

export type SileoListener = (toasts: SileoItem[]) => void;

interface SileoStore {
  toasts: SileoItem[];
  listeners: Set<SileoListener>;
  position: SileoPosition;
  options?: Partial<SileoOptions>;
}

export const store: SileoStore = {
  toasts: [],
  listeners: new Set(),
  position: "top-right",
  options: undefined,
};

let idCounter = 0;

function emit(): void {
  for (const listener of store.listeners) listener(store.toasts);
}

export function updateStore(
  update: (previous: SileoItem[]) => SileoItem[],
): void {
  store.toasts = update(store.toasts);
  emit();
}

function generateId(): string {
  idCounter += 1;
  return `${idCounter}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function timeoutKey(toast: SileoItem): string {
  return `${toast.id}:${toast.instanceId}`;
}

function resolveAutopilot(
  options: InternalSileoOptions,
  duration: number | null,
): { expandDelayMs?: number; collapseDelayMs?: number } {
  if (options.autopilot === false || !duration || duration <= 0) return {};

  const config =
    typeof options.autopilot === "object" ? options.autopilot : undefined;
  const clamp = (value: number) => Math.min(duration, Math.max(0, value));

  return {
    expandDelayMs: clamp(config?.expand ?? AUTO_EXPAND_DELAY),
    collapseDelayMs: clamp(config?.collapse ?? AUTO_COLLAPSE_DELAY),
  };
}

function mergeOptions(options: InternalSileoOptions): InternalSileoOptions {
  return {
    ...store.options,
    ...options,
    styles: { ...store.options?.styles, ...options.styles },
  };
}

function buildSileoItem(
  options: InternalSileoOptions,
  id: string,
  fallbackPosition?: SileoPosition,
): SileoItem {
  const duration = options.duration ?? DEFAULT_TOAST_DURATION;
  const autopilot = resolveAutopilot(options, duration);

  return {
    ...options,
    id,
    instanceId: generateId(),
    position: options.position ?? fallbackPosition ?? store.position,
    autoExpandDelayMs: autopilot.expandDelayMs,
    autoCollapseDelayMs: autopilot.collapseDelayMs,
  };
}

export function createToast(options: InternalSileoOptions): SileoItem {
  const liveToasts = store.toasts.filter((toast) => !toast.exiting);
  const merged = mergeOptions(options);
  const id = merged.id ?? "sileo-default";
  const previous = liveToasts.find((toast) => toast.id === id);
  const item = buildSileoItem(merged, id, previous?.position);

  if (previous) {
    updateStore((toasts) =>
      toasts.map((toast) => (toast.id === id ? item : toast)),
    );
  } else {
    updateStore((toasts) => [
      ...toasts.filter((toast) => toast.id !== id),
      item,
    ]);
  }

  return item;
}

export function updateToast(id: string, options: InternalSileoOptions): void {
  const existing = store.toasts.find((toast) => toast.id === id);
  if (!existing) return;

  const item = buildSileoItem(mergeOptions(options), id, existing.position);
  updateStore((toasts) =>
    toasts.map((toast) => (toast.id === id ? item : toast)),
  );
}

export function dismissToast(id: string): void {
  const item = store.toasts.find((toast) => toast.id === id);
  if (!item || item.exiting) return;

  updateStore((toasts) =>
    toasts.map((toast) =>
      toast.id === id ? { ...toast, exiting: true } : toast,
    ),
  );

  setTimeout(() => {
    updateStore((toasts) => toasts.filter((toast) => toast.id !== id));
  }, EXIT_DURATION);
}

export function resetStore(): void {
  store.toasts = [];
  store.position = "top-right";
  store.options = undefined;
  idCounter = 0;
  emit();
}
