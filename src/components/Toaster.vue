<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { DEFAULT_TOAST_DURATION } from "../constants";
import { configureSileo } from "../core/api";
import {
  dismissToast,
  store,
  timeoutKey,
  type SileoItem,
  type SileoListener,
} from "../core/store";
import type {
  SileoOffsetConfig,
  SileoOffsetValue,
  SileoOptions,
  SileoPosition,
  SileoTheme,
  SileoViewportStyle,
} from "../types";
import SileoToast from "./SileoToast.vue";

const props = withDefaults(
  defineProps<{
    position?: SileoPosition;
    offset?: SileoOffsetValue | SileoOffsetConfig;
    zIndex?: number;
    duration?: number | null;
    options?: Partial<SileoOptions>;
    theme?: SileoTheme;
  }>(),
  { position: "top-right", zIndex: 1000 },
);

const toasts = shallowRef<SileoItem[]>(store.toasts);
const activeId = ref<string>();
const resolvedTheme = ref<"light" | "dark">("light");
const hovering = ref(false);
const timers = new Map<string, number>();
let mediaQuery: MediaQueryList | undefined;

const listener: SileoListener = (nextToasts) => {
  toasts.value = nextToasts;
};

const latestId = computed(() => {
  for (let index = toasts.value.length - 1; index >= 0; index -= 1) {
    const toast = toasts.value[index];
    if (toast && !toast.exiting) return toast.id;
  }
  return undefined;
});

const globalOptions = computed<Partial<SileoOptions> | undefined>(() => {
  if (props.duration === undefined) return props.options;
  return { ...props.options, duration: props.duration };
});

const activePositions = computed(() => {
  const positions = new Map<SileoPosition, SileoItem[]>();
  for (const toast of toasts.value) {
    const position = toast.position ?? props.position;
    const items = positions.get(position) ?? [];
    items.push(toast);
    positions.set(position, items);
  }
  return positions;
});

function clearTimers(): void {
  for (const timer of timers.values()) window.clearTimeout(timer);
  timers.clear();
}

function schedule(items: SileoItem[]): void {
  if (hovering.value) return;
  for (const item of items) {
    if (item.exiting || item.duration === null) continue;
    const key = timeoutKey(item);
    if (timers.has(key)) continue;
    const duration = item.duration ?? DEFAULT_TOAST_DURATION;
    if (duration <= 0) continue;
    timers.set(
      key,
      window.setTimeout(() => dismissToast(item.id), duration),
    );
  }
}

function syncTimers(items: SileoItem[]): void {
  const activeKeys = new Set(items.map(timeoutKey));
  for (const [key, timer] of timers) {
    if (!activeKeys.has(key)) {
      window.clearTimeout(timer);
      timers.delete(key);
    }
  }
  schedule(items);
}

function resolveTheme(): void {
  if (props.theme === "light" || props.theme === "dark") {
    resolvedTheme.value = props.theme;
    return;
  }
  resolvedTheme.value = mediaQuery?.matches ? "dark" : "light";
}

function handleMouseEnter(id: string): void {
  activeId.value = id;
  if (hovering.value) return;
  hovering.value = true;
  clearTimers();
}

function handleMouseLeave(): void {
  activeId.value = latestId.value;
  if (!hovering.value) return;
  hovering.value = false;
  schedule(toasts.value);
}

function pillAlignment(position: SileoPosition): "left" | "center" | "right" {
  if (position.includes("right")) return "right";
  if (position.includes("center")) return "center";
  return "left";
}

function expandDirection(position: SileoPosition): "top" | "bottom" {
  return position.startsWith("top") ? "bottom" : "top";
}

function viewportStyle(position: SileoPosition): SileoViewportStyle {
  const style: SileoViewportStyle = { zIndex: props.zIndex };
  if (props.offset === undefined) return style;
  const offset =
    typeof props.offset === "object"
      ? props.offset
      : {
          top: props.offset,
          right: props.offset,
          bottom: props.offset,
          left: props.offset,
        };
  const toCssValue = (value: SileoOffsetValue) =>
    typeof value === "number" ? `${value}px` : value;

  if (position.startsWith("top") && offset.top !== undefined) {
    style.top = toCssValue(offset.top);
  }
  if (position.startsWith("bottom") && offset.bottom !== undefined) {
    style.bottom = toCssValue(offset.bottom);
  }
  if (position.endsWith("left") && offset.left !== undefined) {
    style.left = toCssValue(offset.left);
  }
  if (position.endsWith("right") && offset.right !== undefined) {
    style.right = toCssValue(offset.right);
  }
  return style;
}

watch(
  [() => props.position, globalOptions],
  ([position, options]) => configureSileo(position, options),
  { immediate: true, deep: true },
);
watch(toasts, (items) => syncTimers(items), { immediate: true });
watch(latestId, (id) => {
  activeId.value = id;
});
watch(() => props.theme, resolveTheme);

onMounted(() => {
  store.listeners.add(listener);
  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", resolveTheme);
  resolveTheme();
});

onBeforeUnmount(() => {
  store.listeners.delete(listener);
  mediaQuery?.removeEventListener("change", resolveTheme);
  clearTimers();
});
</script>

<template>
  <slot />
  <section
    v-for="[positionName, items] in activePositions"
    :key="positionName"
    data-sileo-viewport
    :data-position="positionName"
    :data-theme="theme ? resolvedTheme : undefined"
    aria-live="polite"
    :style="viewportStyle(positionName)"
  >
    <SileoToast
      v-for="item in items"
      :id="item.id"
      :key="item.id"
      :state="item.state"
      :variant="item.variant"
      :gradient="item.gradient"
      :title="item.title"
      :description="item.description"
      :position="pillAlignment(positionName)"
      :expand="expandDirection(positionName)"
      :icon="item.icon"
      :fill="item.fill"
      :styles="item.styles"
      :button="item.button"
      :roundness="item.roundness"
      :exiting="item.exiting"
      :auto-expand-delay-ms="item.autoExpandDelayMs"
      :auto-collapse-delay-ms="item.autoCollapseDelayMs"
      :refresh-key="item.instanceId"
      :can-expand="activeId === undefined || activeId === item.id"
      @mouseenter="handleMouseEnter(item.id)"
      @mouseleave="handleMouseLeave"
      @dismiss="dismissToast(item.id)"
    />
  </section>
</template>

<style scoped>
[data-sileo-viewport] {
  position: fixed;
  z-index: 50;
  display: flex;
  gap: 0.75rem;
  max-width: calc(100vw - 1.5rem);
  padding: 0.75rem;
  pointer-events: none;
  contain: layout style;
}

[data-sileo-viewport][data-position^="top"] {
  top: 0;
  flex-direction: column-reverse;
}

[data-sileo-viewport][data-position^="bottom"] {
  bottom: 0;
  flex-direction: column;
}

[data-sileo-viewport][data-position$="left"] {
  left: 0;
  align-items: flex-start;
}

[data-sileo-viewport][data-position$="right"] {
  right: 0;
  align-items: flex-end;
}

[data-sileo-viewport][data-position$="center"] {
  left: 50%;
  align-items: center;
  transform: translateX(-50%);
}

[data-sileo-viewport][data-theme="light"] {
  --sileo-surface: #f7f7f5;
  --sileo-content-color: #141412;
  --sileo-variant-ink: #171715;
  --sileo-gradient-success-default-from: #166534;
  --sileo-gradient-success-default-to: #22c55e;
  --sileo-gradient-loading-default-from: #334155;
  --sileo-gradient-loading-default-to: #64748b;
  --sileo-gradient-error-default-from: #991b1b;
  --sileo-gradient-error-default-to: #ef4444;
  --sileo-gradient-warning-default-from: #92400e;
  --sileo-gradient-warning-default-to: #d97706;
  --sileo-gradient-info-default-from: #075985;
  --sileo-gradient-info-default-to: #0ea5e9;
  --sileo-gradient-action-default-from: #3730a3;
  --sileo-gradient-action-default-to: #8b5cf6;
}

[data-sileo-viewport][data-theme="dark"] {
  --sileo-surface: #1a1a1a;
  --sileo-content-color: #ffffff;
  --sileo-variant-ink: #ffffff;
  --sileo-gradient-success-default-from: #052e16;
  --sileo-gradient-success-default-to: #15803d;
  --sileo-gradient-loading-default-from: #0f172a;
  --sileo-gradient-loading-default-to: #475569;
  --sileo-gradient-error-default-from: #450a0a;
  --sileo-gradient-error-default-to: #b91c1c;
  --sileo-gradient-warning-default-from: #451a03;
  --sileo-gradient-warning-default-to: #b45309;
  --sileo-gradient-info-default-from: #082f49;
  --sileo-gradient-info-default-to: #0369a1;
  --sileo-gradient-action-default-from: #1e1b4b;
  --sileo-gradient-action-default-to: #6d28d9;
}
</style>
