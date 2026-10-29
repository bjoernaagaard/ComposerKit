// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import type { ComponentType } from "react";

import {
  Attachments,
  RichText,
  StreamStatus,
  TurnActions,
  turnHeading,
} from "@/components/conversation/parts";
import type { TurnViewProps } from "@/components/conversation/parts";
import { cn } from "@/lib/utils";

// The layouts differ in how much of a turn sits in a box. bubbles boxes
// both sides, document boxes only your message, and transcript boxes
// nothing and prints the speaker on every row.

// Both roles in a bubble on their own side. Your message is filled, a reply
// is outlined, and the corner nearest the speaker is squared, so side, fill
// and shape all tell them apart.
const BubbleTurn = (props: TurnViewProps) => {
  const mine = props.role === "user";

  return (
    <article
      data-slot="turn"
      aria-busy={props.status === "streaming"}
      aria-labelledby={props.headingId}
      className={cn(
        "flex flex-col gap-1.5",
        mine ? "items-end" : "items-start"
      )}
      data-role={props.role}
    >
      <h2 className="sr-only" id={props.headingId}>
        {turnHeading(props.speaker)}
      </h2>
      <Attachments
        attachments={props.attachments}
        className="max-w-[85%] justify-end"
      />
      <div
        data-slot="bubble"
        className={cn(
          "flex max-w-[85%] min-w-0 flex-col gap-2 rounded-(--radius-tray) px-4 py-(--space-bubble-padding-y)",
          mine
            ? "bg-muted rounded-br-(--radius-small)"
            : "border-input rounded-bl-(--radius-small) border-(length:--border-hairline)"
        )}
      >
        <RichText
          blocks={props.blocks}
          copied={props.copied}
          density="regular"
          onCopy={props.onCopy}
          streaming={props.status === "streaming"}
        />
        <StreamStatus status={props.status} />
      </div>
      <TurnActions {...props} />
    </article>
  );
};

// Your message is a bubble on the right and a reply is plain text across
// the reading column. Your message's actions show while the pointer is
// over it or focus is inside it, and keep their space while hidden; a
// reply's actions always show. The default.
const DocumentTurn = (props: TurnViewProps) => {
  const mine = props.role === "user";

  return (
    <article
      data-slot="turn"
      aria-busy={props.status === "streaming"}
      aria-labelledby={props.headingId}
      className={cn(
        "group/turn flex flex-col text-(length:--text-message-size) leading-(--text-message-leading)",
        mine
          ? "mb-(--space-prompt-to-reply) items-end"
          : "mb-(--space-reply-to-prompt) items-stretch"
      )}
      data-role={props.role}
    >
      <h2 className="sr-only" id={props.headingId}>
        {turnHeading(props.speaker)}
      </h2>
      <Attachments
        attachments={props.attachments}
        className="mb-2 max-w-[85%] justify-end"
      />
      {mine ? (
        <>
          <div
            data-slot="bubble"
            className="bg-muted mr-(--space-bubble-end-inset) max-w-[85%] min-w-0 rounded-(--radius-user-bubble) px-(--space-user-bubble-padding-x) py-(--space-user-bubble-padding-y) @min-[560px]/conversation:max-w-[70%]"
          >
            <RichText
              blocks={props.blocks}
              copied={props.copied}
              density="regular"
              onCopy={props.onCopy}
              streaming={false}
            />
          </div>
          <TurnActions
            {...props}
            className="mt-(--space-prompt-action-gap) mr-(--space-bubble-end-inset) opacity-0 group-hover/turn:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100"
          />
        </>
      ) : (
        <>
          <RichText
            blocks={props.blocks}
            copied={props.copied}
            density="regular"
            onCopy={props.onCopy}
            streaming={props.status === "streaming"}
          />
          <StreamStatus status={props.status} />
          <TurnActions
            {...props}
            className="mt-(--space-reply-action-gap) -ml-(--space-document-action-inset)"
          />
        </>
      )}
    </article>
  );
};

// A log: one row per turn, the speaker's name in a gutter with the actions
// under it, rows split by a hairline. The actions wrap onto as many lines
// as the gutter needs, so none of them reaches into the text. Below 520px
// the name and actions share a line above the text.
const TranscriptTurn = (props: TurnViewProps) => (
  <article
    data-slot="turn"
    aria-busy={props.status === "streaming"}
    aria-labelledby={props.headingId}
    className="border-border grid grid-cols-[var(--space-transcript-gutter)_minmax(0,1fr)] gap-x-4 gap-y-1 border-b-(length:--border-hairline) py-3 @max-[520px]/conversation:grid-cols-1"
    data-role={props.role}
  >
    <div className="flex min-w-0 flex-col items-start gap-1 @max-[520px]/conversation:flex-row @max-[520px]/conversation:items-center @max-[520px]/conversation:justify-between">
      <h2
        className="text-(length:--text-label-size) leading-(--text-label-leading) font-(--weight-semibold)"
        id={props.headingId}
      >
        <span className="sr-only">{turnHeading(props.speaker)}</span>
        <span aria-hidden="true">{props.speaker}</span>
      </h2>
      {/* Each button is 2px wider than its fill on every side. */}
      <TurnActions
        {...props}
        className="-ml-[calc(var(--space-transcript-action-inset)+2px)]"
        size="row"
      />
    </div>
    <div className="flex min-w-0 flex-col gap-2">
      <Attachments attachments={props.attachments} />
      <RichText
        blocks={props.blocks}
        copied={props.copied}
        density="compact"
        onCopy={props.onCopy}
        streaming={props.status === "streaming"}
      />
      <StreamStatus status={props.status} />
    </div>
  </article>
);

export type ConversationLayout = "document" | "bubbles" | "transcript";

// In the order a picker shows them. document is the default.
export const CONVERSATION_LAYOUTS: readonly {
  id: ConversationLayout;
  label: string;
}[] = [
  { id: "document", label: "Document" },
  { id: "bubbles", label: "Bubbles" },
  { id: "transcript", label: "Transcript" },
];

export const DEFAULT_CONVERSATION_LAYOUT: ConversationLayout = "document";

// How each layout draws a turn, and the spacing between turns.
export const LAYOUT_PARTS: Record<
  ConversationLayout,
  { Turn: ComponentType<TurnViewProps>; listClassName: string }
> = {
  bubbles: { Turn: BubbleTurn, listClassName: "gap-4" },
  document: { Turn: DocumentTurn, listClassName: "" },
  transcript: {
    Turn: TranscriptTurn,
    listClassName: "border-border border-t-(length:--border-hairline)",
  },
};

export const isConversationLayout = (
  value: unknown
): value is ConversationLayout =>
  CONVERSATION_LAYOUTS.some((layout) => layout.id === value);
