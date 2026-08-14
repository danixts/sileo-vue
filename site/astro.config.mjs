import vue from "@astrojs/vue";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base =
  process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : "/";

export default defineConfig({
  base,
  integrations: [vue()],
  output: "static",
  vite: {
    resolve: {
      alias: [
        {
          find: /^@danixts\/sileo-vue$/,
          replacement: fileURLToPath(
            new URL("../src/index.ts", import.meta.url),
          ),
        },
      ],
    },
  },
});
