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

Si necesitas mostrar varios toast al mismo tiempo, asigna un `id` diferente a
cada uno:

```ts
sileo.info({ id: "sync", title: "Sincronizando" });
sileo.warning({ id: "quota", title: "Límite cercano" });
```

También puedes cerrar uno o limpiar todos:

```ts
sileo.dismiss("sync");
sileo.clear();
```

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
  theme="system"
  :offset="{ bottom: 24, right: 24 }"
  :options="{
    duration: 5000,
    roundness: 14,
    autopilot: true,
  }"
/>
```

Las opciones enviadas a un toast tienen prioridad sobre las opciones globales.

## Temas

`Toaster` soporta `light`, `dark` y `system`:

```vue
<Toaster theme="system" />
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

## Licencia

MIT. Adaptación independiente inspirada en
[hiaaryan/sileo](https://github.com/hiaaryan/sileo). Consulta
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
