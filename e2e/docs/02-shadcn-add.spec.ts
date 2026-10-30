// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Check 2: a new app, made in a temp folder outside the repo, installs every
// item and the sample data from a local copy of the docs export. Then every
// example on the item pages is copied the way a reader copies it, with
// the Code tab's Copy button, into the app, and the app type checks and
// builds. The chat-app item's page, app/chat/page.tsx, is then served with
// next start and opened in a browser: the server HTML already holds the
// shell, and the page hydrates with no errors. The temp folder is removed
// when the test ends, whether it passed, failed, or timed out.
// registry.json points dependencies at the published site, so the copy has
// that prefix replaced with the local server's URL. The repo's export is
// not changed.
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

import {
  DOCS_APP,
  DOCS_URL,
  EXPORT_DIR,
  CONSUMER_PORT,
  CONSUMER_URL,
  ITEMS,
  LOCAL_REGISTRY_PORT,
  PUBLISHED_REGISTRY,
  openPage,
  run,
  serve,
  serveNextApp,
  writeResult,
} from "./support";
import type { CommandRun, CopiedExample } from "./support";

const LOCAL_REGISTRY = `http://127.0.0.1:${LOCAL_REGISTRY_PORT}/r/`;

const SAMPLE_DATA = "sample-data";

// Where the copied examples go in the new app.
const EXAMPLES_DIR = "components/examples";

// The same header the docs leave out of the Code tab.
const LICENSE_HEADER = /^(?:\/\/ SPDX-[^\n]*\n)+\n?/u;

const CHAT_PAGE = "/chat";

const EXAMPLE_TITLE = /^examples\/[\w-]+\.tsx$/u;

// A Code tab's title in a built page's HTML, where the page carries the
// code for every example, shown or not.
const CODE_TAB_TITLE = /title\\?"\s*:\s*\\?"examples\/(?<file>[\w-]+\.tsx)/gu;

// The example files a reader can copy from each item page,
// read from the static export, so the expected set follows the pages.
const examplesOnPages = () =>
  ITEMS.map((item) => {
    const html = readFileSync(path.join(EXPORT_DIR, `${item}.html`), "utf-8");

    return {
      files: [
        ...new Set(
          [...html.matchAll(CODE_TAB_TITLE)].map(
            (match) => match.groups?.file ?? ""
          )
        ),
      ],
      page: `/${item}`,
    };
  });

// Renders composer, conversation, button, menu and tip. The registry files
// use hooks and have no "use client", so the page is a client component.
const PAGE = `"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Composer } from "@/components/composer/composer";
import { initialComposer } from "@/components/composer/machine";
import type { ComposerOptions } from "@/components/composer/options";
import { useComposerController } from "@/components/composer/use-composer-controller";
import { ConversationView } from "@/components/conversation/conversation-view";
import { toBlocks } from "@/components/conversation/types";
import type { Turn } from "@/components/conversation/types";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu";
import { Tip } from "@/components/ui/tip";

const OPTIONS: ComposerOptions = {
  efforts: [{ id: "quick", label: "Quick" }],
  models: [{ id: "small", label: "Small model" }],
  permissions: [{ id: "ask", label: "Ask first" }],
};

const PROJECTS = [{ id: "home", name: "Home" }];

const TURNS: Turn[] = [
  {
    attachments: [],
    blocks: toBlocks([{ kind: "paragraph", text: "Hello" }]),
    id: "t1",
    role: "user",
  },
  {
    attachments: [],
    blocks: toBlocks([{ kind: "paragraph", text: "Hi. What can I do?" }]),
    id: "t2",
    role: "assistant",
  },
];

export default function Page() {
  const composer = useComposerController(() => null, initialComposer(OPTIONS));
  const [effort, setEffort] = useState("quick");

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex gap-2">
        <Button>Start a new chat</Button>
        <IconButton icon={PlusIcon} label="Attach files" />
        <Tip label="A tip">
          <Button variant="outline">Hover me</Button>
        </Tip>
        <MenuRoot>
          <MenuTrigger render={<Button variant="outline">Menu</Button>} />
          <MenuContent label="Effort">
            <MenuRadioGroup onValueChange={setEffort} value={effort}>
              <MenuRadioItem label="Quick" value="quick" />
            </MenuRadioGroup>
            <MenuItem label="Pin chat" />
          </MenuContent>
        </MenuRoot>
      </div>
      <Composer
        dispatch={composer.dispatch}
        handlers={composer.handlers}
        mode="work"
        options={OPTIONS}
        projects={PROJECTS}
        state={composer.state}
      />
      <div className="h-96">
        <ConversationView
          options={OPTIONS}
          projects={PROJECTS}
          reply={() => [{ kind: "paragraph", text: "Done." }]}
          turns={TURNS}
        />
      </div>
    </main>
  );
}
`;

// Opens one example's Code tab and copies it with the docs' Copy button.
const copyFromTab = async (page: Page, name: string) => {
  const preview = page
    .locator('[role="tablist"]')
    .locator("..")
    .filter({ has: page.locator(`[data-example="${name}"]`) });

  const tab = preview.getByRole("tab", { name: /code/iu });
  const tabLabel = (await tab.textContent()) ?? "";

  await tab.click();

  const figure = page
    .locator("figure")
    .filter({ has: page.getByRole("region", { name: `Code for ${name}` }) });

  const title = (await figure.getByText(EXAMPLE_TITLE).textContent()) ?? "";

  await figure.getByRole("button", { name: "Copy Text" }).click();
  await figure.getByRole("button", { name: "Copied Text" }).waitFor();

  const text = await page.evaluate(() => navigator.clipboard.readText());

  return { file: path.basename(title), tabLabel, text };
};

const copyExamples = async (
  browser: Browser,
  app: string
): Promise<CopiedExample[]> => {
  const context = await browser.newContext();

  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: DOCS_URL,
  });

  const page = await context.newPage();
  const copied: CopiedExample[] = [];

  mkdirSync(path.join(app, EXAMPLES_DIR), { recursive: true });

  for (const item of ITEMS) {
    // oxlint-disable-next-line no-await-in-loop -- one page at a time
    await openPage(page, `${DOCS_URL}/${item}`, "light");

    // Read first: a clicked Code tab takes its preview off the page.
    // oxlint-disable-next-line no-await-in-loop -- reads this page's examples
    const names = await page
      .locator('[data-slot="preview"] [data-example]')
      .evaluateAll((elements) =>
        elements.map((element) => element.dataset.example ?? "")
      );

    for (const name of names) {
      // oxlint-disable-next-line no-await-in-loop -- one Code tab at a time
      const { file, tabLabel, text } = await copyFromTab(page, name);

      if (!copied.some((entry) => entry.file === file)) {
        const repoFile = readFileSync(
          path.join(DOCS_APP, "examples", file),
          "utf-8"
        );

        writeFileSync(path.join(app, EXAMPLES_DIR, file), text);
        copied.push({
          characters: text.length,
          example: name,
          file,
          matchesRepoFile:
            text.trimEnd() === repoFile.replace(LICENSE_HEADER, "").trimEnd(),
          page: `/${item}`,
          tab: tabLabel,
        });
      }
    }
  }

  await context.close();

  return copied;
};

export interface ChatPageCheck {
  url: string;
  serverRendered: boolean;
  landmarks: string[];
  heading: string;
  errors: string[];
}

const checkChatPage = async (browser: Browser): Promise<ChatPageCheck> => {
  const url = `${CONSUMER_URL}${CHAT_PAGE}`;
  const response = await fetch(url);
  const html = await response.text();
  const page = await browser.newPage();
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  await page.goto(url);
  await page.waitForLoadState("networkidle");

  const heading = page.getByRole("heading", { level: 1 });

  await heading.waitFor();

  const landmarks = await Promise.all(
    (
      [
        ["banner", page.getByRole("banner")],
        ["navigation Main", page.getByRole("navigation", { name: "Main" })],
        [
          "complementary Sidebar",
          page.getByRole("complementary", { name: "Sidebar" }),
        ],
        ["navigation Chats", page.getByRole("navigation", { name: "Chats" })],
        ["main", page.getByRole("main")],
      ] as const
    ).map(async ([name, landmark]) =>
      (await landmark.count()) === 1 ? name : ""
    )
  );

  const check = {
    errors,
    heading: (await heading.textContent()) ?? "",
    landmarks: landmarks.filter(Boolean),
    serverRendered: html.includes('data-slot="app-shell"'),
    url,
  };

  await page.close();

  return check;
};

// Imports every copied example, so next build compiles each one.
const examplesPage = (files: string[]) =>
  [
    '"use client";',
    "",
    ...files.map(
      (file, index) =>
        `import * as example${index} from "@/${EXAMPLES_DIR}/${file.replace(".tsx", "")}";`
    ),
    "",
    "const EXAMPLES = [",
    ...files.map((file, index) => `  ["${file}", example${index}],`),
    "] as const;",
    "",
    "export default function Page() {",
    "  return (",
    "    <ul>",
    "      {EXAMPLES.map(([file, exports]) => (",
    '        <li key={file}>{file}: {Object.keys(exports).join(", ")}</li>',
    "      ))}",
    "    </ul>",
    "  );",
    "}",
    "",
  ].join("\n");

// The temp folder of the running test, removed after it in afterEach,
// which Playwright runs even when the test fails or times out.
let root = "";

test.afterEach(async () => {
  if (root) {
    await rm(root, { force: true, recursive: true });
    root = "";
  }
});

test("a new shadcn app installs every item and builds", async ({ browser }) => {
  test.setTimeout(30 * 60_000);

  root = mkdtempSync(path.join(tmpdir(), "composerkit-e2e-"));
  const site = path.join(root, "site");
  const app = path.join(root, "consumer");

  cpSync(EXPORT_DIR, site, { recursive: true });

  const rewritten: string[] = [];

  for (const file of readdirSync(path.join(site, "r"))) {
    const target = path.join(site, "r", file);
    const content = readFileSync(target, "utf-8");

    if (content.includes(PUBLISHED_REGISTRY)) {
      writeFileSync(
        target,
        content.replaceAll(PUBLISHED_REGISTRY, LOCAL_REGISTRY)
      );
      rewritten.push(`r/${file}`);
    }
  }

  const stop = await serve(site, LOCAL_REGISTRY_PORT);
  const steps: CommandRun[] = [];
  let copied: CopiedExample[] = [];
  let chatPage: ChatPageCheck | null = null;

  try {
    steps.push(
      await run(
        "npx",
        [
          "-y",
          "shadcn@latest",
          "init",
          "-d",
          "-y",
          "-n",
          "consumer",
          "--no-monorepo",
        ],
        root
      )
    );

    for (const item of ITEMS) {
      const url = `${LOCAL_REGISTRY}${item}.json`;

      // oxlint-disable-next-line no-await-in-loop -- each add builds on the one before
      const added = await run(
        "npx",
        ["-y", "shadcn@latest", "add", url, "-y", "-o"],
        app
      );

      steps.push(added);
    }

    steps.push(
      await run(
        "npx",
        [
          "-y",
          "shadcn@latest",
          "add",
          `${LOCAL_REGISTRY}${SAMPLE_DATA}.json`,
          "-y",
          "-o",
        ],
        app
      )
    );

    copied = await copyExamples(browser, app);

    writeFileSync(path.join(app, "app/page.tsx"), PAGE);
    mkdirSync(path.join(app, "app/examples"), { recursive: true });
    writeFileSync(
      path.join(app, "app/examples/page.tsx"),
      examplesPage(copied.map((entry) => entry.file))
    );
    steps.push(
      await run("npx", ["tsc", "--noEmit"], app),
      await run("npx", ["next", "build"], app)
    );

    if (steps.every((step) => step.exitCode === 0)) {
      const stopApp = await serveNextApp(app, CONSUMER_PORT);

      try {
        chatPage = await checkChatPage(browser);
      } finally {
        stopApp();
      }
    }
  } finally {
    stop();
  }

  const onPages = examplesOnPages();

  const expected = [...new Set(onPages.flatMap((entry) => entry.files))];

  const copiedFiles = copied.map((entry) => entry.file);
  const missing = expected.filter((file) => !copiedFiles.includes(file));
  const extra = copiedFiles.filter((file) => !expected.includes(file));

  writeResult("shadcn-add", {
    chatPage,
    copied,
    expected: onPages,
    extra,
    localRegistry: LOCAL_REGISTRY,
    missing,
    note: `The export was copied to ${site}. In that copy only, ${PUBLISHED_REGISTRY} was replaced with ${LOCAL_REGISTRY} in ${rewritten.join(", ")}, so registry dependencies also come from the local server. The temp folder is removed when the test ends.`,
    rewritten,
    steps,
    tempFolder: root,
  });

  expect(steps.map((step) => [step.command, step.exitCode])).toEqual(
    steps.map((step) => [step.command, 0])
  );
  expect(
    copied.map((entry) => [entry.file, entry.tab, entry.matchesRepoFile])
  ).toEqual(copied.map((entry) => [entry.file, "Code", true]));
  // Every item page shows at least one example, so an empty set means the
  // pages could not be read, not that there is nothing to copy.
  expect(
    onPages
      .filter((entry) => entry.files.length === 0)
      .map((entry) => entry.page)
  ).toEqual([]);
  expect({ extra, missing }).toEqual({ extra: [], missing: [] });
  expect(chatPage).toMatchObject({
    errors: [],
    heading: "Start with a task",
    serverRendered: true,
  });
  expect(chatPage?.landmarks).toHaveLength(5);
});
