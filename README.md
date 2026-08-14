# Sileo Vue

Notificaciones toast animadas para Vue 3.

- [Demo](https://danixts.github.io/sileo-vue/)
- [npm](https://www.npmjs.com/package/@danixts/sileo-vue)

## Instalación

```bash
pnpm add @danixts/sileo-vue
```

También puedes usar npm:

```bash
npm install @danixts/sileo-vue
```

## Configuración

Monta un único `Toaster` cerca de la raíz de la aplicación:

```vue
<script setup lang="ts">
import { Toaster } from "@danixts/sileo-vue";
import "@danixts/sileo-vue/styles.css";
</script>

<template>
  <Toaster position="top-right" theme="system" />
  <RouterView />
</template>
```

## Uso

```ts
import { sileo } from "@danixts/sileo-vue";

sileo.success({
  title: "Cambios guardados",
  description: "La configuración está actualizada.",
});

sileo.error({
  title: "No se pudo conectar",
  description: "Inténtalo nuevamente.",
});

sileo.warning({
  title: "Límite cercano",
  description: "Quedan pocos eventos disponibles.",
});

sileo.info({
  title: "Nueva versión",
  description: "El despliegue está listo.",
});
```

### Acciones

```ts
sileo.action({
  title: "Actualización disponible",
  description: "Recarga para aplicar la nueva versión.",
  button: {
    title: "Recargar",
    onClick: () => window.location.reload(),
  },
});
```

### Identificadores

Cada llamada crea un toast nuevo y devuelve su `id` generado. Reutiliza un `id`
propio cuando quieras que la siguiente llamada reemplace al toast anterior en
lugar de apilar otro:

```ts
const id = sileo.info({ title: "Sincronizando" });
sileo.success({ id, title: "Sincronizado" });
```

También puedes cerrar uno o limpiar todos:

```ts
sileo.dismiss(id);
sileo.clear();
```

### Pila de notificaciones

Los toasts de una misma posición se agrupan: el frontal queda visible y el
resto se apila detrás. Al pasar el mouse la pila se despliega.

```vue
<Toaster :max-visible-toasts="3" />
```

`maxVisibleToasts` es `3` de forma predeterminada; los toasts que exceden ese
número se ocultan hasta que la pila avanza.

### Cierre y alineación

```ts
sileo.info({
  title: "Reporte listo",
  description: "Descarga disponible por 24 horas.",
  descriptionAlign: "center",
  closable: true,
});
```

`closable` muestra un botón de cierre al pasar el mouse o al enfocar el toast, y
es `true` de forma predeterminada. `descriptionAlign` acepta `left`, `center` y
`right`.

### Arrastre

El toast se arrastra en vertical para descartarlo. El cursor pasa a `grab` y a
`grabbing` durante el gesto, y aparece un tirador en el borde. El texto del
toast no es seleccionable para que el arrastre no seleccione contenido; la
descripción sí lo es cuando está desplegada.

### Teclado

El toast es enfocable: `Tab` lo alcanza, `Enter` o `Espacio` alternan la
descripción y `Escape` lo descarta. Los estados `error` y `warning` se anuncian
como `role="alert"`.

## Promesas

```ts
await sileo.promise(saveProfile(), {
  loading: {
    title: "Guardando",
    description: "Espera un momento.",
  },
  success: (profile) => ({
    title: `Perfil ${profile.name} guardado`,
  }),
  error: (error) => ({
    title: "No se pudo guardar",
    description: String(error),
  }),
});
```

## Opciones globales

```vue
<Toaster
  position="bottom-right"
  :z-index="1000"
  theme="system"
  :max-visible-toasts="3"
  :offset="{ bottom: 24, right: 24 }"
  :options="{
    duration: 5000,
    roundness: 14,
    autopilot: true,
    closable: true,
  }"
/>
```

Las opciones enviadas a un toast tienen prioridad sobre las opciones globales.

Para el caso común también se puede declarar el tiempo de vida directamente:

```vue
<Toaster :duration="5000" />
```

`zIndex` tiene como valor predeterminado `1000`, por encima de los modales
más comunes. Se puede ajustar si la aplicación usa una escala de capas propia.

`duration` se expresa en milisegundos; `null` deja el toast visible hasta que
se descarte. Aunque `200` es válido para una señal efímera, no se recomienda
para mensajes que el usuario deba leer: la animación física dura alrededor de
600 ms. Para éxito, advertencia o error usa normalmente entre 3000 y 6000 ms.

## Temas

`Toaster` soporta `light`, `dark` y `system`. El valor predeterminado es
`system`, que sigue `prefers-color-scheme` y reacciona a sus cambios:

```vue
<Toaster theme="system" />
```

## Teleport

El viewport se monta en `<body>` para que ningún `overflow` o `transform` del
árbol lo recorte. Puedes cambiar el destino o desactivarlo:

```vue
<Toaster teleport="#toast-root" />
<Toaster :teleport="false" />
```

## Variantes

Las variantes disponibles son `neutral`, `colored` y `gradient`:

```vue
<Toaster
  theme="system"
  :options="{
    variant: 'gradient',
  }"
/>
```

Cada estado incluye un gradiente adaptado a light y dark. Puedes personalizarlo
globalmente:

```vue
<Toaster
  theme="system"
  :options="{
    variant: 'gradient',
    gradient: {
      from: '#7c3aed',
      to: '#06b6d4',
    },
  }"
/>
```

O por toast:

```ts
sileo.error({
  title: "No se pudo conectar",
  variant: "gradient",
  gradient: {
    from: "rgba(255, 0, 110, 0.95)",
    to: "#3a86ff",
  },
});
```

También puedes usar variables CSS, incluyendo tokens generados por Tailwind CSS:

```ts
sileo.info({
  title: "Nueva versión",
  variant: "gradient",
  gradient: {
    from: "var(--color-violet-600)",
    to: "var(--color-cyan-500)",
  },
});
```

## API

- `sileo.show(options)`
- `sileo.success(options)`
- `sileo.error(options)`
- `sileo.warning(options)`
- `sileo.info(options)`
- `sileo.action(options)`
- `sileo.promise(promiseOrFactory, options)`
- `sileo.dismiss(id)`
- `sileo.clear(position?)`

## Migración desde 0.1.x

`sileo.success({ title })` sin `id` ya no reemplaza al toast anterior: cada
llamada crea uno nuevo y los toasts se apilan. Para conservar el comportamiento
previo pasa siempre el mismo `id`:

```ts
sileo.success({ id: "app-toast", title: "Guardado" });
```

## Playground

El sitio de demostración vive en [`site/`](site) y está construido con Astro.

```bash
pnpm site        # servidor de desarrollo
pnpm site:build  # build estático en site/dist
```

Publicado en <https://danixts.github.io/sileo-vue/>, junto a los otros dos
ports: [Border Beam](https://danixts.github.io/jakub-antalik/beam/) y
[Liquid Gooey](https://danixts.github.io/jakub-antalik/gooey/).

## Licencia

MIT. Adaptación independiente inspirada en
[hiaaryan/sileo](https://github.com/hiaaryan/sileo). Consulta
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
