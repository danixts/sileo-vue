<script setup lang="ts">
import {
  sileo,
  Toaster,
  type SileoPosition,
  type SileoTheme,
  type SileoVariant,
} from "@danixts/sileo-vue";
import { ref, watch } from "vue";

const position = ref<SileoPosition>("top-right");
const theme = ref<SileoTheme>("system");
const variant = ref<SileoVariant>("neutral");
const customGradient = ref(false);
const gradientFrom = ref("#7c3aed");
const gradientTo = ref("#06b6d4");
const promiseState = ref<"idle" | "running">("idle");

const positions: SileoPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

function showSuccess(): void {
  sileo.success({
    title: "Cambios guardados",
    description: "La configuración ya está sincronizada.",
  });
}

function showError(): void {
  sileo.error({
    title: "No se pudo conectar",
    description: "Revisa la red e inténtalo nuevamente.",
  });
}

function showWarning(): void {
  sileo.warning({
    title: "Límite cercano",
    description: "Quedan pocos eventos disponibles este mes.",
  });
}

function showInfo(): void {
  sileo.info({
    title: "Nueva versión",
    description: "El despliegue está disponible para revisión.",
  });
}

function showAction(): void {
  sileo.action({
    title: "Actualización disponible",
    description: "Recarga cuando quieras aplicar la nueva versión.",
    button: {
      title: "Recargar",
      onClick: () => window.location.reload(),
    },
  });
}

async function showPromise(): Promise<void> {
  if (promiseState.value === "running") return;
  promiseState.value = "running";

  try {
    await sileo.promise(
      new Promise<{ name: string }>((resolve) => {
        window.setTimeout(() => resolve({ name: "Workspace" }), 1800);
      }),
      {
        loading: {
          title: "Publicando paquete",
          description: "Preparando artefactos y declaraciones.",
        },
        success: ({ name }) => ({
          title: "Publicación completada",
          description: `${name} está listo para instalar.`,
        }),
        error: { title: "La publicación falló" },
      },
    );
  } finally {
    promiseState.value = "idle";
  }
}

function showStack(): void {
  const stack = [
    { id: "build", title: "Build completado", state: "success" as const },
    { id: "types", title: "Tipos generados", state: "info" as const },
    { id: "review", title: "Revisión pendiente", state: "warning" as const },
  ];

  for (const item of stack) {
    sileo.show({
      id: item.id,
      title: item.title,
      type: item.state,
      duration: 8000,
    });
  }
}

watch(theme, (selectedTheme) => {
  sileo.info({
    id: "theme-preview",
    title: `Tema ${selectedTheme}`,
    description:
      selectedTheme === "system"
        ? "El toast sigue la preferencia de color del sistema."
        : `El viewport está usando el tema ${selectedTheme}.`,
  });
});

watch(
  [variant, customGradient, gradientFrom, gradientTo],
  ([selectedVariant, isCustom, from, to]) => {
    sileo.success({
      id: "variant-preview",
      variant: selectedVariant,
      gradient: isCustom ? { from, to } : undefined,
      title: `Variante ${selectedVariant}`,
      description:
        selectedVariant === "gradient"
          ? isCustom
            ? `Gradiente personalizado de ${from} a ${to}.`
            : "Usando el preset success del tema actual."
          : `La superficie usa la variante ${selectedVariant}.`,
    });
  },
);
</script>

<template>
  <Toaster
    :position="position"
    :theme="theme"
    :options="{
      duration: 6000,
      autopilot: true,
      variant,
      gradient: customGradient
        ? { from: gradientFrom, to: gradientTo }
        : undefined,
    }"
  />

  <main class="workbench">
    <header class="masthead">
      <div class="masthead-copy">
        <p class="wordmark">Sileo / Vue 3</p>
        <h1>Toast lab<span aria-hidden="true">.</span></h1>
      </div>
      <div class="lab-status" aria-label="Estado del playground">
        <span class="status-signal" aria-hidden="true"><i /></span>
        <strong>Playground activo</strong>
        <code>v0.1.0</code>
      </div>
    </header>

    <section class="lab" aria-label="Controles del playground">
      <aside class="control-panel">
        <div class="panel-heading">
          <h2>Configuración</h2>
          <span><i aria-hidden="true" />Live</span>
        </div>

        <label class="field">
          <span>Posición</span>
          <select v-model="position">
            <option v-for="item in positions" :key="item" :value="item">
              {{ item }}
            </option>
          </select>
        </label>

        <fieldset class="theme-field">
          <legend>Tema</legend>
          <div class="theme-options">
            <label v-for="item in ['system', 'light', 'dark']" :key="item">
              <input
                v-model="theme"
                type="radio"
                name="sileo-theme"
                :value="item"
              />
              <span>{{ item }}</span>
            </label>
          </div>
          <small>
            Light usa una superficie clara; dark usa una superficie oscura.
            System responde a prefers-color-scheme.
          </small>
        </fieldset>

        <fieldset class="theme-field">
          <legend>Variante</legend>
          <div class="theme-options">
            <label
              v-for="item in ['neutral', 'colored', 'gradient']"
              :key="item"
            >
              <input
                v-model="variant"
                type="radio"
                name="sileo-variant"
                :value="item"
              />
              <span>{{ item }}</span>
            </label>
          </div>
          <small>
            Colored mezcla el tono del estado. Gradient permite elegir ambos
            colores.
          </small>
          <label v-if="variant === 'gradient'" class="gradient-toggle">
            <input v-model="customGradient" type="checkbox" />
            <span>Personalizar colores</span>
          </label>
          <div
            v-if="variant === 'gradient' && customGradient"
            class="gradient-colors"
          >
            <label>
              <span>Desde</span>
              <input v-model="gradientFrom" type="color" />
              <code>{{ gradientFrom }}</code>
            </label>
            <label>
              <span>Hasta</span>
              <input v-model="gradientTo" type="color" />
              <code>{{ gradientTo }}</code>
            </label>
          </div>
        </fieldset>

        <button class="clear-button" type="button" @click="sileo.clear()">
          Limpiar notificaciones
        </button>
      </aside>

      <div class="stage">
        <div class="stage-heading">
          <div>
            <p>Disparadores</p>
            <h2>Prueba cada flujo</h2>
          </div>
          <code>{{ position }}</code>
        </div>

        <div class="trigger-grid">
          <button type="button" data-tone="success" @click="showSuccess">
            <span class="trigger-signal" aria-hidden="true"><i /></span>
            <span class="trigger-copy">
              <strong>Success</strong>
              <small>Confirmación positiva</small>
            </span>
            <span class="trigger-mark" aria-hidden="true">↗</span>
          </button>
          <button type="button" data-tone="error" @click="showError">
            <span class="trigger-signal" aria-hidden="true"><i /></span>
            <span class="trigger-copy">
              <strong>Error</strong>
              <small>Fallo recuperable</small>
            </span>
            <span class="trigger-mark" aria-hidden="true">↗</span>
          </button>
          <button type="button" data-tone="warning" @click="showWarning">
            <span class="trigger-signal" aria-hidden="true"><i /></span>
            <span class="trigger-copy">
              <strong>Warning</strong>
              <small>Atención necesaria</small>
            </span>
            <span class="trigger-mark" aria-hidden="true">↗</span>
          </button>
          <button type="button" data-tone="info" @click="showInfo">
            <span class="trigger-signal" aria-hidden="true"><i /></span>
            <span class="trigger-copy">
              <strong>Info</strong>
              <small>Contexto adicional</small>
            </span>
            <span class="trigger-mark" aria-hidden="true">↗</span>
          </button>
          <button type="button" data-tone="action" @click="showAction">
            <span class="trigger-signal" aria-hidden="true"><i /></span>
            <span class="trigger-copy">
              <strong>Action</strong>
              <small>Acción disponible</small>
            </span>
            <span class="trigger-mark" aria-hidden="true">↗</span>
          </button>
          <button
            type="button"
            data-tone="promise"
            :aria-busy="promiseState === 'running'"
            :disabled="promiseState === 'running'"
            @click="showPromise"
          >
            <span class="trigger-signal" aria-hidden="true"><i /></span>
            <span class="trigger-copy">
              <strong>{{
                promiseState === "running" ? "Running" : "Promise"
              }}</strong>
              <small>Ciclo asíncrono</small>
            </span>
            <span class="trigger-mark" aria-hidden="true">↗</span>
          </button>
          <button type="button" data-tone="stack" @click="showStack">
            <span class="trigger-signal" aria-hidden="true"><i /></span>
            <span class="trigger-copy">
              <strong>Stack ×3</strong>
              <small>Agrupar notificaciones</small>
            </span>
            <span class="trigger-mark" aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </section>

    <footer class="recipe">
      <p>Receta actual</p>
      <code
        >sileo.success({ title: "Cambios guardados", position: "{{ position }}"
        })</code
      >
    </footer>
  </main>
</template>
