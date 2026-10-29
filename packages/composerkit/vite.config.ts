// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { globSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

// Builds the npm package. Each file under src/components and src/lib becomes
// its own module in dist, at the same path, so `@/components/ui/button` in
// the registry is `composerkit/components/ui/button` from npm. The demo app,
// the design directions and the sample data stay out of the package.
const SRC = fileURLToPath(new URL("src", import.meta.url));

const entries = globSync(["components/**/*.{ts,tsx}", "lib/**/*.ts"], {
  cwd: SRC,
});

const external = [
  "react",
  "react-dom",
  "@base-ui/react",
  "class-variance-authority",
  "cn",
  "lucide-react",
];

const isExternal = (id: string): boolean =>
  external.some((name) => id === name || id.startsWith(`${name}/`));

export default defineConfig({
  build: {
    copyPublicDir: false,
    emptyOutDir: true,
    lib: {
      entry: Object.fromEntries(
        entries.map((file) => [file.replace(/\.tsx?$/u, ""), `${SRC}/${file}`])
      ),
      formats: ["es"],
    },
    minify: false,
    outDir: "dist",
    rolldownOptions: {
      external: isExternal,
      output: {
        // The components use hooks, so React Server Components frameworks
        // such as Next.js must load them on the client.
        banner: '"use client";',
        entryFileNames: "[name].js",
        preserveModules: true,
        preserveModulesRoot: SRC,
      },
    },
  },
  resolve: {
    alias: { "@": SRC },
  },
});
