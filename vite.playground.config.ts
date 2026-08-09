import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/sileo-vue/" : "/",
  root: "playground",
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: "@danixts/sileo-vue/styles.css",
        replacement: fileURLToPath(
          new URL("./src/styles.css", import.meta.url),
        ),
      },
      {
        find: /^@danixts\/sileo-vue$/,
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
    ],
  },
  build: {
    outDir: "../playground-dist",
    emptyOutDir: true,
  },
});
