// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import {
  DEFAULT_CONVERSATION_LAYOUT,
  isConversationLayout,
} from "@/components/conversation/layouts";
import type { ConversationLayout } from "@/components/conversation/layouts";

const LAYOUT_KEY = "composerkit-conversation-layout";

// The saved choice, or the default when there is none or storage is blocked.
export const readConversationLayout = (): ConversationLayout => {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY);

    return isConversationLayout(saved) ? saved : DEFAULT_CONVERSATION_LAYOUT;
  } catch {
    return DEFAULT_CONVERSATION_LAYOUT;
  }
};

export const saveConversationLayout = (layout: ConversationLayout): void => {
  // Blocked storage only means the choice isn't kept for next time.
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Nothing to do: the layout still applies for this visit.
  }
};
