import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);

const exportedFiles = [
  packageJson.exports["."].types,
  packageJson.exports["."].import,
  packageJson.exports["."].require,
  packageJson.exports["./styles.css"],
];

await Promise.all(
  exportedFiles.map((file) => access(resolve(root, file.replace(/^\.\//, "")))),
);

if (packageJson.peerDependencies.vue !== ">=3.5.0 <4") {
  throw new Error("Vue must remain a peer dependency compatible with Vue 3.5.");
}

if (packageJson.peerDependencies.react || packageJson.dependencies?.react) {
  throw new Error("The Vue package must not expose a React dependency.");
}

if (packageJson.name !== "@danixts/sileo-vue") {
  throw new Error("The package scope must match danixts/sileo-vue.");
}

const styles = await readFile(resolve(root, "dist/styles.css"), "utf8");
const moduleSource = await readFile(resolve(root, "dist/index.js"), "utf8");

if (styles.includes(":root")) {
  throw new Error("Library styles must not define global :root variables.");
}

if (!styles.includes("data-v-") || !styles.includes("data-variant")) {
  throw new Error("Library styles must remain scoped and include variants.");
}

if (/\[data-sileo-toast\][^{]*:hover[^}]*opacity\s*:/s.test(styles)) {
  throw new Error("Hover styles must not change toast text opacity.");
}

if (
  styles.includes("backdrop-filter") ||
  moduleSource.includes("sileo-glass")
) {
  throw new Error("The removed glass effect must not remain in the package.");
}

if (!moduleSource.includes("sileo-gradient-")) {
  throw new Error("The gradient variant must include its SVG definition.");
}

for (const state of [
  "success",
  "loading",
  "error",
  "warning",
  "info",
  "action",
]) {
  if (!styles.includes(`--sileo-gradient-${state}-default-from`)) {
    throw new Error(`Missing themed gradient preset for ${state}.`);
  }
}

process.stdout.write("Package exports verified.\n");
