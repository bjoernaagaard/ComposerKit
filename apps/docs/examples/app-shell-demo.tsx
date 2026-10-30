// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { HouseIcon, InboxIcon } from "lucide-react";
import { useState } from "react";

import {
  AppShell,
  AppShellMain,
  AppShellSidebar,
  AppShellSkipLink,
} from "@/components/app-shell/app-shell";
import { AppShellProvider } from "@/components/app-shell/app-shell-provider";
import {
  AppShellRail,
  AppShellRailContent,
  AppShellRailItem,
} from "@/components/app-shell/rail";
import {
  AppShellSidebarToggle,
  AppShellTitleBar,
  AppShellTitleBarStart,
} from "@/components/app-shell/title-bar";

const DESTINATIONS = [
  { icon: HouseIcon, id: "home", label: "Home" },
  { icon: InboxIcon, id: "inbox", label: "Inbox" },
];

// A bare shell: a title bar with the sidebar toggle, a rail with two
// destinations, a sidebar and a main region. The sidebar toggle, Cmd+B or
// Ctrl+B show and hide the sidebar.
// This one sits inside a docs page that already has its own main region,
// so its sidebar renders as a <section> and its main region as a <div>.
// In an app, leave render out.
export const AppShellDemo = () => {
  const [current, setCurrent] = useState("home");
  const page = DESTINATIONS.find((item) => item.id === current);

  return (
    <div className="border-border h-120 overflow-hidden rounded-(--radius-menu) border-(length:--border-hairline)">
      <AppShellProvider persist={false}>
        <AppShell>
          <AppShellSkipLink />
          <AppShellTitleBar>
            <AppShellTitleBarStart>
              <AppShellSidebarToggle />
            </AppShellTitleBarStart>
          </AppShellTitleBar>
          <AppShellRail>
            <AppShellRailContent>
              {DESTINATIONS.map((item) => (
                <AppShellRailItem
                  current={item.id === current}
                  icon={item.icon}
                  key={item.id}
                  label={item.label}
                  onClick={() => setCurrent(item.id)}
                />
              ))}
            </AppShellRailContent>
          </AppShellRail>
          <AppShellSidebar render={<section />}>
            <p className="text-muted-foreground p-4 text-(length:--text-label-size) leading-(--text-label-leading)">
              Sidebar content goes here, such as a list of chats.
            </p>
          </AppShellSidebar>
          <AppShellMain render={<div />}>
            <div className="p-6">
              <h2 className="text-(length:--text-brand-size) leading-(--text-brand-leading) font-(--weight-semibold)">
                {page?.label}
              </h2>
            </div>
          </AppShellMain>
        </AppShell>
      </AppShellProvider>
    </div>
  );
};
