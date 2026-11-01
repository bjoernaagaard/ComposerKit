// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import type { ReactElement } from "react";

import { FIXTURES } from "@/states/composer/fixtures";

import { AppShellControlled } from "./app-shell-controlled";
import { AppShellDemo } from "./app-shell-demo";
import { ButtonDemo } from "./button-demo";
import { ButtonRow } from "./button-row";
import { ChatAppDemo } from "./chat-app-demo";
import { ChatSidebarDemo } from "./chat-sidebar-demo";
import { ChatSidebarLinks } from "./chat-sidebar-links";
import { ComposerLayoutExample } from "./composer-layout";
import { ComposerStateExample } from "./composer-state";
import { ConversationDemo } from "./conversation-demo";
import { ConversationLayoutExample } from "./conversation-layout";
import { ConversationRows } from "./conversation-rows";
import { IconButtonPair } from "./icon-button-pair";
import { MenuDemo } from "./menu-demo";
import { MenuDensityExample } from "./menu-density";
import { ModeToggleExample } from "./mode-toggle";
import { Palette } from "./palette";
import { TabStripExample } from "./tab-strip";
import { ThemeDemo } from "./theme-demo";
import { TipDemo } from "./tip-demo";
import { TipOnIconButtons } from "./tip-icon-buttons";

// Every live example in the docs, by name. Some names are the composer
// states from src/states/composer/fixtures.ts. Each preview carries its
// name in a data-example attribute. file is shown on the Code tab.

export interface Example {
  element: ReactElement;
  file: string;
  label: string;
  note?: string;
  // Takes its own width instead of filling the preview.
  fit?: boolean;
  // A selector for the element the name tags, when it is not the root.
  target?: string;
}

const CATALOG = {
  "app-shell--controlled": {
    element: <AppShellControlled />,
    file: "app-shell-controlled.tsx",
    label: "open and onOpenChange",
    note: "The app owns the open state. The cookie saves what the shell shows, so a reload keeps it.",
  },
  "app-shell--demo": {
    element: <AppShellDemo />,
    file: "app-shell-demo.tsx",
    label: "AppShellProvider",
    note: "Pick a destination in the rail, or hide the sidebar with the toggle, Cmd+B or Ctrl+B.",
  },
  "button--default": {
    element: <ButtonRow variant="default" />,
    file: "button-row.tsx",
    label: 'variant="default"',
    note: "The one action a view asks for.",
  },
  "button--demo": {
    element: <ButtonDemo />,
    file: "button-demo.tsx",
    label: "Button and IconButton",
  },
  "button--ghost": {
    element: <ButtonRow variant="ghost" />,
    file: "button-row.tsx",
    label: 'variant="ghost"',
    note: "Small actions inside content, such as Undo or Try again.",
  },
  "button--outline": {
    element: <ButtonRow variant="outline" />,
    file: "button-row.tsx",
    label: 'variant="outline"',
    note: "A second choice that sits beside the main one.",
  },
  "chat-app--demo": {
    element: <ChatAppDemo />,
    file: "chat-app-demo.tsx",
    label: "ChatApp",
    note: "Open a chat, send a message from Home, close a tab, or narrow the window to see the drawer.",
  },
  "chat-sidebar--demo": {
    element: <ChatSidebarDemo />,
    file: "chat-sidebar-demo.tsx",
    fit: true,
    label: "ChatSidebar",
    note: "Open, pin or archive a chat, search the titles, or filter Recent.",
  },
  "chat-sidebar--links": {
    element: <ChatSidebarLinks />,
    file: "chat-sidebar-links.tsx",
    label: "renderLink",
    note: "Each row is a link. Cmd-click or Ctrl-click opens the chat in a new tab.",
  },
  "composer--demo": {
    element: <ComposerLayoutExample layout="stacked" mode="chat" />,
    file: "composer-layout.tsx",
    label: 'mode="chat"',
    note: "Chat mode has no Work tray.",
  },
  "composer--inline": {
    element: <ComposerLayoutExample layout="inline" />,
    file: "composer-layout.tsx",
    label: 'layout="inline"',
    note: "One row that grows as you type. Shortest at rest.",
  },
  "composer--roomy": {
    element: <ComposerLayoutExample layout="roomy" />,
    file: "composer-layout.tsx",
    label: 'layout="roomy"',
    note: "Taller, with the Work tray inside the box.",
  },
  "composer--stacked": {
    element: <ComposerLayoutExample layout="stacked" />,
    file: "composer-layout.tsx",
    label: 'layout="stacked"',
    note: "Text on top, controls below, tray hanging under. The default.",
  },
  "conversation--bubbles": {
    element: <ConversationLayoutExample layout="bubbles" />,
    file: "conversation-layout.tsx",
    label: 'layout="bubbles"',
    note: "Both sides in bubbles, the reply outlined. Fewest turns fit.",
  },
  "conversation--demo": {
    element: <ConversationDemo />,
    file: "conversation-demo.tsx",
    label: "ConversationView",
    note: "Send a message to watch a reply stream in.",
  },
  "conversation--document": {
    element: <ConversationLayoutExample layout="document" />,
    file: "conversation-layout.tsx",
    label: 'layout="document"',
    note: "Your message in a bubble, the reply as plain text. The default.",
  },
  "conversation--transcript": {
    element: <ConversationLayoutExample layout="transcript" />,
    file: "conversation-layout.tsx",
    label: 'layout="transcript"',
    note: "No bubbles. One row per turn with the speaker. Most turns fit.",
  },
  "conversation-row--compact": {
    element: <ConversationRows density="compact" />,
    file: "conversation-rows.tsx",
    label: 'density="compact"',
    note: "24px rows and 13px text. About a quarter more chats fit.",
  },
  "conversation-row--measured": {
    element: <ConversationRows density="measured" />,
    file: "conversation-rows.tsx",
    label: 'density="measured"',
    note: "30px rows and 14px text. The default.",
  },
  "conversation-row--two-line": {
    element: <ConversationRows density="two-line" />,
    file: "conversation-rows.tsx",
    label: 'density="two-line"',
    note: "44px rows. Adds how long ago and which project.",
  },
  "icon-button--control": {
    element: <IconButtonPair kind="control" />,
    file: "icon-button-pair.tsx",
    fit: true,
    label: 'kind="control"',
  },
  "icon-button--pill": {
    element: <IconButtonPair kind="pill" />,
    file: "icon-button-pair.tsx",
    fit: true,
    label: 'kind="pill"',
  },
  "icon-button--row": {
    element: <IconButtonPair kind="row" />,
    file: "icon-button-pair.tsx",
    fit: true,
    label: 'kind="row"',
  },
  "icon-button--small": {
    element: <IconButtonPair kind="small" />,
    file: "icon-button-pair.tsx",
    fit: true,
    label: 'kind="small"',
  },
  "menu--compact": {
    element: <MenuDensityExample density="compact" />,
    file: "menu-density.tsx",
    fit: true,
    label: 'density="compact"',
    note: "25px items and tighter corners. Fits long lists.",
  },
  "menu--demo": {
    element: <MenuDemo />,
    file: "menu-demo.tsx",
    fit: true,
    label: "MenuRoot",
    note: "Open it with the button, Enter or Space.",
  },
  "menu--regular": {
    element: <MenuDensityExample density="regular" />,
    file: "menu-density.tsx",
    fit: true,
    label: 'density="regular"',
    note: "29px items. The default.",
  },
  "mode-toggle--pill": {
    element: <ModeToggleExample appearance="pill" />,
    file: "mode-toggle.tsx",
    fit: true,
    label: 'appearance="pill"',
    note: "A round track with a sliding thumb. The default.",
  },
  "mode-toggle--segmented": {
    element: <ModeToggleExample appearance="segmented" />,
    file: "mode-toggle.tsx",
    fit: true,
    label: 'appearance="segmented"',
    note: "Squarer, with the thumb inside the track. Fits toolbars.",
  },
  "mode-toggle--underline": {
    element: <ModeToggleExample appearance="underline" />,
    file: "mode-toggle.tsx",
    fit: true,
    label: 'appearance="underline"',
    note: "No track. A bar slides under the chosen mode.",
  },
  "palette--swatches": {
    element: <Palette />,
    file: "palette.tsx",
    label: "swatches",
    note: "One palette with a light and a dark scheme. Switch the docs between light and dark to see both.",
  },
  "theme--demo": {
    element: <ThemeDemo />,
    file: "theme-demo.tsx",
    label: "Theme colors",
  },
  "tip--demo": {
    element: <TipDemo />,
    file: "tip-demo.tsx",
    fit: true,
    label: 'side="top"',
    note: "Hover the button or move focus to it with Tab.",
  },
  "tip--icon-buttons": {
    element: <TipOnIconButtons />,
    file: "tip-icon-buttons.tsx",
    fit: true,
    label: "IconButton",
    note: "Each icon button shows its label in a tip.",
  },
  "title-bar-tabs--filled": {
    element: <TabStripExample appearance="filled" />,
    file: "tab-strip.tsx",
    label: 'appearance="filled"',
    note: "The open tab is a raised box. The default.",
  },
  "title-bar-tabs--underline": {
    element: <TabStripExample appearance="underline" />,
    file: "tab-strip.tsx",
    label: 'appearance="underline"',
    note: "No box. A bar sits under the open tab.",
  },
} satisfies Record<string, Example>;

// One example per fixture, so a new fixture shows up in the docs on its own.
const STATES = Object.fromEntries(
  FIXTURES.map((fixture) => [
    `composer-state--${fixture.id}`,
    {
      element: <ComposerStateExample id={fixture.id} />,
      file: "composer-state.tsx",
      label: fixture.label,
      note: fixture.group,
      target: '[data-slot="composer-surface"]',
    },
  ])
) satisfies Record<string, Example>;

// Looked up by the name an MDX page passes.
export const EXAMPLES = new Map<string, Example>([
  ...Object.entries(CATALOG),
  ...Object.entries(STATES),
]);

export const COMPOSER_STATE_NAMES = Object.keys(STATES);
