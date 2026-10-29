// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import path from "node:path";

import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

// A static export, as in Fumadocs' next-static example. The library and the
// token file live outside this app, so Turbopack's root is the repo. Like
// shadcn's docs, the type check runs separately (npm run typecheck).
/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withMDX(config);
