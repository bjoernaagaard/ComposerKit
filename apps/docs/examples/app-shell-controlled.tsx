// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useState, useSyncExternalStore } from "react";

import {
  AppShell,
  AppShellMain,
  AppShellSidebar,
} from "@/components/app-shell/app-shell";
import { AppShellProvider } from "@/components/app-shell/app-shell-provider";
import { readDocumentShellCookie } from "@/components/app-shell/persist";
import {
  AppShellSidebarToggle,
  AppShellTitleBar,
  AppShellTitleBarStart,
} from "@/components/app-shell/title-bar";
import { Button } from "@/components/ui/button";

const noUpdates = () => () => {
  // The cookie is read once, on the first render in the browser.
};

const savedOpen = () => readDocumentShellCookie().open ?? null;

const noCookieOnServer = () => null;

// The app owns the open state: a button outside the shell sets it, and the
// shell's toggle, Cmd+B or Ctrl+B ask for a change through onOpenChange.
// The provider still saves what the shell shows in the composerkit_shell
// cookie, so a reload opens the sidebar as it was left. This page has no
// server, so the saved value is read in the browser.
// This one sits inside a docs page that already has its own landmarks, so
// its sidebar renders as a <section> and its main region as a <div>, with
// their own names.
export const AppShellControlled = () => {
  const saved = useSyncExternalStore(noUpdates, savedOpen, noCookieOnServer);
  const [choice, setChoice] = useState<boolean>();
  const open = choice ?? saved ?? true;

  return (
    <div className="flex flex-col gap-3">
      <Button
        aria-pressed={open}
        className="self-start"
        onClick={() => setChoice(!open)}
        variant="outline"
      >
        Sidebar open
      </Button>
      <div className="border-border h-80 overflow-hidden rounded-(--radius-menu) border-(length:--border-hairline)">
        <AppShellProvider
          labels={{ sidebar: "Controlled sidebar" }}
          onOpenChange={setChoice}
          open={open}
        >
          <AppShell>
            <AppShellTitleBar>
              <AppShellTitleBarStart>
                <AppShellSidebarToggle />
              </AppShellTitleBarStart>
            </AppShellTitleBar>
            <AppShellSidebar render={<section />}>
              <div className="flex flex-col items-start gap-2 p-4">
                <p className="text-muted-foreground text-(length:--text-label-size) leading-(--text-label-leading)">
                  The app decides whether this sidebar is open.
                </p>
                <Button variant="ghost">New chat</Button>
              </div>
            </AppShellSidebar>
            <AppShellMain render={<div />}>
              <p className="text-muted-foreground p-6 text-(length:--text-label-size) leading-(--text-label-leading)">
                The sidebar is {open ? "open" : "closed"}.
              </p>
            </AppShellMain>
          </AppShell>
        </AppShellProvider>
      </div>
    </div>
  );
};
