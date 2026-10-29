// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import type { ComposerMode } from "@/components/composer/composer";
import { initialComposer } from "@/components/composer/machine";
import type { Attachment, ComposerState } from "@/components/composer/machine";
import { COMPOSER_OPTIONS, DEFAULT_CHOICES } from "@/content/catalog";

export interface StateFixture {
  id: string;
  label: string;
  group: string;
  state: ComposerState;
  mode: ComposerMode;
  dictationSupported: boolean;
}

const MB = 1024 * 1024;

const file = (
  patch: Partial<Attachment> & Pick<Attachment, "id" | "name">
): Attachment => ({
  failure: null,
  progress: 1,
  sizeBytes: 2.4 * MB,
  status: "ready",
  ...patch,
});

const TYPED =
  "Read the sync client and list every place it gives up after one failed request";

const LONG_DRAFT = [
  "Here is how I want to split the settings page:",
  "",
  "1. Move account, notifications and privacy into their own tabs.",
  "2. Keep the save button in one place, below the tabs.",
  "3. Remember the last open tab when someone comes back.",
  "4. Make each tab reachable with the arrow keys.",
  "5. Keep Enter to save and Escape to cancel.",
  "",
  "Before you start, check whether the tab list scrolls when the window is narrow, and what happens to a tab title that is too long. If it doesn’t scroll, we need a menu for the tabs that don’t fit.",
  "",
  "Also confirm the page still works at 320px wide and with text zoomed to 200%.",
].join("\n");

const base = (patch: Partial<ComposerState>): ComposerState => ({
  ...initialComposer(COMPOSER_OPTIONS, DEFAULT_CHOICES),
  ...patch,
});

const fixture = (
  group: string,
  id: string,
  label: string,
  patch: Partial<ComposerState>,
  options: { mode?: ComposerMode; dictationSupported?: boolean } = {}
): StateFixture => ({
  dictationSupported: options.dictationSupported ?? true,
  group,
  id,
  label,
  mode: options.mode ?? "work",
  state: base(patch),
});

export const FIXTURES: StateFixture[] = [
  fixture("Draft", "empty", "Empty", {}),
  fixture("Draft", "typing", "Typing", { draft: TYPED }),
  fixture("Draft", "long-draft", "Long draft", { draft: LONG_DRAFT }),
  fixture("Attachments", "uploading", "Uploading", {
    attachments: [
      file({
        id: "a1",
        name: "electricity-bill-october.pdf",
        progress: 0.42,
        sizeBytes: 1.1 * MB,
        status: "uploading",
      }),
      file({
        id: "a2",
        name: "settings page at 320px wide.png",
        progress: 0.08,
        status: "uploading",
      }),
    ],
    draft: "How much did we pay in total?",
  }),
  fixture("Attachments", "attached", "Attached", {
    attachments: [
      file({
        id: "a1",
        name: "electricity-bill-october.pdf",
        sizeBytes: 1.1 * MB,
      }),
      file({
        id: "a2",
        name: "household budget by month and category (final version).xlsx",
        sizeBytes: 380 * 1024,
      }),
    ],
  }),
  fixture("Attachments", "too-large", "Too large", {
    attachments: [
      file({
        failure: "tooLarge",
        id: "a1",
        name: "screen-recording-of-the-glitch.mov",
        sizeBytes: 182 * MB,
        status: "failed",
      }),
    ],
    draft: "What makes the list jump in this recording?",
  }),
  fixture("Attachments", "upload-offline", "Upload interrupted", {
    attachments: [
      file({
        failure: "offline",
        id: "a1",
        name: "contacts-export.csv",
        progress: 0.6,
        sizeBytes: 6.2 * MB,
        status: "failed",
      }),
    ],
  }),
  fixture("Sending", "sending", "Sending", { draft: TYPED, phase: "sending" }),
  fixture("Sending", "send-failed", "Not sent", {
    draft: TYPED,
    failure: "offline",
    phase: "failed",
  }),
  fixture("Dictation", "listening", "Listening", { dictating: true }),
  fixture(
    "Dictation",
    "unsupported",
    "Not supported",
    {},
    { dictationSupported: false }
  ),
  fixture("Access", "no-limits", "No limits", {
    permission: "open",
    projectId: "shrok",
  }),
  fixture(
    "Access",
    "chat-mode",
    "Chat mode",
    { draft: "Pack list for a weekend of hiking" },
    { mode: "chat" }
  ),
];
