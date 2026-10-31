// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Writes artifacts/e2e/report.md from the result files the specs leave in
// artifacts/e2e/results. One short table per check, then
// every mismatch in full.
import { spawnSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  AppRow,
  EmptyRow,
  Flag,
  KeyboardStressRow,
  LabelRow,
} from "./stress-support";
import { ARTIFACTS, REPO, RESULTS, readResult } from "./support";
import type { CommandRun } from "./support";

interface SchemaResult {
  ajv: string;
  rows: { file: string; schema: string; valid: boolean; errors: string[] }[];
}

interface ShadcnResult {
  chatPage?: {
    url: string;
    serverRendered: boolean;
    landmarks: string[];
    heading: string;
    errors: string[];
  } | null;
  note: string;
  steps: CommandRun[];
  tempFolder: string;
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
      "## 2. A new app installs every item and the sample data, then type checks and builds",
      MISSING,
    ];
  }

  return [
    "## 2. A new app installs every item and the sample data, then type checks and builds",
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
    "### The chat-app page",
    shadcn.chatPage
      ? `next start served \`${shadcn.chatPage.url}\`. Shell in the server HTML: ${shadcn.chatPage.serverRendered ? "yes" : "no"}. Heading: ${shadcn.chatPage.heading || "none"}. Landmarks: ${shadcn.chatPage.landmarks.join(", ") || "none"}. Console errors: ${shadcn.chatPage.errors.join("; ") || "none"}.`
      : "Not checked, because a step before it failed.",
  ];
};

const checkThree = (keyboard: SpecResult[], sizes: SpecResult[]) => [
  "## 3. Keyboard and sizes in the playground",
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

const flagText = (flags: Flag[]) =>
  flags.map((flag) => `${flag.kind}: ${flag.detail}`).join("; ");

const flagged = <T extends { flags: Flag[] }>(rows: T[]) =>
  rows.filter((row) => row.flags.length > 0);

interface StressResults {
  app: AppRow[];
  keyboard: KeyboardStressRow[];
  labels: LabelRow[];
  empty: EmptyRow[];
}

const stressApp = (app: AppRow[]) => [
  "### The demo app in every design at 320 and 1440 wide",
  "The playground's home page, with the composer in work mode and in chat mode, inspected in light. A flag is sideways page scroll, a box wider than the window, text cut off with no ellipsis, text over other text, a control pushed out of view, or an empty field too narrow for its placeholder. Content inside a box that scrolls sideways, such as the tab strip, counts as reachable. Images are light on the left and dark on the right, in `stress/app/`: the base design in both modes and the other designs in work mode.",
  table(
    ["Design", "Mode", "Width", "Flags", "Errors", "Image"],
    app.map((row) => [
      row.design,
      row.mode,
      row.width,
      flagText(row.flags) || "none",
      row.errors.join("; ") || "none",
      row.image ?? "not kept",
    ])
  ),
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
      escape.opened && escape.closed && escape.focusAsExpected
        ? []
        : [
            `${escape.kind} on ${escape.stop}: ${escape.closed ? "closed" : "stayed open"}, focus went to a ${placeOf(escape.focusAfter)} instead of ${escape.expectedFocus}`,
          ]
    )
  );

const stressKeyboard = (keyboard: KeyboardStressRow[]) => [
  "### Keyboard only, the demo app",
  "Tab from the top of the page to the end, then Shift+Tab back, with no mouse events. Each stop is checked for a visible change against its resting look, and for a focus ring cut off by a box that clips its overflow. Every menu trigger and tooltip in the app is opened, closed with Escape, and checked for focus back on its trigger. A list that a text field drives, such as the composer's add menu, keeps focus in that field, as spec/functional.md says. The full focus order of each walk is in `results/stress-keyboard.json`.",
  table(
    [
      "Page",
      "Stops",
      "Walk ended",
      "Trap",
      "No visible focus",
      "Focus ring cut off",
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
      row.cutRings.length === 0 ? "none" : grouped(row.cutRings),
      row.unreachable.length === 0 ? "none" : grouped(row.unreachable),
      row.reverseMatches ? "yes" : `no: ${row.reverseDifference}`,
      escapeText(row) || "none",
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
    stress.app.filter((row) => row.flags.length > 0 || row.errors.length > 0)
      .length +
    flagged(stress.labels).length +
    stress.empty.filter((row) => row.broken).length +
    stress.keyboard.filter(
      (row) =>
        row.trap !== null ||
        row.noIndicator.length > 0 ||
        row.cutRings.length > 0 ||
        row.unreachable.length > 0 ||
        !row.reverseMatches ||
        escapeText(row) !== ""
    ).length;

  return [
    "## 4. Stress",
    `Listed, not gated. ${breaks} row${breaks === 1 ? "" : "s"} below still show a flag or a break.`,
    ...stressApp(stress.app),
    ...stressKeyboard(stress.keyboard),
    ...stressLabels(stress.labels),
    ...stressEmpty(stress.empty),
  ];
};

const mismatchList = (keyboard: SpecResult[], sizes: SpecResult[]) => {
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
  const schema = readResult<SchemaResult>("registry-schema");
  const shadcn = readResult<ShadcnResult>("shadcn-add");
  const keyboard = readResult<SpecResult[]>("keyboard") ?? [];
  const sizes = readResult<SpecResult[]>("sizes") ?? [];

  const stress: StressResults = {
    app: readResult<AppRow[]>("stress-app") ?? [],
    empty: readResult<EmptyRow[]>("stress-empty") ?? [],
    keyboard: readResult<KeyboardStressRow[]>("stress-keyboard") ?? [],
    labels: readResult<LabelRow[]>("stress-labels") ?? [],
  };

  const report = [
    "<!-- SPDX-FileCopyrightText: 2026 Bjørn Aagaard -->",
    "<!-- SPDX-License-Identifier: MIT -->",
    "",
    "# E2E report",
    `Written by \`bun run e2e\` on ${new Date().toISOString().slice(0, 10)}. It runs against the playground's dev server and the registry in \`packages/composerkit/public/r\`. Raw results, including the rows that pass, are in \`results/\`.`,
    ...checkOne(schema),
    ...checkTwo(shadcn),
    ...checkThree(keyboard, sizes),
    ...stressSection(stress),
    ...mismatchList(keyboard, sizes),
  ].join("\n\n");

  const file = path.join(ARTIFACTS, "report.md");

  writeFileSync(file, `${report}\n`);
  // The repo's formatter lines up the tables and lays out the result
  // files, so the committed report and results pass ultracite check like
  // every other file.
  spawnSync(
    path.join(REPO, "node_modules/.bin/oxfmt"),
    [file, ...readdirSync(RESULTS).map((result) => path.join(RESULTS, result))],
    { cwd: REPO }
  );
};
