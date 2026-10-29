// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { loader } from "fumadocs-core/source";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { applyMdxPreset } from "fumadocs-mdx/config";
import { defineDocs } from "fumadocs-mdx/macro";

import { CODE_THEMES } from "./code-themes";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    mdxOptions: applyMdxPreset({ rehypeCodeOptions: { themes: CODE_THEMES } }),
    schema: pageSchema,
  },
  meta: { schema: metaSchema },
});

export const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
});
