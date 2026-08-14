<script setup lang="ts">
import {
  sileo,
  Toaster,
  type SileoPosition,
  type SileoTextAlign,
  type SileoVariant,
} from "@danixts/sileo-vue";
import { onBeforeUnmount, onMounted, ref } from "vue";

const positions: SileoPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];
const variants: SileoVariant[] = ["neutral", "colored", "gradient"];
const alignments: SileoTextAlign[] = ["left", "center", "right"];
const visibleCounts = [1, 2, 3, 5];

const position = ref<SileoPosition>("top-right");
const variant = ref<SileoVariant>("neutral");
const descriptionAlign = ref<SileoTextAlign>("left");
const maxVisibleToasts = ref(3);
const closable = ref(true);
const theme = ref<"light" | "dark">("dark");
const promiseRunning = ref(false);

let themeObserver: MutationObserver | undefined;

// The page owns the theme, the Toaster only mirrors it.
function readTheme(): void {
  theme.value =
    document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

onMounted(() => {
  readTheme();
  themeObserver = new MutationObserver(readTheme);
  themeObserver.observe(document.documentElement, {
    attributeFilter: ["data-theme"],
  });
});

onBeforeUnmount(() => themeObserver?.disconnect());

function showSuccess(): void {
  sileo.success({
    title: "Changes saved",
    description: "Your workspace is in sync across every device.",
  });
}

function showError(): void {
  sileo.error({
    title: "Connection lost",
    description: "We could not reach the server. Retry in a moment.",
  });
}

function showWarning(): void {
  sileo.warning({
    title: "Approaching the limit",
    description: "Only a few events left on this plan.",
  });
}

function showInfo(): void {
  sileo.info({
    title: "New release",
    description: "Version 0.2.1 polishes drag to dismiss.",
  });
}

function showAction(): void {
  sileo.action({
    title: "Update available",
    description: "Reload whenever you are ready to apply it.",
    button: { title: "Reload", onClick: () => window.location.reload() },
  });
}

async function showPromise(): Promise<void> {
  if (promiseRunning.value) return;
  promiseRunning.value = true;

  try {
    await sileo.promise(
      new Promise<{ name: string }>((resolve) => {
        window.setTimeout(() => resolve({ name: "sileo-vue" }), 1800);
      }),
      {
        loading: {
          title: "Publishing package",
          description: "Building artifacts and type declarations.",
        },
        success: ({ name }) => ({
          title: "Published",
          description: `${name} is ready to install.`,
        }),
        error: { title: "Publish failed" },
      },
    );
  } finally {
    promiseRunning.value = false;
  }
}

function showStack(): void {
  const batch = [
    { title: "Build finished", type: "success" as const },
    { title: "Types generated", type: "info" as const },
    { title: "Review pending", type: "warning" as const },
    { title: "Deploy queued", type: "action" as const },
    { title: "Coverage published", type: "success" as const },
  ];

  for (const item of batch) {
    sileo.show({
      title: item.title,
      type: item.type,
      description: "Hover the stack to spread every toast apart.",
      duration: 12000,
    });
  }
}

const triggers = [
  { label: "Success", tone: "success", run: showSuccess },
  { label: "Error", tone: "error", run: showError },
  { label: "Warning", tone: "warning", run: showWarning },
  { label: "Info", tone: "info", run: showInfo },
  { label: "Action", tone: "action", run: showAction },
] as const;
</script>

<template>
  <Toaster
    :position="position"
    :theme="theme"
    :max-visible-toasts="maxVisibleToasts"
    :options="{ variant, closable, descriptionAlign, duration: 6000 }"
  />

  <div class="controls">
    <div class="control-row">
      <span class="control-label">Position</span>
      <div class="control-options">
        <button
          v-for="item in positions"
          :key="item"
          type="button"
          :data-active="position === item"
          @click="position = item"
        >
          {{ item }}
        </button>
      </div>
    </div>

    <div class="control-row">
      <span class="control-label">Variant</span>
      <div class="control-options">
        <button
          v-for="item in variants"
          :key="item"
          type="button"
          :data-active="variant === item"
          @click="variant = item"
        >
          {{ item }}
        </button>
      </div>
    </div>

    <div class="control-row">
      <span class="control-label">Align</span>
      <div class="control-options">
        <button
          v-for="item in alignments"
          :key="item"
          type="button"
          :data-active="descriptionAlign === item"
          @click="descriptionAlign = item"
        >
          {{ item }}
        </button>
      </div>
    </div>

    <div class="control-row">
      <span class="control-label">Visible</span>
      <div class="control-options">
        <button
          v-for="item in visibleCounts"
          :key="item"
          type="button"
          :data-active="maxVisibleToasts === item"
          @click="maxVisibleToasts = item"
        >
          {{ item }}
        </button>
        <button
          type="button"
          :data-active="closable"
          @click="closable = !closable"
        >
          closable
        </button>
      </div>
    </div>
  </div>

  <div class="playground-preview">
    <div class="preview-surface">
      <div class="trigger-cloud">
        <button
          v-for="item in triggers"
          :key="item.label"
          class="mock-button"
          type="button"
          :data-tone="item.tone"
          @click="item.run"
        >
          {{ item.label }}
        </button>
        <button
          class="mock-button"
          type="button"
          data-tone="promise"
          :disabled="promiseRunning"
          @click="showPromise"
        >
          {{ promiseRunning ? "Running" : "Promise" }}
        </button>
        <button
          class="mock-button mock-button--pill"
          type="button"
          data-tone="stack"
          @click="showStack"
        >
          Stack of five
        </button>
        <button
          class="mock-button mock-button--pill"
          type="button"
          @click="sileo.clear()"
        >
          Clear
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trigger-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  padding: 24px;
}

.trigger-cloud button[data-tone]::before {
  content: "";
  width: 7px;
  height: 7px;
  margin-right: 8px;
  border-radius: 50%;
  background: var(--tone, var(--accent));
}

.trigger-cloud button {
  display: inline-flex;
  align-items: center;
}

.trigger-cloud button:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
}

.trigger-cloud button:disabled {
  opacity: 0.55;
  cursor: progress;
}

[data-tone="success"] {
  --tone: oklch(0.723 0.219 142.136);
}
[data-tone="error"] {
  --tone: oklch(0.637 0.237 25.331);
}
[data-tone="warning"] {
  --tone: oklch(0.795 0.184 86.047);
}
[data-tone="info"] {
  --tone: oklch(0.685 0.169 237.323);
}
[data-tone="action"] {
  --tone: oklch(0.623 0.214 259.815);
}
[data-tone="promise"] {
  --tone: oklch(0.556 0 0);
}
[data-tone="stack"] {
  --tone: var(--accent);
}
</style>
