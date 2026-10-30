// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useId, useState } from "react";

import { AppShellTabs, appShellTabId } from "@/components/app-shell/tabs";
import type {
  AppShellTab,
  AppShellTabAppearance,
} from "@/components/app-shell/tabs";
import { SAMPLE_CONVERSATIONS } from "@/content/sample";

// Title bar tabs with the panel they control. Left and Right move between
// tabs, Delete or a tab's close button closes it, and New tab opens one.
// When the tabs don't fit, a menu button lists them all.
export const TabStripExample = ({
  appearance,
}: {
  appearance: AppShellTabAppearance;
}) => {
  // A tab id can be any string, such as the chat's title in quotes.
  const [tabs, setTabs] = useState<AppShellTab[]>(() =>
    SAMPLE_CONVERSATIONS.slice(0, 3).map((conversation) => ({
      id: `"${conversation.title}"`,
      title: conversation.title,
    }))
  );

  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const [opened, setOpened] = useState(0);
  const panelId = useId();

  return (
    <div className="bg-window flex flex-col gap-2 rounded-(--radius-menu) p-2">
      <AppShellTabs
        activeTabId={active}
        appearance={appearance}
        labels={{ tabs: `${appearance} tabs` }}
        onCloseTab={(id) =>
          setTabs((list) => list.filter((tab) => tab.id !== id))
        }
        onNewTab={() => {
          const tab = {
            id: `new ${opened + 1}`,
            title: `New chat ${opened + 1}`,
          };

          setOpened(opened + 1);
          setTabs((list) => [...list, tab]);
          setActive(tab.id);
        }}
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
