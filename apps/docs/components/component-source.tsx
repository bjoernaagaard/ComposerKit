// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { readFile } from "node:fs/promises";
import path from "node:path";

import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";

const LICENSE_HEADER = /^(?:\/\/ SPDX-[^\n]*\n)+\n?/u;

const EXAMPLES_DIR = path.join(process.cwd(), "examples");

// Reads an example file at build time and highlights it, as shadcn's
// ComponentSource does. The license header is left out of what readers copy.
export const ComponentSource = async ({ file }: { file: string }) => {
  const code = await readFile(path.join(EXAMPLES_DIR, file), "utf-8");

  return (
    <ServerCodeBlock
      code={code.replace(LICENSE_HEADER, "").trimEnd()}
      codeblock={{ title: `examples/${file}` }}
      lang="tsx"
    />
  );
};
