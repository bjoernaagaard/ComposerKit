// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import path from "node:path";

import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

// A static export, as in Fumadocs' next-static example. The library and the
// token file live outside this app, so Turbopack's root is the repo. Like
// shadcn's docs, the type check runs separately (npm run typecheck).
// GitHub Pages serves the site under /ComposerKit, so the Pages workflow sets
// NEXT_PUBLIC_BASE_PATH. Local builds and the E2E leave it unset and serve
// the site at the root. The Pages build also writes each page as
// <page>/index.html. The export puts a <page>/ folder of prefetch files next
// to <page>.html, and Pages can resolve /menu to that folder, which has no
// page. With the page inside the folder, both /menu and /menu/ load it.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const config = {
  basePath,
  output: "export",
  reactStrictMode: true,
  trailingSlash: basePath !== "",
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withMDX(config);
