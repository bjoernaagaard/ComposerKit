// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// A conversation is a list of turns, and a turn is a list of blocks. Inline
// code inside a paragraph or list item is wrapped in backticks.

export type BlockContent =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; language: string; code: string };

export type Block = BlockContent & { id: string };

export interface TurnAttachment {
  name: string;
  size: string;
}

export type Role = "user" | "assistant";

export interface Turn {
  id: string;
  role: Role;
  blocks: Block[];
  attachments: TurnAttachment[];
  // When the turn was written, as an ISO 8601 date, if known.
  createdAt?: string;
}

let nextBlock = 0;

// Gives each block an id that stays unique for the page's lifetime.
export const toBlocks = (content: BlockContent[]): Block[] =>
  content.map((block) => {
    nextBlock += 1;

    return { ...block, id: `b${nextBlock}` };
  });
