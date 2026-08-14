<script setup lang="ts">
import { motion } from "motion-v";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type CSSProperties,
  type VNodeChild,
} from "vue";
import {
  BLUR_RATIO,
  DEFAULT_ROUNDNESS,
  HEADER_EXIT_MS,
  HEIGHT,
  MIN_EXPAND_RATIO,
  PILL_PADDING,
  SPRING,
  SWAP_COLLAPSE_MS,
  SWIPE_DISMISS_PX,
  SWIPE_MAX_PX,
  WIDTH,
} from "../constants";
import type {
  SileoButton,
  SileoGradient,
  SileoStackProps,
  SileoState,
  SileoStyles,
  SileoTextAlign,
  SileoVariant,
} from "../types";
import { ContentRenderer } from "./ContentRenderer";
import { SileoCloseIcon, SileoIcon } from "./SileoIcon";

interface View {
  title?: string;
  description?: VNodeChild;
  state: SileoState;
  icon?: VNodeChild;
  styles?: SileoStyles;
  button?: SileoButton;
  fill: string;
  descriptionAlign?: SileoTextAlign;
}

interface HeaderLayer {
  current: { key: string; view: View };
  previous: { key: string; view: View } | null;
}

const props = withDefaults(
  defineProps<{
    id: string;
    uid?: string;
    fill?: string;
    variant?: SileoVariant;
    gradient?: SileoGradient;
    state?: SileoState;
    title?: string;
    description?: VNodeChild;
    position?: "left" | "center" | "right";
    expand?: "top" | "bottom";
    icon?: VNodeChild;
    styles?: SileoStyles;
    button?: SileoButton;
    roundness?: number;
    exiting?: boolean;
    autoExpandDelayMs?: number;
    autoCollapseDelayMs?: number;
    canExpand?: boolean;
    refreshKey?: string;
    descriptionAlign?: SileoTextAlign;
    closable?: boolean;
    stack?: SileoStackProps;
  }>(),
  {
    state: "success",
    variant: "neutral",
    position: "left",
    expand: "bottom",
    exiting: false,
    canExpand: true,
    closable: true,
  },
);

const emit = defineEmits<{
  mouseenter: [event: MouseEvent];
  mouseleave: [event: MouseEvent];
  dismiss: [];
}>();

const MotionRect = motion.rect;
const DEFAULT_SURFACE =
  "var(--sileo-variant-surface, var(--sileo-surface, #ffffff))";
const buttonRef = ref<HTMLElement>();
const headerRef = ref<HTMLElement>();
const innerRef = ref<HTMLElement>();
const contentRef = ref<HTMLElement>();
const isExpanded = ref(false);
const ready = ref(false);
const pillWidth = ref(0);
const contentHeight = ref(0);
const appliedRefreshKey = ref(props.refreshKey);
const lastRefreshKey = ref(props.refreshKey);
const pendingView = shallowRef<{ key?: string; view: View }>();
const pointerStart = ref<number>();
let headerPadding: number | undefined;
let headerExitTimer: number | undefined;
let autoExpandTimer: number | undefined;
let autoCollapseTimer: number | undefined;
let swapTimer: number | undefined;
let pillObserver: ResizeObserver | undefined;
let contentObserver: ResizeObserver | undefined;
let pillFrame = 0;
let contentFrame = 0;

function createView(): View {
  return {
    title: props.title ?? props.state,
    description: props.description,
    state: props.state,
    icon: props.icon,
    styles: props.styles,
    button: props.button,
    fill: props.fill ?? DEFAULT_SURFACE,
    descriptionAlign: props.descriptionAlign,
  };
}

const view = shallowRef(createView());
const headerKey = computed(() => `${view.value.state}-${view.value.title}`);
const headerLayer = shallowRef<HeaderLayer>({
  current: { key: headerKey.value, view: view.value },
  previous: null,
});
const hasDescription = computed(
  () => Boolean(view.value.description) || Boolean(view.value.button),
);
const isLoading = computed(() => view.value.state === "loading");
const canOpen = computed(() => props.canExpand && !isLoading.value);
const open = computed(
  () => hasDescription.value && isExpanded.value && canOpen.value,
);
// Ids reach the DOM inside url(#...), so never trust the caller-supplied one.
const domId = computed(
  () => props.uid ?? (props.id.replace(/[^\w-]/g, "-") || "toast"),
);
const filterId = computed(() => `sileo-gooey-${domId.value}`);
const gradientId = computed(() => `sileo-gradient-${domId.value}`);
const isStacked = computed(() => (props.stack?.stackSize ?? 1) > 1);
const isAlert = computed(
  () => view.value.state === "error" || view.value.state === "warning",
);
const resolvedRoundness = computed(() =>
  Math.max(0, props.roundness ?? DEFAULT_ROUNDNESS),
);
const blur = computed(() => resolvedRoundness.value * BLUR_RATIO);
const minExpanded = HEIGHT * MIN_EXPAND_RATIO;
const rawExpanded = computed(() =>
  hasDescription.value
    ? Math.max(minExpanded, HEIGHT + contentHeight.value)
    : minExpanded,
);
const frozenExpanded = ref(rawExpanded.value);
const expanded = computed(() =>
  open.value ? rawExpanded.value : frozenExpanded.value,
);
const svgHeight = computed(() =>
  hasDescription.value ? Math.max(expanded.value, minExpanded) : HEIGHT,
);
const expandedContent = computed(() => Math.max(0, expanded.value - HEIGHT));
const resolvedPillWidth = computed(() =>
  Math.max(pillWidth.value || HEIGHT, HEIGHT),
);
const pillX = computed(() => {
  if (props.position === "right") return WIDTH - resolvedPillWidth.value;
  if (props.position === "center") {
    return (WIDTH - resolvedPillWidth.value) / 2;
  }
  return 0;
});
const pillAnimation = computed(() => ({
  attrX: pillX.value,
  width: resolvedPillWidth.value,
  height: open.value ? HEIGHT + blur.value * 3 : HEIGHT,
}));
const bodyAnimation = computed(() => ({
  height: open.value ? expandedContent.value : 0,
  opacity: open.value ? 1 : 0,
}));
const bodyTransition = computed(() =>
  open.value ? SPRING : { ...SPRING, bounce: 0 },
);
const pillTransition = computed(() => (ready.value ? SPRING : { duration: 0 }));
const rootStyle = computed<CSSProperties & Record<string, string>>(() => {
  const style: CSSProperties & Record<string, string> = {
    "--_h": `${open.value ? expanded.value : HEIGHT}px`,
    "--_pw": `${resolvedPillWidth.value}px`,
    "--_px": `${pillX.value}px`,
    "--sileo-roundness": `${resolvedRoundness.value}px`,
    "--_ht": `translateY(${open.value ? (props.expand === "bottom" ? 3 : -3) : 0}px) scale(${open.value ? 0.9 : 1})`,
  };

  const stack = props.stack;
  if (stack && stack.stackSize > 1) {
    style["--sileo-stack-index"] = `${stack.stackIndex}`;
    style["--sileo-front-height"] = `${stack.frontHeight}px`;
    style.zIndex = stack.stackSize - stack.stackIndex;
  }

  return style;
});

function clearTimer(timer: number | undefined): void {
  if (timer !== undefined) window.clearTimeout(timer);
}

function measurePill(): void {
  const inner = innerRef.value;
  const header = headerRef.value;
  if (!inner || !header) return;

  if (headerPadding === undefined) {
    const styles = getComputedStyle(header);
    headerPadding =
      Number.parseFloat(styles.paddingLeft) +
      Number.parseFloat(styles.paddingRight);
  }

  const width = inner.scrollWidth + headerPadding + PILL_PADDING;
  if (width > PILL_PADDING) pillWidth.value = width;
}

function measureContent(): void {
  contentHeight.value = contentRef.value?.scrollHeight ?? 0;
}

function applyPendingView(): void {
  if (!pendingView.value) return;
  view.value = pendingView.value.view;
  appliedRefreshKey.value = pendingView.value.key;
  pendingView.value = undefined;
}

function scheduleAutopilot(): void {
  clearTimer(autoExpandTimer);
  clearTimer(autoCollapseTimer);

  if (!hasDescription.value || props.exiting || !canOpen.value) {
    isExpanded.value = false;
    return;
  }
  if (
    props.autoExpandDelayMs === undefined &&
    props.autoCollapseDelayMs === undefined
  ) {
    return;
  }

  const expandDelay = props.autoExpandDelayMs ?? 0;
  const collapseDelay = props.autoCollapseDelayMs ?? 0;
  autoExpandTimer = window.setTimeout(() => {
    isExpanded.value = true;
  }, expandDelay);
  if (collapseDelay > 0) {
    autoCollapseTimer = window.setTimeout(() => {
      isExpanded.value = false;
    }, collapseDelay);
  }
}

watch(
  [open, rawExpanded],
  ([isOpen, height]) => {
    if (isOpen) frozenExpanded.value = height;
  },
  { immediate: true },
);

watch(
  () => props.fill,
  (fill) => {
    const resolvedFill = fill ?? DEFAULT_SURFACE;
    if (view.value.fill !== resolvedFill) {
      view.value = { ...view.value, fill: resolvedFill };
    }
  },
);

watch(
  () =>
    [
      props.refreshKey,
      props.title,
      props.description,
      props.state,
      props.icon,
      props.styles,
      props.button,
      props.descriptionAlign,
    ] as const,
  () => {
    const nextView = createView();
    if (props.refreshKey === undefined) {
      view.value = nextView;
      appliedRefreshKey.value = undefined;
      pendingView.value = undefined;
      lastRefreshKey.value = undefined;
      return;
    }
    if (lastRefreshKey.value === props.refreshKey) return;

    lastRefreshKey.value = props.refreshKey;
    clearTimer(swapTimer);
    if (open.value) {
      pendingView.value = { key: props.refreshKey, view: nextView };
      isExpanded.value = false;
      swapTimer = window.setTimeout(applyPendingView, SWAP_COLLAPSE_MS);
    } else {
      view.value = nextView;
      appliedRefreshKey.value = props.refreshKey;
    }
  },
  { deep: false },
);

watch(
  [headerKey, view],
  () => {
    const current = headerLayer.value.current;
    headerLayer.value =
      current.key === headerKey.value
        ? {
            ...headerLayer.value,
            current: { key: headerKey.value, view: view.value },
          }
        : {
            current: { key: headerKey.value, view: view.value },
            previous: current,
          };
    clearTimer(headerExitTimer);
    if (headerLayer.value.previous) {
      headerExitTimer = window.setTimeout(() => {
        headerLayer.value = { ...headerLayer.value, previous: null };
      }, HEADER_EXIT_MS);
    }
    void nextTick(measurePill);
  },
  { flush: "post" },
);

watch(
  [
    () => props.autoExpandDelayMs,
    () => props.autoCollapseDelayMs,
    () => props.exiting,
    canOpen,
    hasDescription,
    appliedRefreshKey,
  ],
  scheduleAutopilot,
  { immediate: true },
);

function handleMouseEnter(event: MouseEvent): void {
  emit("mouseenter", event);
  if (hasDescription.value) isExpanded.value = true;
}

function handleMouseLeave(event: MouseEvent): void {
  emit("mouseleave", event);
  isExpanded.value = false;
}

// Keyboard users never fire mouseenter, so focus has to open the toast too.
function handleFocusIn(): void {
  if (hasDescription.value) isExpanded.value = true;
}

function handleFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget as Node | null;
  if (next && buttonRef.value?.contains(next)) return;
  isExpanded.value = false;
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("dismiss");
    return;
  }
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target === buttonRef.value
  ) {
    event.preventDefault();
    isExpanded.value = !isExpanded.value;
  }
}

function handleTransitionEnd(event: TransitionEvent): void {
  if (event.propertyName !== "height" && event.propertyName !== "transform") {
    return;
  }
  if (!open.value) applyPendingView();
}

function handleAction(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  view.value.button?.onClick();
}

function releasePointer(event: PointerEvent): void {
  pointerStart.value = undefined;
  if (buttonRef.value) buttonRef.value.style.transform = "";
  if (buttonRef.value?.hasPointerCapture(event.pointerId)) {
    buttonRef.value.releasePointerCapture(event.pointerId);
  }
}

function handlePointerDown(event: PointerEvent): void {
  if (props.exiting) return;
  const target = event.target as HTMLElement;
  if (target.closest("[data-sileo-button], [data-sileo-dismiss]")) return;
  pointerStart.value = event.clientY;
  buttonRef.value?.setPointerCapture(event.pointerId);
}

function handlePointerMove(event: PointerEvent): void {
  const element = buttonRef.value;
  if (pointerStart.value === undefined || !element) return;
  const delta = event.clientY - pointerStart.value;
  const clamped = Math.min(Math.abs(delta), SWIPE_MAX_PX) * Math.sign(delta);
  element.style.transform = `translateY(${clamped}px)`;
}

function handlePointerUp(event: PointerEvent): void {
  if (pointerStart.value === undefined || !buttonRef.value) return;
  const delta = event.clientY - pointerStart.value;
  releasePointer(event);
  if (Math.abs(delta) > SWIPE_DISMISS_PX) emit("dismiss");
}

onMounted(() => {
  measurePill();
  measureContent();
  pillObserver = new ResizeObserver(() => {
    cancelAnimationFrame(pillFrame);
    pillFrame = requestAnimationFrame(measurePill);
  });
  contentObserver = new ResizeObserver(() => {
    cancelAnimationFrame(contentFrame);
    contentFrame = requestAnimationFrame(measureContent);
  });
  if (innerRef.value) pillObserver.observe(innerRef.value);
  if (contentRef.value) contentObserver.observe(contentRef.value);
  requestAnimationFrame(() => {
    ready.value = true;
  });
});

onBeforeUnmount(() => {
  clearTimer(headerExitTimer);
  clearTimer(autoExpandTimer);
  clearTimer(autoCollapseTimer);
  clearTimer(swapTimer);
  cancelAnimationFrame(pillFrame);
  cancelAnimationFrame(contentFrame);
  pillObserver?.disconnect();
  contentObserver?.disconnect();
});
</script>

<template>
  <article
    ref="buttonRef"
    tabindex="0"
    :role="isAlert ? 'alert' : 'status'"
    :aria-live="isAlert ? 'assertive' : 'polite'"
    data-sileo-toast
    :data-variant="variant"
    :data-ready="ready"
    :data-expanded="open"
    :data-exiting="exiting"
    :data-edge="expand"
    :data-position="position"
    :data-state="view.state"
    :data-stack-index="isStacked ? stack?.stackIndex : undefined"
    :data-stack-hidden="
      isStacked && stack?.stackVisible === false ? '' : undefined
    "
    :style="rootStyle"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @focusin="handleFocusIn"
    @focusout="handleFocusOut"
    @keydown="handleKeydown"
    @transitionend="handleTransitionEnd"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="releasePointer"
  >
    <div
      data-sileo-canvas
      :data-edge="expand"
      :style="{ filter: `url(#${filterId})` }"
    >
      <svg
        data-sileo-svg
        :width="WIDTH"
        :height="svgHeight"
        :viewBox="`0 0 ${WIDTH} ${svgHeight}`"
      >
        <title>Sileo notification</title>
        <defs>
          <filter
            :id="filterId"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            color-interpolation-filters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              :stdDeviation="blur"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
          <linearGradient
            v-if="variant === 'gradient'"
            :id="gradientId"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            :x2="WIDTH"
            y2="0"
          >
            <stop
              offset="0%"
              :stop-color="
                gradient?.from ??
                'var(--sileo-gradient-from, var(--sileo-state-gradient-from))'
              "
            />
            <stop
              offset="100%"
              :stop-color="
                gradient?.to ??
                'var(--sileo-gradient-to, var(--sileo-state-gradient-to))'
              "
            />
          </linearGradient>
        </defs>
        <MotionRect
          data-sileo-pill
          :rx="resolvedRoundness"
          :ry="resolvedRoundness"
          :fill="variant === 'gradient' ? `url(#${gradientId})` : view.fill"
          :initial="false"
          :animate="pillAnimation"
          :transition="pillTransition"
        />
        <MotionRect
          data-sileo-body
          :y="HEIGHT"
          :width="WIDTH"
          :rx="resolvedRoundness"
          :ry="resolvedRoundness"
          :fill="variant === 'gradient' ? `url(#${gradientId})` : view.fill"
          :initial="false"
          :animate="bodyAnimation"
          :transition="bodyTransition"
        />
      </svg>
    </div>

    <div ref="headerRef" data-sileo-header :data-edge="expand">
      <div data-sileo-header-stack>
        <div
          ref="innerRef"
          :key="headerLayer.current.key"
          data-sileo-header-inner
          data-layer="current"
        >
          <div
            data-sileo-badge
            :data-state="headerLayer.current.view.state"
            :class="headerLayer.current.view.styles?.badge"
          >
            <ContentRenderer
              v-if="headerLayer.current.view.icon"
              :content="headerLayer.current.view.icon"
            />
            <SileoIcon v-else :state="headerLayer.current.view.state" />
          </div>
          <span
            data-sileo-title
            :data-state="headerLayer.current.view.state"
            :class="headerLayer.current.view.styles?.title"
          >
            {{ headerLayer.current.view.title }}
          </span>
        </div>
        <div
          v-if="headerLayer.previous"
          :key="headerLayer.previous.key"
          data-sileo-header-inner
          data-layer="prev"
          data-exiting="true"
        >
          <div
            data-sileo-badge
            :data-state="headerLayer.previous.view.state"
            :class="headerLayer.previous.view.styles?.badge"
          >
            <ContentRenderer
              v-if="headerLayer.previous.view.icon"
              :content="headerLayer.previous.view.icon"
            />
            <SileoIcon v-else :state="headerLayer.previous.view.state" />
          </div>
          <span
            data-sileo-title
            :data-state="headerLayer.previous.view.state"
            :class="headerLayer.previous.view.styles?.title"
          >
            {{ headerLayer.previous.view.title }}
          </span>
        </div>
      </div>
    </div>

    <button
      v-if="closable && !isLoading"
      type="button"
      data-sileo-dismiss
      :data-edge="expand"
      aria-label="Dismiss notification"
      @click.prevent.stop="emit('dismiss')"
    >
      <SileoCloseIcon />
    </button>

    <div
      v-if="hasDescription"
      data-sileo-content
      :data-edge="expand"
      :data-visible="open"
    >
      <div
        ref="contentRef"
        data-sileo-description
        :data-align="view.descriptionAlign"
        :class="view.styles?.description"
      >
        <ContentRenderer :content="view.description" />
        <button
          v-if="view.button"
          type="button"
          data-sileo-button
          :data-state="view.state"
          :class="view.styles?.button"
          @click="handleAction"
        >
          {{ view.button.title }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
[data-sileo-toast] {
  --sileo-spring-easing: linear(
    0,
    0.002 0.6%,
    0.007 1.2%,
    0.015 1.8%,
    0.026 2.4%,
    0.041 3.1%,
    0.06 3.8%,
    0.108 5.3%,
    0.157 6.6%,
    0.214 8%,
    0.467 13.7%,
    0.577 16.3%,
    0.631 17.7%,
    0.682 19.1%,
    0.73 20.5%,
    0.771 21.8%,
    0.808 23.1%,
    0.844 24.5%,
    0.874 25.8%,
    0.903 27.2%,
    0.928 28.6%,
    0.952 30.1%,
    0.972 31.6%,
    0.988 33.1%,
    1.01 35.7%,
    1.025 38.5%,
    1.034 41.6%,
    1.038 45%,
    1.035 50.1%,
    1.012 64.2%,
    1.003 73%,
    0.999 83.7%,
    1
  );

  --sileo-duration: 600ms;
  --sileo-height: 40px;
  --sileo-width: 350px;

  --sileo-state-success: oklch(0.723 0.219 142.136);
  --sileo-state-loading: oklch(0.556 0 0);
  --sileo-state-error: oklch(0.637 0.237 25.331);
  --sileo-state-warning: oklch(0.795 0.184 86.047);
  --sileo-state-info: oklch(0.685 0.169 237.323);
  --sileo-state-action: oklch(0.623 0.214 259.815);
}

[data-sileo-toast] {
  position: relative;
  cursor: pointer;
  pointer-events: auto;
  touch-action: none;
  border: 0;
  background: transparent;
  padding: 0;
  width: var(--sileo-width);
  height: var(--_h, var(--sileo-height));
  opacity: 0;
  transform: translateZ(0) scale(0.95);
  transform-origin: center;
  contain: layout style;
  overflow: visible;
}

[data-sileo-toast][data-state="loading"] {
  cursor: default;
}

[data-sileo-toast][data-ready="true"] {
  opacity: 1;
  transform: translateZ(0) scale(1);
  transition:
    transform calc(var(--sileo-duration) * 0.66) var(--sileo-spring-easing),
    opacity calc(var(--sileo-duration) * 0.66) var(--sileo-spring-easing),
    margin-bottom calc(var(--sileo-duration) * 0.66) var(--sileo-spring-easing),
    margin-top calc(var(--sileo-duration) * 0.66) var(--sileo-spring-easing),
    height var(--sileo-duration) var(--sileo-spring-easing);
}

/* Entry animation direction */
[data-sileo-toast][data-edge="bottom"]:not([data-ready="true"]) {
  transform: translateY(-6px) scale(0.95);
}

[data-sileo-toast][data-edge="top"]:not([data-ready="true"]) {
  transform: translateY(6px) scale(0.95);
}

/* Exit */
[data-sileo-toast][data-ready="true"][data-exiting="true"] {
  opacity: 0;
  pointer-events: none;
}

[data-sileo-toast][data-edge="bottom"][data-ready="true"][data-exiting="true"] {
  transform: translateY(-6px) scale(0.95);
}

[data-sileo-toast][data-edge="top"][data-ready="true"][data-exiting="true"] {
  transform: translateY(6px) scale(0.95);
}

[data-sileo-canvas] {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  transform: translateZ(0);
  contain: layout style;
  overflow: visible;
}

[data-sileo-canvas][data-edge="top"] {
  bottom: 0;
  transform: scaleY(-1) translateZ(0);
}

[data-sileo-canvas][data-edge="bottom"] {
  top: 0;
}

[data-sileo-svg] {
  overflow: visible;
}

[data-sileo-header] {
  position: absolute;
  z-index: 20;
  display: flex;
  align-items: center;
  padding: 0.5rem;
  height: var(--sileo-height);
  overflow: hidden;
  left: var(--_px, 0px);
  transform: var(--_ht);
  max-width: var(--_pw);
}

[data-sileo-toast][data-ready="true"] [data-sileo-header] {
  transition:
    transform var(--sileo-duration) var(--sileo-spring-easing),
    left var(--sileo-duration) var(--sileo-spring-easing),
    max-width var(--sileo-duration) var(--sileo-spring-easing);
}

[data-sileo-header][data-edge="top"] {
  bottom: 0;
}

[data-sileo-header][data-edge="bottom"] {
  top: 0;
}

/* Header inner morphing */
[data-sileo-header-stack] {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 100%;
}

[data-sileo-header-inner] {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  opacity: 1;
  filter: blur(0px);
  transform: translateZ(0);
}

[data-sileo-header-inner][data-layer="current"] {
  position: relative;
  z-index: 1;
  animation: sileo-header-enter var(--sileo-duration) var(--sileo-spring-easing)
    both;
}

[data-sileo-header-inner][data-layer="current"]:not(:only-child),
[data-sileo-header-inner][data-exiting="true"] {
  will-change: opacity, filter;
}

[data-sileo-header-inner][data-layer="prev"] {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
  pointer-events: none;
}

[data-sileo-header-inner][data-exiting="true"] {
  animation: sileo-header-exit calc(var(--sileo-duration) * 0.7) ease forwards;
}

[data-sileo-badge] {
  display: flex;
  height: 24px;
  width: 24px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 2px;
  box-sizing: border-box;
  border-radius: 9999px;
  color: var(--sileo-tone, currentColor);
  background-color: var(--sileo-tone-bg, transparent);
}

[data-sileo-title] {
  font-size: 0.825rem;
  line-height: 1rem;
  font-weight: 500;
  text-transform: capitalize;
  color: var(--sileo-tone, currentColor);
}

:is([data-sileo-badge], [data-sileo-title], [data-sileo-button])[data-state] {
  --_c: var(--sileo-state-success);
}

:is(
  [data-sileo-badge],
  [data-sileo-title],
  [data-sileo-button]
)[data-state="loading"] {
  --_c: var(--sileo-state-loading);
}

:is(
  [data-sileo-badge],
  [data-sileo-title],
  [data-sileo-button]
)[data-state="error"] {
  --_c: var(--sileo-state-error);
}

:is(
  [data-sileo-badge],
  [data-sileo-title],
  [data-sileo-button]
)[data-state="warning"] {
  --_c: var(--sileo-state-warning);
}

:is(
  [data-sileo-badge],
  [data-sileo-title],
  [data-sileo-button]
)[data-state="info"] {
  --_c: var(--sileo-state-info);
}

:is(
  [data-sileo-badge],
  [data-sileo-title],
  [data-sileo-button]
)[data-state="action"] {
  --_c: var(--sileo-state-action);
}

:is([data-sileo-badge], [data-sileo-title])[data-state] {
  --sileo-tone: var(--_c);
  --sileo-tone-bg: color-mix(in oklch, var(--_c) 20%, transparent);
}

[data-sileo-content] {
  position: absolute;
  left: 0;
  z-index: 10;
  width: 100%;
  pointer-events: none;
}

[data-sileo-content]:not([data-visible="true"]) {
  visibility: hidden;
}

[data-sileo-content][data-edge="top"] {
  top: 0;
}

[data-sileo-content][data-edge="bottom"] {
  top: var(--sileo-height);
}

[data-sileo-content][data-visible="true"] {
  visibility: visible;
  pointer-events: auto;
}

[data-sileo-description] {
  width: 100%;
  text-align: left;
  padding: 1rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  contain: layout style paint;
  content-visibility: auto;
}

[data-sileo-description][data-align="center"] {
  text-align: center;
}

[data-sileo-description][data-align="right"] {
  text-align: right;
}

/* --------------------------------- Dismiss -------------------------------- */

[data-sileo-dismiss] {
  position: absolute;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 9999px;
  background: var(--sileo-variant-surface, var(--sileo-surface, #ffffff));
  color: var(--sileo-content-color, currentColor);
  opacity: 0;
  cursor: pointer;
  transform: scale(0.6);
  pointer-events: none;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
  transition:
    opacity 200ms ease,
    transform 200ms ease,
    background-color 150ms ease;
}

[data-sileo-dismiss][data-edge="bottom"] {
  top: -3px;
  left: calc(var(--_px) + var(--_pw) - 15px);
}

[data-sileo-dismiss][data-edge="top"] {
  bottom: -3px;
  left: calc(var(--_px) + var(--_pw) - 15px);
}

[data-sileo-toast]:hover [data-sileo-dismiss],
[data-sileo-toast]:focus-within [data-sileo-dismiss],
[data-sileo-dismiss]:focus-visible {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

[data-sileo-dismiss]:hover {
  background-color: color-mix(
    in oklch,
    var(--sileo-content-color, #000000) 15%,
    var(--sileo-variant-surface, var(--sileo-surface, #ffffff))
  );
}

/* Without hover there is nothing to reveal the button, so keep it visible. */
@media (hover: none) {
  [data-sileo-dismiss] {
    opacity: 0.6;
    transform: scale(1);
    pointer-events: auto;
  }
}

[data-sileo-button] {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.75rem;
  padding: 0 0.625rem;
  margin-top: 0.75rem;
  border-radius: 9999px;
  border: 0;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  color: var(--sileo-btn-color, currentColor);
  background-color: var(--sileo-btn-bg, transparent);
  transition: background-color 150ms ease;
}

[data-sileo-button]:hover {
  background-color: var(--sileo-btn-bg-hover, transparent);
}

[data-sileo-button][data-state] {
  --sileo-btn-color: var(--_c);
  --sileo-btn-bg: color-mix(in oklch, var(--_c) 15%, transparent);
  --sileo-btn-bg-hover: color-mix(in oklch, var(--_c) 25%, transparent);
}

[data-sileo-icon="spin"] {
  animation: sileo-spin 1s linear infinite;
}

@keyframes sileo-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes sileo-header-enter {
  from {
    opacity: 0;
    filter: blur(6px);
  }
  to {
    opacity: 1;
    filter: blur(0px);
  }
}

@keyframes sileo-header-exit {
  from {
    opacity: 1;
    filter: blur(0px);
  }
  to {
    opacity: 0;
    filter: blur(6px);
  }
}
[data-sileo-toast] {
  --sileo-state-color: var(--sileo-state-success);
  --sileo-variant-surface: var(--sileo-surface, #ffffff);
  --sileo-state-gradient-from: var(
    --sileo-gradient-success-from,
    var(--sileo-gradient-success-default-from, #166534)
  );
  --sileo-state-gradient-to: var(
    --sileo-gradient-success-to,
    var(--sileo-gradient-success-default-to, #22c55e)
  );
}

[data-sileo-toast][data-state="loading"] {
  --sileo-state-color: var(--sileo-state-loading);
  --sileo-state-gradient-from: var(
    --sileo-gradient-loading-from,
    var(--sileo-gradient-loading-default-from, #334155)
  );
  --sileo-state-gradient-to: var(
    --sileo-gradient-loading-to,
    var(--sileo-gradient-loading-default-to, #64748b)
  );
}

[data-sileo-toast][data-state="error"] {
  --sileo-state-color: var(--sileo-state-error);
  --sileo-state-gradient-from: var(
    --sileo-gradient-error-from,
    var(--sileo-gradient-error-default-from, #991b1b)
  );
  --sileo-state-gradient-to: var(
    --sileo-gradient-error-to,
    var(--sileo-gradient-error-default-to, #ef4444)
  );
}

[data-sileo-toast][data-state="warning"] {
  --sileo-state-color: var(--sileo-state-warning);
  --sileo-state-gradient-from: var(
    --sileo-gradient-warning-from,
    var(--sileo-gradient-warning-default-from, #92400e)
  );
  --sileo-state-gradient-to: var(
    --sileo-gradient-warning-to,
    var(--sileo-gradient-warning-default-to, #f59e0b)
  );
}

[data-sileo-toast][data-state="info"] {
  --sileo-state-color: var(--sileo-state-info);
  --sileo-state-gradient-from: var(
    --sileo-gradient-info-from,
    var(--sileo-gradient-info-default-from, #075985)
  );
  --sileo-state-gradient-to: var(
    --sileo-gradient-info-to,
    var(--sileo-gradient-info-default-to, #0ea5e9)
  );
}

[data-sileo-toast][data-state="action"] {
  --sileo-state-color: var(--sileo-state-action);
  --sileo-state-gradient-from: var(
    --sileo-gradient-action-from,
    var(--sileo-gradient-action-default-from, #3730a3)
  );
  --sileo-state-gradient-to: var(
    --sileo-gradient-action-to,
    var(--sileo-gradient-action-default-to, #8b5cf6)
  );
}

[data-sileo-toast][data-variant="colored"] {
  --sileo-variant-surface: color-mix(
    in oklch,
    var(--sileo-state-color) 42%,
    var(--sileo-surface, #ffffff)
  );
}

[data-sileo-toast][data-variant="colored"]
  :is([data-sileo-title], [data-sileo-description], [data-sileo-button]),
[data-sileo-toast][data-variant="gradient"]
  :is([data-sileo-title], [data-sileo-description], [data-sileo-button]) {
  color: var(--sileo-gradient-ink, #ffffff);
}

[data-sileo-pill],
[data-sileo-body] {
  transition:
    fill var(--sileo-duration) var(--sileo-spring-easing),
    stroke var(--sileo-duration) var(--sileo-spring-easing);
}

[data-sileo-description] {
  color: var(--sileo-content-color, currentColor);
}

[data-sileo-toast][data-edge="bottom"]:not([data-ready="true"]) {
  margin-bottom: calc(-1 * (var(--sileo-height) + 0.75rem));
}

[data-sileo-toast][data-edge="top"]:not([data-ready="true"]) {
  margin-top: calc(-1 * (var(--sileo-height) + 0.75rem));
}

@media (prefers-reduced-motion: no-preference) {
  [data-sileo-toast][data-ready="true"]:hover,
  [data-sileo-toast][data-ready="true"][data-exiting="true"] {
    will-change: transform, opacity, height;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-sileo-toast],
  [data-sileo-toast] * {
    animation-duration: 0.01ms;
    animation-iteration-count: 1;
    transition-duration: 0.01ms;
  }
}
</style>
