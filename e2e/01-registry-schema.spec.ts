// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Check 1: every file in packages/composerkit/public/r validates against the
// shadcn schemas published at ui.shadcn.com, fetched now. An unreachable
// schema fails the check. Every "@/" import in an item's files must also come
// with the item or with an item it depends on, so an app that adds the item
// can build it.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import draft07 from "ajv/dist/refs/json-schema-draft-07.json" with { type: "json" };

import { REGISTRY_DIR, REPO, writeResult } from "./support";

const REGISTRY_SCHEMA = "https://ui.shadcn.com/schema/registry.json";
const ITEM_SCHEMA = "https://ui.shadcn.com/schema/registry-item.json";

// The shadcn schemas name draft-07 by its https URL. Ajv ships the same
// meta-schema under the http URL, so it is registered under both.
const DRAFT_07_HTTPS = "https://json-schema.org/draft-07/schema#";

const SOURCE_REGISTRY = path.join(REPO, "packages/composerkit/registry.json");
const LIBRARY = path.join(REPO, "packages/composerkit");
const ALIAS_IMPORT = /(?:from|import)\s+"@\/(?<spec>[^"]+)"/gu;
const MODULE_EXTENSIONS = [".ts", ".tsx"];

interface SourceItem {
  name: string;
  files?: { path: string }[];
  registryDependencies?: string[];
}

// shadcn's own utils item installs lib/utils.ts. Every other dependency is
// one of this registry's items, named by its published URL.
const SHADCN_ITEMS = new Map([["utils", ["src/lib/utils.ts"]]]);

const onDisk = (module: string) =>
  MODULE_EXTENSIONS.some((extension) =>
    existsSync(path.join(LIBRARY, `${module}${extension}`))
  );

const itemName = (dependency: string) => path.basename(dependency, ".json");

const fetchSchema = async (url: string): Promise<object> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }

  return response.json();
};

test("every public/r file matches the published shadcn schema", async () => {
  const [registrySchema, itemSchema] = await Promise.all([
    fetchSchema(REGISTRY_SCHEMA),
    fetchSchema(ITEM_SCHEMA),
  ]);

  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  ajv.addMetaSchema({ ...draft07, $id: DRAFT_07_HTTPS });
  ajv.addSchema(itemSchema, ITEM_SCHEMA);
  ajv.addSchema(registrySchema, REGISTRY_SCHEMA);

  const rows = readdirSync(REGISTRY_DIR)
    .filter((file) => file.endsWith(".json"))
    .toSorted()
    .map((file) => {
      const schema = file === "registry.json" ? REGISTRY_SCHEMA : ITEM_SCHEMA;

      const data: unknown = JSON.parse(
        readFileSync(path.join(REGISTRY_DIR, file), "utf-8")
      );

      const valid = ajv.validate(schema, data);

      return {
        errors: valid
          ? []
          : (ajv.errors ?? []).map((error) => ajv.errorsText([error])),
        file: `packages/composerkit/public/r/${file}`,
        schema,
        valid,
      };
    });

  writeResult("registry-schema", {
    ajv: "ajv 8 (draft-07), strict mode, allErrors, ajv-formats",
    rows,
  });

  // One file per item in the source registry, plus registry.json itself.
  const source: { items: unknown[] } = JSON.parse(
    readFileSync(path.join(REPO, "packages/composerkit/registry.json"), "utf-8")
  );

  expect(rows.length).toBe(source.items.length + 1);
  expect(rows.filter((row) => !row.valid)).toEqual([]);
});

test("every @/ import in an item comes with the item or an item it depends on", () => {
  const { items }: { items: SourceItem[] } = JSON.parse(
    readFileSync(SOURCE_REGISTRY, "utf-8")
  );

  const byName = new Map(items.map((item) => [item.name, item]));

  const installed = (name: string, seen = new Set<string>()): string[] => {
    const shadcn = SHADCN_ITEMS.get(name);

    if (shadcn) {
      return shadcn;
    }

    const item = byName.get(name);

    if (!item || seen.has(name)) {
      return [];
    }

    seen.add(name);

    return [
      ...(item.files ?? []).map((file) => file.path),
      ...(item.registryDependencies ?? []).flatMap((dependency) =>
        installed(itemName(dependency), seen)
      ),
    ];
  };

  const unresolved = items.flatMap((item) => {
    const files = new Set(installed(item.name));

    const shipped = (module: string) =>
      files.has(module) ||
      MODULE_EXTENSIONS.some((extension) => files.has(`${module}${extension}`));

    return (item.files ?? []).flatMap((file) =>
      [
        ...readFileSync(path.join(LIBRARY, file.path), "utf-8").matchAll(
          ALIAS_IMPORT
        ),
      ].flatMap((match) => {
        const module = `src/${match.groups?.spec ?? ""}`;

        if (shipped(module)) {
          return [];
        }

        return [
          `${item.name}: ${file.path} imports ${module}${onDisk(module) ? "" : " (no such file)"}`,
        ];
      })
    );
  });

  expect(unresolved).toEqual([]);
});
