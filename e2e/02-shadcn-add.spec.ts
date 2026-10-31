// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Check 2: a new app, made in a temp folder outside the repo, installs every
// item and the sample data from a local copy of the registry, then type
// checks and builds. The chat-app item's page, app/chat/page.tsx, is then
// served with next start and opened in a browser: the server HTML already
// holds the shell, and the page hydrates with no errors. The temp folder is
// removed when the test ends, whether it passed, failed, or timed out.
// registry.json points dependencies at the published site, so the copy has
// that prefix replaced with the local server's URL. The repo's registry is
// not changed.
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Browser } from "@playwright/test";

import {
  CONSUMER_PORT,
  CONSUMER_URL,
  ITEMS,
  LOCAL_REGISTRY_PORT,
  PUBLISHED_REGISTRY,
  REGISTRY_DIR,
  run,
  serve,
  serveNextApp,
  writeResult,
} from "./support";
import type { CommandRun } from "./support";

const LOCAL_REGISTRY = `http://127.0.0.1:${LOCAL_REGISTRY_PORT}/r/`;

const SAMPLE_DATA = "sample-data";

const CHAT_PAGE = "/chat";

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

interface ChatPageCheck {
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

  cpSync(REGISTRY_DIR, path.join(site, "r"), { recursive: true });

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
  let chatPage: ChatPageCheck | null = null;

  try {
    steps.push(
      await run(
        "bunx",
        [
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
        "bunx",
        ["shadcn@latest", "add", url, "-y", "-o"],
        app
      );

      steps.push(added);
    }

    steps.push(
      await run(
        "bunx",
        [
          "shadcn@latest",
          "add",
          `${LOCAL_REGISTRY}${SAMPLE_DATA}.json`,
          "-y",
          "-o",
        ],
        app
      )
    );

    writeFileSync(path.join(app, "app/page.tsx"), PAGE);
    steps.push(
      await run("bunx", ["tsc", "--noEmit"], app),
      await run("bunx", ["next", "build"], app)
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

  writeResult("shadcn-add", {
    chatPage,
    localRegistry: LOCAL_REGISTRY,
    note: `The registry was copied to ${site}. In that copy only, ${PUBLISHED_REGISTRY} was replaced with ${LOCAL_REGISTRY} in ${rewritten.join(", ")}, so registry dependencies also come from the local server. The temp folder is removed when the test ends.`,
    rewritten,
    steps,
    tempFolder: root,
  });

  expect(steps.map((step) => [step.command, step.exitCode])).toEqual(
    steps.map((step) => [step.command, 0])
  );
  expect(chatPage).toMatchObject({
    errors: [],
    heading: "Start with a task",
    serverRendered: true,
  });
  expect(chatPage?.landmarks).toHaveLength(5);
});
