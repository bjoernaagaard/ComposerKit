// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { ConversationView } from "@/components/conversation/conversation-view";
import { CONVERSATION_LAYOUTS } from "@/components/conversation/layouts";
import type { ConversationLayout } from "@/components/conversation/layouts";
import { COMPOSER_OPTIONS } from "@/content/catalog";
import { PLACEHOLDER_REPLY, SAMPLE_TURNS } from "@/content/conversation";
import { SAMPLE_PROJECTS } from "@/content/sample";

const placeholderReply = () => PLACEHOLDER_REPLY;

// An open chat with the composer below it. Copying, redoing, stopping and
// sending all work here.
export const ConversationLayoutExample = ({
  layout,
}: {
  layout: ConversationLayout;
}) => {
  const label = CONVERSATION_LAYOUTS.find((item) => item.id === layout)?.label;

  return (
    <div className="bg-background border-border h-160 overflow-hidden rounded-(--radius-menu) border-(length:--border-hairline)">
      <ConversationView
        layout={layout}
        options={COMPOSER_OPTIONS}
        projects={SAMPLE_PROJECTS}
        reply={placeholderReply}
        title={`${label} layout sample`}
        turns={SAMPLE_TURNS}
      />
    </div>
  );
};
