// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import Link from "next/link";

import { COMPOSER_STATE_NAMES, EXAMPLES } from "../examples/registry";
import { source } from "../lib/source";

// The sample-data page, read from the registry and the docs content when
// the site is built, so it never lists a file or a page by hand.

const ROOT = path.resolve(process.cwd(), "../..");
const REGISTRY = path.join(ROOT, "packages/composerkit/registry.json");
const CONTENT = path.join(process.cwd(), "content/docs");
const EXAMPLES_DIR = path.join(process.cwd(), "examples");
const ITEM = "sample-data";
const PREVIEW_NAME = /<ComponentPreview\s+name="(?<name>[^"]+)"/gu;
const STATE_PREVIEWS = "<ComposerStatePreviews";
const SOURCE_EXTENSION = /\.tsx?$/u;

interface RegistryFile {
  path: string;
  target?: string;
}

interface RegistryItem {
  name: string;
  files?: RegistryFile[];
  registryDependencies?: string[];
}

const sampleData = async (): Promise<RegistryItem> => {
  // SAFETY: registry.json follows shadcn's registry schema, which the E2E
  // validates, so items have a name and files with a path.
  const registry = JSON.parse(await readFile(REGISTRY, "utf-8")) as {
    items: RegistryItem[];
  };

  const item = registry.items.find((entry) => entry.name === ITEM);

  if (!item) {
    throw new Error(`registry.json has no item named ${ITEM}`);
  }

  return item;
};

// How an example imports an installed file: @/ and its target, without
// the extension.
const importPath = (file: RegistryFile) =>
  `@/${(file.target ?? file.path).replace(SOURCE_EXTENSION, "")}`;

const itemName = (url: string) => path.basename(url, ".json");

export const SampleDataFiles = async () => {
  const item = await sampleData();
  const needs = (item.registryDependencies ?? []).map(itemName);

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>File in the registry</th>
            <th>Installs to</th>
            <th>Examples import it as</th>
          </tr>
        </thead>
        <tbody>
          {(item.files ?? []).map((file) => (
            <tr key={file.path}>
              <td>
                <code>{file.path}</code>
              </td>
              <td>
                <code>{file.target ?? file.path}</code>
              </td>
              <td>
                <code>{importPath(file)}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        It also installs{" "}
        {needs.map((name, index) => (
          <span key={name}>
            {index > 0 ? " and " : null}
            <Link href={`/${name}`}>
              {source.getPage([name])?.data.title ?? name}
            </Link>
          </span>
        ))}
        , whose types the data uses.
      </p>
    </>
  );
};

// The example names a page shows: its ComponentPreview tags, and every
// composer state when it shows them all.
const examplesOn = (mdx: string) => [
  ...[...mdx.matchAll(PREVIEW_NAME)].map((match) => match.groups?.name ?? ""),
  ...(mdx.includes(STATE_PREVIEWS) ? COMPOSER_STATE_NAMES : []),
];

export const SampleDataPages = async () => {
  const item = await sampleData();
  const imports = (item.files ?? []).map(importPath);
  const pages = await readdir(CONTENT);

  const rows = await Promise.all(
    pages
      .filter((file) => file.endsWith(".mdx"))
      .map(async (file) => {
        const slug = path.basename(file, ".mdx");
        const mdx = await readFile(path.join(CONTENT, file), "utf-8");

        const files = [
          ...new Set(
            examplesOn(mdx).flatMap((name) => {
              const example = EXAMPLES.get(name);

              return example ? [example.file] : [];
            })
          ),
        ];

        const using = await Promise.all(
          files.map(async (exampleFile) => {
            const code = await readFile(
              path.join(EXAMPLES_DIR, exampleFile),
              "utf-8"
            );

            return imports.some((specifier) => code.includes(`"${specifier}"`))
              ? [exampleFile]
              : [];
          })
        );

        return { files: using.flat(), page: source.getPage([slug]) };
      })
  );

  return (
    <ul>
      {rows
        .filter((row) => row.files.length > 0 && row.page)
        .map(({ files, page }) => (
          <li key={page?.url}>
            <Link href={page?.url ?? "/"}>{page?.data.title}</Link>:{" "}
            {files.map((file, index) => (
              <span key={file}>
                {index > 0 ? ", " : null}
                <code>examples/{file}</code>
              </span>
            ))}
          </li>
        ))}
    </ul>
  );
};
