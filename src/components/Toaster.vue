<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import {
  DEFAULT_MAX_VISIBLE_TOASTS,
  DEFAULT_TOAST_DURATION,
  HEIGHT,
  STACK_COLLAPSE_DEBOUNCE_MS,
} from "../constants";
import { configureSileo } from "../core/api";
import {
  dismissToast,
  store,
  timeoutKey,
  type SileoItem,
  type SileoListener,
} from "../core/store";
import {
  SILEO_POSITIONS,
  type SileoOffsetConfig,
  type SileoOffsetValue,
  type SileoOptions,
  type SileoPosition,
  type SileoStackProps,
  type SileoTheme,
  type SileoViewportStyle,
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
    maxVisibleToasts?: number;
    teleport?: boolean | string;
  }>(),
  {
    position: "top-right",
    zIndex: 1000,
    theme: "system",
    maxVisibleToasts: DEFAULT_MAX_VISIBLE_TOASTS,
    teleport: true,
  },
);

const toasts = shallowRef<SileoItem[]>(store.toasts);
const activeId = ref<string>();
const resolvedTheme = ref<"light" | "dark">("light");
const hovering = ref(false);
const mounted = ref(false);
const timers = new Map<string, number>();
const stackExpanded = ref(new Map<SileoPosition, boolean>());
const frontHeights = ref(new Map<SileoPosition, number>());
const stackCollapseTimers = new Map<SileoPosition, number>();
const toastElements = new Map<string, HTMLElement>();
let mediaQuery: MediaQueryList | undefined;
let frontHeightFrame = 0;

const teleportTarget = computed(() =>
  typeof props.teleport === "string" ? props.teleport : "body",
);

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

const byPosition = computed(() => {
  const positions = new Map<SileoPosition, SileoItem[]>();
  for (const toast of toasts.value) {
    const position = toast.position ?? props.position;
    const items = positions.get(position) ?? [];
    items.push(toast);
    positions.set(position, items);
  }
  return positions;
});

// Fixed order keeps viewports from remounting when a position empties out.
const activePositions = computed(() =>
  SILEO_POSITIONS.map(
    (position) => [position, byPosition.value.get(position)] as const,
  ).filter((entry): entry is [SileoPosition, SileoItem[]] =>
    Boolean(entry[1]?.length),
  ),
);

const stackMeta = computed(() => {
  const meta = new Map<string, SileoStackProps>();
  for (const [position, items] of byPosition.value) {
    const stackSize = items.length;
    const frontHeight = frontHeights.value.get(position) ?? HEIGHT;
    const expanded = stackExpanded.value.get(position) ?? false;
    items.forEach((item, index) => {
      const stackIndex = stackSize - 1 - index;
      meta.set(item.id, {
        stackIndex,
        stackSize,
        frontHeight,
        stackExpanded: expanded,
        stackVisible: stackIndex < props.maxVisibleToasts,
      });
    });
  }
  return meta;
});

function stackProps(id: string): SileoStackProps | undefined {
  return stackMeta.value.get(id);
}

function expandStack(position: SileoPosition): void {
  const timer = stackCollapseTimers.get(position);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    stackCollapseTimers.delete(position);
  }
  if (stackExpanded.value.get(position)) return;
  stackExpanded.value = new Map(stackExpanded.value).set(position, true);
}

function collapseStack(position: SileoPosition): void {
  const existing = stackCollapseTimers.get(position);
  if (existing !== undefined) window.clearTimeout(existing);
  stackCollapseTimers.set(
    position,
    window.setTimeout(() => {
      stackCollapseTimers.delete(position);
      stackExpanded.value = new Map(stackExpanded.value).set(position, false);
    }, STACK_COLLAPSE_DEBOUNCE_MS),
  );
}

// The collapsed stack sizes itself against the front toast, so track its height.
function trackToastElement(
  id: string,
  position: SileoPosition,
  element: HTMLElement | null,
): void {
  if (!element) {
    toastElements.delete(id);
    return;
  }
  toastElements.set(id, element);

  const items = byPosition.value.get(position);
  if (items?.at(-1)?.id !== id || frontHeightFrame) return;
  frontHeightFrame = requestAnimationFrame(() => {
    frontHeightFrame = 0;
    const height = element.offsetHeight;
    if (height > 0 && frontHeights.value.get(position) !== height) {
      frontHeights.value = new Map(frontHeights.value).set(position, height);
    }
  });
}

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

// An emptied position must not keep its stack open for the next batch.
function pruneStackState(): void {
  for (const position of stackExpanded.value.keys()) {
    if (byPosition.value.has(position)) continue;
    stackExpanded.value = new Map(stackExpanded.value);
    stackExpanded.value.delete(position);
    frontHeights.value = new Map(frontHeights.value);
    frontHeights.value.delete(position);
  }
}

function resolveTheme(): void {
  if (props.theme === "light" || props.theme === "dark") {
    resolvedTheme.value = props.theme;
    return;
  }
  resolvedTheme.value = mediaQuery?.matches ? "dark" : "light";
}

function handleMouseEnter(id: string, position: SileoPosition): void {
  activeId.value = id;
  expandStack(position);
  if (hovering.value) return;
  hovering.value = true;
  clearTimers();
}

function handleMouseLeave(position: SileoPosition): void {
  activeId.value = latestId.value;
  collapseStack(position);
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
watch(
  toasts,
  (items) => {
    syncTimers(items);
    pruneStackState();
  },
  { immediate: true },
);
watch(latestId, (id) => {
  activeId.value = id;
});
watch(() => props.theme, resolveTheme);

onMounted(() => {
  // Every viewport renders the whole store, so a second one duplicates toasts.
  if (store.listeners.size > 0) {
    console.warn(
      "[sileo] Multiple <Toaster> instances are mounted. Render only one and use the position option per toast.",
    );
  }
  mounted.value = true;
  store.listeners.add(listener);
  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", resolveTheme);
  resolveTheme();
});

onBeforeUnmount(() => {
  store.listeners.delete(listener);
  mediaQuery?.removeEventListener("change", resolveTheme);
  clearTimers();
  for (const timer of stackCollapseTimers.values()) window.clearTimeout(timer);
  stackCollapseTimers.clear();
  cancelAnimationFrame(frontHeightFrame);
  toastElements.clear();
});
</script>

<template>
  <slot />
  <Teleport v-if="mounted" :to="teleportTarget" :disabled="teleport === false">
    <section
      v-for="[positionName, items] in activePositions"
      :key="positionName"
      data-sileo-viewport
      :data-position="positionName"
      :data-theme="resolvedTheme"
      :data-stacked="items.length > 1 ? '' : undefined"
      :data-stack-expanded="stackExpanded.get(positionName) ? '' : undefined"
      :style="viewportStyle(positionName)"
      @mouseenter="expandStack(positionName)"
      @mouseleave="collapseStack(positionName)"
    >
      <SileoToast
        v-for="item in items"
        :id="item.id"
        :ref="
          (element) =>
            trackToastElement(
              item.id,
              positionName,
              (element as { $el?: HTMLElement } | null)?.$el ?? null,
            )
        "
        :key="item.id"
        :uid="item.uid"
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
        :description-align="item.descriptionAlign"
        :closable="item.closable"
        :roundness="item.roundness"
        :exiting="item.exiting"
        :auto-expand-delay-ms="item.autoExpandDelayMs"
        :auto-collapse-delay-ms="item.autoCollapseDelayMs"
        :refresh-key="item.instanceId"
        :can-expand="activeId === undefined || activeId === item.id"
        :stack="stackProps(item.id)"
        @mouseenter="handleMouseEnter(item.id, positionName)"
        @mouseleave="handleMouseLeave(positionName)"
        @dismiss="dismissToast(item.id)"
      />
    </section>
  </Teleport>
</template>

<style scoped>
[data-sileo-viewport] {
  position: fixed;
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

/* --------------------------------- Stacking -------------------------------- */

[data-sileo-viewport][data-stacked] {
  transition: gap 500ms cubic-bezier(0.16, 1, 0.3, 1);
}

[data-sileo-viewport][data-stacked]:not([data-stack-expanded]) {
  gap: 0;
}

[data-sileo-viewport][data-stacked][data-stack-expanded] {
  gap: 0.75rem;
}

/* Collapsed followers shrink to the front toast and peek out by 8px. */
[data-sileo-viewport][data-stacked]:not([data-stack-expanded])
  [data-sileo-toast][data-stack-index]:not([data-stack-index="0"]) {
  height: var(--sileo-front-height, var(--sileo-height)) !important;
  overflow: hidden;
  pointer-events: none;
  transform: translateZ(0) scale(calc(1 - 0.05 * var(--sileo-stack-index))) !important;
}

[data-sileo-viewport][data-position^="top"][data-stacked]:not(
    [data-stack-expanded]
  )
  [data-sileo-toast][data-stack-index]:not([data-stack-index="0"]) {
  margin-top: calc(-1 * var(--sileo-front-height, var(--sileo-height)) + 8px);
  transform-origin: center top;
}

[data-sileo-viewport][data-position^="bottom"][data-stacked]:not(
    [data-stack-expanded]
  )
  [data-sileo-toast][data-stack-index]:not([data-stack-index="0"]) {
  margin-bottom: calc(
    -1 * var(--sileo-front-height, var(--sileo-height)) + 8px
  );
  transform-origin: center bottom;
}

[data-sileo-viewport] [data-sileo-toast][data-stack-hidden] {
  opacity: 0 !important;
  pointer-events: none !important;
}

[data-sileo-viewport]
  [data-sileo-toast][data-ready="true"][data-stack-index]:not(
    [data-stack-index="0"]
  ) {
  transition:
    transform 500ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 500ms cubic-bezier(0.16, 1, 0.3, 1),
    height 500ms cubic-bezier(0.16, 1, 0.3, 1),
    margin-top 500ms cubic-bezier(0.16, 1, 0.3, 1),
    margin-bottom 500ms cubic-bezier(0.16, 1, 0.3, 1);
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
