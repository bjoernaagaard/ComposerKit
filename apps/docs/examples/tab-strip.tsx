// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useId, useState } from "react";

import { AppShellTabs, appShellTabId } from "@/components/app-shell/tabs";
import type { AppShellTabAppearance } from "@/components/app-shell/tabs";
import { SAMPLE_CONVERSATIONS } from "@/content/sample";

// Title bar tabs with the panel they control. Left and Right move between
// tabs.
export const TabStripExample = ({
  appearance,
}: {
  appearance: AppShellTabAppearance;
}) => {
  // A tab id can be any string, such as the chat's title in quotes. Ids
  // carry the appearance so two strips on a page never share a tab id.
  const tabs = SAMPLE_CONVERSATIONS.slice(0, 3).map((conversation) => ({
    id: `${appearance} "${conversation.title}"`,
    title: conversation.title,
  }));

  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const panelId = useId();

  return (
    <div className="bg-window flex flex-col gap-2 rounded-(--radius-menu) p-2">
      <AppShellTabs
        activeTabId={active}
        appearance={appearance}
        labels={{ tabs: `${appearance} tabs` }}
        onSelectTab={setActive}
        panelId={panelId}
        tabs={tabs}
      />
      <div
        aria-labelledby={appShellTabId(panelId, active)}
        className="text-muted-foreground px-2.5 pb-1 text-(length:--text-caption-size) leading-(--text-caption-leading)"
        id={panelId}
        role="tabpanel"
      >
        Showing “{tabs.find((tab) => tab.id === active)?.title}”
      </div>
    </div>
  );
};
