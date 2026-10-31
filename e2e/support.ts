// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Paths, ports and small helpers shared by the E2E specs.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const REPO = fileURLToPath(new URL("../", import.meta.url));
export const REGISTRY_DIR = path.join(REPO, "packages/composerkit/public/r");
const PLAYGROUND = path.join(REPO, "apps/playground");
export const ARTIFACTS = path.join(REPO, "artifacts/e2e");
export const RESULTS = path.join(ARTIFACTS, "results");

// Each checkout gets its own ports, picked from its path, so runs in two
// worktrees at once don't stop each other's servers.
const PORT_SLOTS = 100;
const PORT_STEP = 20;

const portSlot = [...REPO].reduce(
  (hash, character) =>
    (hash * 31 + (character.codePointAt(0) ?? 0)) % PORT_SLOTS,
  0
);

const PORT_BASE = 4320 + portSlot * PORT_STEP;

export const LOCAL_REGISTRY_PORT = PORT_BASE + 1;
export const CONSUMER_PORT = PORT_BASE + 2;
export const CONSUMER_URL = `http://127.0.0.1:${CONSUMER_PORT}`;
export const PLAYGROUND_PORT = PORT_BASE + 10;
export const PLAYGROUND_URL = `http://127.0.0.1:${PLAYGROUND_PORT}`;

export const PUBLISHED_REGISTRY =
  "https://bjoernaagaard.github.io/ComposerKit/r/";

export const ITEMS = [
  "theme",
  "button",
  "tip",
  "menu",
  "composer",
  "conversation",
  "app-shell",
  "chat-sidebar",
  "chat-app",
] as const;

export const SCHEMES = ["light", "dark"] as const;

export type Scheme = (typeof SCHEMES)[number];

// The design directions the playground's appearance menu offers besides
// base.
export const DESIGNS = ["apple", "glass", "taste", "emil"] as const;

export const writeResult = <T extends object>(name: string, data: T): void => {
  mkdirSync(RESULTS, { recursive: true });
  writeFileSync(
    path.join(RESULTS, `${name}.json`),
    `${JSON.stringify(data, null, 2)}\n`
  );
};

export const readResult = <T>(name: string): T | undefined => {
  try {
    return JSON.parse(
      readFileSync(path.join(RESULTS, `${name}.json`), "utf-8")
    );
  } catch {
    return undefined;
  }
};

// Adds one row to a result file, so rows survive a failed test restarting
// the worker.
export const appendResult = <T extends object>(name: string, row: T): void => {
  writeResult(name, [...(readResult<T[]>(name) ?? []), row]);
};

// Opens a playground page in a color scheme. The playground keeps the
// scheme in localStorage under composerkit-scheme and puts the dark class
// on <html>, which the library's tokens also key on.
export const openPage = async (page: Page, url: string, scheme: Scheme) => {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript((value) => {
    localStorage.setItem("composerkit-scheme", value);
  }, scheme);
  await page.goto(url);
  await page.waitForLoadState("networkidle");

  const dark = await page
    .locator("html")
    .evaluate((html) => html.classList.contains("dark"));

  expect(dark).toBe(scheme === "dark");
};

export interface CommandRun {
  command: string;
  cwd: string;
  exitCode: number | null;
  seconds: number;
  outputTail: string;
}

const TAIL_LINES = 15;
const MS_PER_SECOND = 1000;

// Runs a command to the end and keeps its exit code and the end of its
// output for the report.
export const run = async (
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {}
): Promise<CommandRun> => {
  const started = Date.now();

  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, CI: "1", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";

  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });

  await once(child, "close");

  return {
    command: [command, ...args].join(" "),
    cwd,
    exitCode: child.exitCode,
    outputTail: output.trimEnd().split("\n").slice(-TAIL_LINES).join("\n"),
    seconds: Math.round((Date.now() - started) / MS_PER_SECOND),
  };
};

// Starts a server process and resolves once it answers on the port.
const startServer = async (
  command: string,
  args: string[],
  cwd: string,
  port: number
): Promise<() => void> => {
  const child = spawn(command, args, { cwd, stdio: "ignore" });

  const url = `http://127.0.0.1:${port}/`;
  const deadline = Date.now() + 30 * MS_PER_SECOND;

  while (Date.now() < deadline) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- polls until the server is up
      const response = await fetch(url);

      if (response.ok) {
        return () => child.kill();
      }
    } catch {
      // Not listening yet.
    }

    // oxlint-disable-next-line no-await-in-loop -- polls until the server is up
    await delay(200);
  }

  child.kill();
  throw new Error(`the server did not answer on ${url}`);
};

// Serves a folder of static files.
export const serve = (directory: string, port: number) =>
  startServer(
    path.join(REPO, "node_modules/.bin/serve"),
    ["--no-clipboard", "--no-port-switching", "-l", String(port), directory],
    REPO,
    port
  );

// A built Next.js app, with next start.
export const serveNextApp = (app: string, port: number) =>
  startServer(
    path.join(app, "node_modules/.bin/next"),
    ["start", "--port", String(port), "--hostname", "127.0.0.1"],
    app,
    port
  );

// The playground's Vite dev server, for the dev-only stress harness.
export const servePlayground = () =>
  startServer(
    path.join(PLAYGROUND, "node_modules/.bin/vite"),
    ["--port", String(PLAYGROUND_PORT), "--strictPort", "--host", "127.0.0.1"],
    PLAYGROUND,
    PLAYGROUND_PORT
  );
