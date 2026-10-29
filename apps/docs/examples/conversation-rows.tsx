// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useEffect, useRef, useState } from "react";

import { ConversationRow } from "@/app/sidebar/conversation-row";
import type { RowDensity } from "@/app/sidebar/conversation-row";
import { Button } from "@/components/ui/button";
import {
  SAMPLE_CONVERSATIONS,
  SAMPLE_NOW,
  SAMPLE_PROJECTS,
} from "@/content/sample";

const ROW_SAMPLE_SIZE = 8;

// A sidebar list in one density. Open, pin and archive all work; archived
// rows can be restored.
export const ConversationRows = ({ density }: { density: RowDensity }) => {
  const [conversations, setConversations] = useState(() =>
    SAMPLE_CONVERSATIONS.slice(0, ROW_SAMPLE_SIZE)
  );

  const [activeId, setActiveId] = useState(conversations[1]?.id ?? null);
  const removed = ROW_SAMPLE_SIZE - conversations.length;
  const restore = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const restoring = useRef(false);

  // The focused control is gone after archiving or restoring, so focus moves
  // to the way back, or to the first restored row.
  useEffect(() => {
    if (removed > 0) {
      restore.current?.focus();
    } else if (restoring.current) {
      restoring.current = false;
      list.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [removed]);

  return (
    <>
      <ul
        className="bg-sidebar border-border flex max-w-(--size-sidebar) flex-col gap-(--size-row-gap) rounded-(--radius-menu) border-(length:--border-hairline) p-(--space-sidebar-padding)"
        ref={list}
      >
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <ConversationRow
              active={conversation.id === activeId}
              conversation={conversation}
              density={density}
              now={SAMPLE_NOW}
              onArchive={() =>
                setConversations((items) =>
                  items.filter((item) => item.id !== conversation.id)
                )
              }
              onOpen={() => setActiveId(conversation.id)}
              onTogglePin={() =>
                setConversations((items) =>
                  items.map((item) =>
                    item.id === conversation.id
                      ? { ...item, pinned: !item.pinned }
                      : item
                  )
                )
              }
              project={SAMPLE_PROJECTS.find(
                (project) => project.id === conversation.projectId
              )}
            />
          </li>
        ))}
      </ul>
      {removed > 0 ? (
        <p className="text-muted-foreground flex items-center gap-2 text-(length:--text-caption-size)">
          {removed} archived in this preview.
          <Button
            onClick={() => {
              restoring.current = true;
              setConversations(SAMPLE_CONVERSATIONS.slice(0, ROW_SAMPLE_SIZE));
            }}
            ref={restore}
            size="sm"
            variant="ghost"
          >
            Restore all
          </Button>
        </p>
      ) : null}
    </>
  );
};
