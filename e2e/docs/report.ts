// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Writes artifacts/docs-e2e/report.md from the result files the specs
// leave in artifacts/docs-e2e/results. One short table per check, then
// every mismatch in full.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import type {
  EmptyRow,
  Flag,
  KeyboardStressRow,
  LabelRow,
  PasteRow,
  RenderRow,
} from "./stress-support";
import { ARTIFACTS, REPO, readManifest, readResult } from "./support";
import type { CommandRun, CopiedExample } from "./support";

interface SchemaResult {
  ajv: string;
  rows: { file: string; schema: string; valid: boolean; errors: string[] }[];
}

interface ShadcnResult {
  copied: CopiedExample[];
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
      "## 2. A new app installs every item and the sample data, takes every example from its Code tab, then type checks and builds",
      MISSING,
    ];
  }

  return [
    "## 2. A new app installs every item and the sample data, takes every example from its Code tab, then type checks and builds",
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
    "### Examples copied from the Code tab",
    `Every example file on the six item pages, copied with the docs' Copy button into \`components/examples/\` of the new app before tsc and next build. ${shadcn.copied.length} files. Same as the file means the copied text equals the example file minus its license header.`,
    table(
      [
        "Page",
        "First example",
        "File",
        "Tab",
        "Characters",
        "Same as the file",
      ],
      shadcn.copied.map((entry) => [
        entry.page,
        entry.example,
        entry.file,
        entry.tab,
        entry.characters,
        entry.matchesRepoFile ? "yes" : "NO",
      ])
    ),
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
  "Keyboard and size rows are listed, not gated. A mismatch does not fail the run; every one is in the list at the end. The spec describes a reference app, so each row is a finding to review, not a test that ComposerKit must pass.",
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

const flagText = (flags: Flag[]) =>
  flags.map((flag) => `${flag.kind}: ${flag.detail}`).join("; ");

const flagged = <T extends { flags: Flag[] }>(rows: T[]) =>
  rows.filter((row) => row.flags.length > 0);

interface StressResults {
  render: RenderRow[];
  keyboard: KeyboardStressRow[];
  paste: PasteRow[];
  labels: LabelRow[];
  empty: EmptyRow[];
}

const stressRender = (render: RenderRow[]) => [
  "### Every docs example at 320 and 1440 wide",
  "One image per example and width, light on the left and dark on the right, in `stress/render/`. A flag is sideways page scroll, a box wider than the window, text cut off with no ellipsis, text over other text, or a control pushed out of view. Content inside a box that scrolls sideways, such as a code block or the tab strip, counts as reachable.",
  table(
    ["Width", "Examples", "With a flag"],
    [320, 1440].map((width) => {
      const rows = render.filter((row) => row.width === width);

      return [width, rows.length, flagged(rows).length];
    })
  ),
  ...(flagged(render).length > 0
    ? [
        table(
          ["Example", "Width", "Flags", "Image"],
          flagged(render).map((row) => [
            row.id,
            row.width,
            flagText(row.flags),
            row.image,
          ])
        ),
      ]
    : []),
];

// The same finding on many examples of a page is one entry with a count.
const grouped = (items: string[]) =>
  [...Map.groupBy(items, (item) => item)]
    .map(([item, all]) =>
      all.length > 1 ? `${item} (${all.length} times)` : item
    )
    .join("; ");

// The focused element's role or tag, without its label, so the same
// field with a different placeholder counts as one place.
const placeOf = (focus: string) => focus.split(" ")[0] ?? focus;

const escapeText = (row: KeyboardStressRow) =>
  grouped(
    row.escapes.flatMap((escape) =>
      escape.opened && escape.closed && escape.backOnTrigger
        ? []
        : [
            `${escape.kind} on ${escape.stop}: ${escape.closed ? "closed" : "stayed open"}, focus went to a ${placeOf(escape.focusAfter)}`,
          ]
    )
  );

const stressKeyboard = (keyboard: KeyboardStressRow[]) => [
  "### Keyboard only, every docs page",
  "Tab from the top of the page to the end, then Shift+Tab back, with no mouse events. Each stop is checked for a visible change against its resting look. Every menu trigger and tooltip in the examples is opened, closed with Escape, and checked for focus back on its trigger. The full focus order of each page is in `results/stress-keyboard.json`.",
  table(
    [
      "Page",
      "Stops",
      "Walk ended",
      "Trap",
      "No visible focus",
      "Not reachable by Tab",
      "Shift+Tab gives the same order",
      "Escape did not return focus",
    ],
    keyboard.map((row) => [
      row.page,
      row.stops.length,
      row.end,
      row.trap ?? "none",
      row.noIndicator.length === 0 ? "none" : row.noIndicator.join("; "),
      row.unreachable.length === 0 ? "none" : grouped(row.unreachable),
      row.reverseMatches ? "yes" : `no: ${row.reverseDifference}`,
      escapeText(row) || "none",
    ])
  ),
];

const stressPaste = (paste: PasteRow[]) => [
  "### A 200 character paste into every composer, then Enter",
  "Pasted through the clipboard. Images are in `stress/paste/`.",
  table(
    ["Example", "Label", "Pasted", "After Enter", "Flags", "Images"],
    paste.map((row) => [
      row.id,
      row.label,
      row.pastedLength,
      `${row.afterSubmit}, turns ${row.turnsBefore} then ${row.turnsAfter}`,
      flagText([...row.flagsPasted, ...row.flagsSubmitted]) || "none",
      `${row.pastedImage}, ${row.submittedImage}`,
    ])
  ),
];

const stressLabels = (labels: LabelRow[]) => [
  "### 200 character labels in every part that shows one",
  "Rendered by the playground's dev-only stress page (`/states/stress`), which passes the label through each part's own props. demo is the normal label, spaces is a 200 character title with spaces, word is a 200 character link with nowhere to break. Images are in `stress/labels/`.",
  table(
    ["Part", "Label", "Width", "Flags", "Errors", "Image"],
    labels.map((row) => [
      row.part,
      row.data,
      row.width,
      flagText(row.flags) || "none",
      row.errors.join("; ") || "none",
      row.image,
    ])
  ),
];

const stressEmpty = (empty: EmptyRow[]) => [
  "### Empty states",
  "Images are in `stress/empty/`.",
  table(
    ["Part", "Attack", "Verdict", "What happened", "Image"],
    empty.map((row) => [
      row.part,
      row.attack,
      row.broken ? "BROKEN" : "held up",
      row.happened,
      row.image,
    ])
  ),
];

const stressSection = (stress: StressResults) => {
  const breaks =
    flagged(stress.render).length +
    flagged(stress.labels).length +
    stress.empty.filter((row) => row.broken).length +
    stress.keyboard.filter(
      (row) =>
        row.trap !== null ||
        row.noIndicator.length > 0 ||
        row.unreachable.length > 0 ||
        !row.reverseMatches ||
        escapeText(row) !== ""
    ).length;

  return [
    "## 6. Stress",
    `Listed, not gated. ${breaks} row${breaks === 1 ? "" : "s"} below still show a flag or a break.`,
    ...stressRender(stress.render),
    ...stressKeyboard(stress.keyboard),
    ...stressPaste(stress.paste),
    ...stressLabels(stress.labels),
    ...stressEmpty(stress.empty),
  ];
};

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

  const stress: StressResults = {
    empty: readResult<EmptyRow[]>("stress-empty") ?? [],
    keyboard: readResult<KeyboardStressRow[]>("stress-keyboard") ?? [],
    labels: readResult<LabelRow[]>("stress-labels") ?? [],
    paste: readResult<PasteRow[]>("stress-paste") ?? [],
    render: readResult<RenderRow[]>("stress-render") ?? [],
  };

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
    ...stressSection(stress),
    ...mismatchList(axe, keyboard, sizes),
  ].join("\n\n");

  const file = path.join(ARTIFACTS, "report.md");

  writeFileSync(file, `${report}\n`);
  // The repo's formatter lines up the tables, so the committed report
  // passes ultracite check like every other file.
  spawnSync(path.join(REPO, "node_modules/.bin/oxfmt"), [file], { cwd: REPO });
};
