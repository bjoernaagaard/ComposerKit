// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Writes artifacts/docs-e2e/report.md from the result files the specs
// leave in artifacts/docs-e2e/results. One short table per check, then
// every mismatch in full.
import { writeFileSync } from "node:fs";
import path from "node:path";

import { ARTIFACTS, readManifest, readResult } from "./support";
import type { CommandRun } from "./support";

interface SchemaResult {
  ajv: string;
  rows: { file: string; schema: string; valid: boolean; errors: string[] }[];
}

interface ShadcnResult {
  note: string;
  steps: CommandRun[];
  tempFolder: string;
}

interface AxeResult {
  page: string;
  scheme: string;
  violations: {
    id: string;
    impact: string | null;
    help: string;
    nodes: number;
    targets: string[];
  }[];
}

interface SectionsResult {
  page: string;
  ok: boolean;
  headings: string[];
}

interface SpecResult {
  line: number;
  expected: string;
  actual: string;
  status: "pass" | "mismatch" | "not checked";
  where: string;
  keys?: string;
  context?: string;
  part?: string;
}

interface MatchResult {
  id: string;
  scheme: string;
  page: string | null;
  before: { width: number; height: number } | null;
  after: { width: number; height: number } | null;
  ratio: number | null;
}

interface LinksResult {
  broken: { file: string; line: number; url: string; reason: string }[];
  files: string[];
  urls: string[];
}

const MISSING = "No result. The spec did not run or stopped early.";

// Table cells: pipes and line breaks would break the Markdown table.
type Cell = string | number | boolean | null | undefined;

const cell = (value: Cell) =>
  String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");

const table = (header: string[], rows: Cell[][]) =>
  [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ].join("\n");

const verdict = (ok: boolean) => (ok ? "pass" : "FAIL");

const count = (rows: SpecResult[], status: SpecResult["status"]) =>
  rows.filter((row) => row.status === status).length;

const sortByLine = (rows: SpecResult[]) =>
  rows.toSorted((a, b) => a.line - b.line);

const checkOne = (schema: SchemaResult | undefined) => {
  if (!schema) {
    return ["## 1. Registry files match the published shadcn schema", MISSING];
  }

  return [
    "## 1. Registry files match the published shadcn schema",
    `Schemas fetched at run time from ui.shadcn.com. Validator: ${schema.ajv}.`,
    table(
      ["File", "Schema", "Result", "Errors"],
      schema.rows.map((row) => [
        row.file,
        row.schema,
        verdict(row.valid),
        row.errors.join("; "),
      ])
    ),
  ];
};

const checkTwo = (shadcn: ShadcnResult | undefined) => {
  if (!shadcn) {
    return [
      "## 2. A new app installs every item with shadcn add, then type checks and builds",
      MISSING,
    ];
  }

  return [
    "## 2. A new app installs every item with shadcn add, then type checks and builds",
    shadcn.note,
    table(
      ["Command", "Folder", "Exit code", "Seconds"],
      shadcn.steps.map((step) => [
        step.command,
        path.relative(shadcn.tempFolder, step.cwd) || ".",
        step.exitCode,
        step.seconds,
      ])
    ),
    `Temp folder: \`${shadcn.tempFolder}\` (outside the repo).`,
  ];
};

const checkThree = (
  axe: AxeResult[],
  sections: SectionsResult[],
  keyboard: SpecResult[],
  sizes: SpecResult[]
) => [
  "## 3. Accessibility, keyboard and sizes on the static export",
  "### axe-core, every rule axe runs by default",
  axe.length === 0
    ? MISSING
    : table(
        ["Page", "Scheme", "Violations"],
        axe.map((row) => [
          row.page,
          row.scheme,
          row.violations.length === 0
            ? "none"
            : row.violations
                .map((violation) => `${violation.id} (${violation.nodes})`)
                .join(", "),
        ])
      ),
  "### Page sections in order",
  sections.length === 0
    ? MISSING
    : table(
        ["Page", "Result", "Headings found"],
        sections.map((row) => [
          row.page,
          verdict(row.ok),
          row.headings.join(", "),
        ])
      ),
  "### Keyboard rows from spec/functional.md",
  table(
    ["Rows", "Pass", "Mismatch", "Not checkable"],
    [
      [
        keyboard.length,
        count(keyboard, "pass"),
        count(keyboard, "mismatch"),
        count(keyboard, "not checked"),
      ],
    ]
  ),
  "### Size rows from spec/functional.md (about 1 px tolerance)",
  table(
    ["Rows", "Pass", "Mismatch", "Not checkable"],
    [
      [
        sizes.length,
        count(sizes, "pass"),
        count(sizes, "mismatch"),
        count(sizes, "not checked"),
      ],
    ]
  ),
];

const dims = (box: MatchResult["before"]) =>
  box ? `${box.width} x ${box.height}` : "";

const ratio = (value: number | null) =>
  value === null ? "" : `${(value * 100).toFixed(1)}%`;

const checkFour = (matches: MatchResult[]) => {
  const manifest = readManifest();

  const found = new Set(
    matches.flatMap((row) => (row.page ? [`${row.id}--${row.scheme}`] : []))
  );

  const missing = manifest.flatMap((entry) =>
    ["light", "dark"].flatMap((scheme) =>
      found.has(`${entry.id}--${scheme}`) ? [] : [`${entry.id} (${scheme})`]
    )
  );

  return [
    "## 4. Every old catalog screenshot has a docs example",
    `Baseline: ${manifest.length} ids, light and dark, in \`catalog-before/\`. Docs screenshots in \`docs-after/\`. The ratio is the share of pixels that differ after padding both images to the same size, so a size change counts.`,
    table(
      ["Ids", "Found in light and dark", "Missing"],
      [
        [
          manifest.length,
          manifest.length -
            new Set(missing.map((entry) => entry.split(" ")[0])).size,
          missing.length === 0 ? "none" : missing.join(", "),
        ],
      ]
    ),
    matches.length === 0
      ? MISSING
      : table(
          [
            "Id",
            "Page",
            "Light before",
            "Light after",
            "Light diff",
            "Dark diff",
          ],
          manifest.map((entry) => {
            const light = matches.find(
              (row) => row.id === entry.id && row.scheme === "light"
            );

            const dark = matches.find(
              (row) => row.id === entry.id && row.scheme === "dark"
            );

            return [
              entry.id,
              light?.page ?? "missing",
              dims(light?.before ?? null),
              dims(light?.after ?? null),
              ratio(light?.ratio ?? null),
              ratio(dark?.ratio ?? null),
            ];
          })
        ),
  ];
};

const linkVerdict = (links: LinksResult | undefined) => {
  if (!links) {
    return "did not run";
  }

  return links.broken.length === 0
    ? "no broken links"
    : `${links.broken.length} broken`;
};

const checkFive = (
  build: CommandRun | undefined,
  links: LinksResult | undefined
) => [
  "## 5. next build passes and next-validate-link finds no broken links",
  table(
    ["Step", "Result", "Detail"],
    [
      [
        build?.command ?? "npm run build --workspace @composerkit/docs",
        build ? `exit ${build.exitCode}` : "did not run",
        build ? `${build.seconds} s` : "",
      ],
      [
        "next-validate-link on content/docs/*.mdx",
        linkVerdict(links),
        links
          ? `${links.files.length} files, ${links.urls.length} known URLs`
          : "",
      ],
    ]
  ),
  ...(links && links.broken.length > 0
    ? [
        table(
          ["File", "Line", "URL", "Reason"],
          links.broken.map((entry) => [
            entry.file,
            entry.line,
            entry.url,
            entry.reason,
          ])
        ),
      ]
    : []),
];

const mismatchList = (
  axe: AxeResult[],
  keyboard: SpecResult[],
  sizes: SpecResult[]
) => {
  const axeRows = axe.flatMap((row) =>
    row.violations.map((violation) => [
      row.page,
      row.scheme,
      violation.id,
      violation.impact,
      violation.help,
      violation.targets.slice(0, 3).join(", "),
    ])
  );

  const specRows = (rows: SpecResult[], status: SpecResult["status"]) =>
    sortByLine(rows.filter((row) => row.status === status)).map((row) => [
      row.line,
      row.part ?? `${row.keys}, ${row.context}`,
      row.expected,
      row.actual,
      row.where,
    ]);

  return [
    "## Every mismatch",
    "### axe violations",
    axeRows.length === 0
      ? "None."
      : table(
          ["Page", "Scheme", "Rule", "Impact", "Help", "First targets"],
          axeRows
        ),
    "### Keyboard mismatches",
    table(
      ["Spec line", "Keys and context", "Spec says", "What happened", "Where"],
      specRows(keyboard, "mismatch")
    ),
    "### Size mismatches",
    table(
      ["Spec line", "Part", "Spec says", "Measured", "Where"],
      specRows(sizes, "mismatch")
    ),
    "### Rows that could not be checked",
    table(
      ["Spec line", "Row", "Spec says", "Why not"],
      [
        ...specRows(keyboard, "not checked"),
        ...specRows(sizes, "not checked"),
      ].map((row) => row.slice(0, 4))
    ),
  ];
};

export const writeReport = (): void => {
  const build = readResult<CommandRun>("build");
  const schema = readResult<SchemaResult>("registry-schema");
  const shadcn = readResult<ShadcnResult>("shadcn-add");
  const axe = readResult<AxeResult[]>("axe") ?? [];
  const sections = readResult<SectionsResult[]>("sections") ?? [];
  const keyboard = readResult<SpecResult[]>("keyboard") ?? [];
  const sizes = readResult<SpecResult[]>("sizes") ?? [];
  const matches = readResult<MatchResult[]>("catalog-match") ?? [];
  const links = readResult<LinksResult>("links");

  const report = [
    "<!-- SPDX-FileCopyrightText: 2026 Bjørn Aagaard -->",
    "<!-- SPDX-License-Identifier: MIT -->",
    "",
    "# Docs E2E report",
    `Written by \`npm run e2e:docs\` on ${new Date().toISOString().slice(0, 10)}. It runs against the real static export of apps/docs, served from \`apps/docs/out\`. Raw results, including the rows that pass, are in \`results/\`. Page screenshots are in \`pages/\`.`,
    ...checkOne(schema),
    ...checkTwo(shadcn),
    ...checkThree(axe, sections, keyboard, sizes),
    ...checkFour(matches),
    ...checkFive(build, links),
    ...mismatchList(axe, keyboard, sizes),
  ].join("\n\n");

  writeFileSync(path.join(ARTIFACTS, "report.md"), `${report}\n`);
};
