// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import {
  CheckIcon,
  CopyIcon,
  EllipsisIcon,
  FileIcon,
  PencilIcon,
  RotateCwIcon,
  ShareIcon,
  ThumbsUpIcon,
  Volume2Icon,
} from "lucide-react";

import type {
  Block,
  Role,
  TurnAttachment,
} from "@/components/conversation/types";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  MenuContent,
  MenuInfoGroup,
  MenuItem,
  MenuRoot,
  MenuSubmenu,
  MenuTrigger,
} from "@/components/ui/menu";
import { themePixels } from "@/components/ui/theme-value";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

export type TurnStatus = "done" | "streaming" | "stopped";

export type Density = "regular" | "compact";

// How a reply written again should differ from the last one.
export type ReplyStyle = "same" | "shorter" | "longer";

// What each conversation layout's turn receives.
export interface TurnViewProps {
  role: Role;
  // Who the turn is from, as a screen reader and the transcript name it.
  speaker: string;
  blocks: Block[];
  attachments: TurnAttachment[];
  status: TurnStatus;
  copied: string | null;
  headingId: string;
  // When the turn was written, as an ISO 8601 date, if known.
  createdAt?: string;
  // The reply is marked as helpful.
  rated: boolean;
  // The turn is being read aloud.
  speaking: boolean;
  // Whether this browser can read text aloud.
  canSpeak: boolean;
  onCopy: (key: string, text: string) => void;
  onRetry: (style: ReplyStyle) => void;
  onStop: () => void;
  onRate: () => void;
  onReadAloud: () => void;
  onShare: () => void;
  onEdit: () => void;
}

// A heading screen reader users can jump between, one per turn.
export const turnHeading = (speaker: string): string => `${speaker} said:`;

const blockLength = (block: Block): number => {
  if (block.kind === "paragraph") {
    return block.text.length;
  }

  if (block.kind === "code") {
    return block.code.length;
  }

  return block.items.reduce((total, item) => total + item.length, 0);
};

export const totalLength = (blocks: Block[]): number =>
  blocks.reduce((total, block) => total + blockLength(block), 0);

const cutItems = (items: string[], budget: number): string[] => {
  const kept: string[] = [];
  let left = budget;

  for (const item of items) {
    if (left <= 0) {
      break;
    }

    kept.push(item.slice(0, left));
    left -= item.length;
  }

  return kept;
};

const cut = (block: Block, budget: number): Block => {
  if (block.kind === "paragraph") {
    return { ...block, text: block.text.slice(0, budget) };
  }

  if (block.kind === "code") {
    return { ...block, code: block.code.slice(0, budget) };
  }

  return { ...block, items: cutItems(block.items, budget) };
};

// The first `shown` characters of a reply, for streaming and stopped turns.
export const reveal = (blocks: Block[], shown: number): Block[] => {
  const visible: Block[] = [];
  let left = shown;

  for (const block of blocks) {
    if (left <= 0) {
      break;
    }

    visible.push(cut(block, left));
    left -= blockLength(block);
  }

  return visible;
};

const asText = (block: Block): string => {
  if (block.kind === "paragraph") {
    return block.text.replaceAll("`", "");
  }

  if (block.kind === "code") {
    return `\`\`\`${block.language}\n${block.code}\n\`\`\``;
  }

  return block.items
    .map((item, index) =>
      block.ordered ? `${index + 1}. ${item}` : `- ${item}`
    )
    .join("\n");
};

// The turn as Markdown: code keeps its fences and lists their markers.
export const plainText = (blocks: Block[]): string =>
  blocks.map(asText).join("\n\n");

// The turn with no Markdown at all.
export const bareText = (blocks: Block[]): string =>
  blocks
    .map((block) => {
      if (block.kind === "code") {
        return block.code;
      }

      return block.kind === "paragraph"
        ? block.text.replaceAll("`", "")
        : block.items.map((item) => item.replaceAll("`", "")).join("\n");
    })
    .join("\n\n");

interface Segment {
  start: number;
  text: string;
  code: boolean;
}

// Splits on backticks. Odd segments are inline code.
const segments = (text: string): Segment[] => {
  const parts: Segment[] = [];
  let start = 0;

  for (const [index, part] of text.split("`").entries()) {
    parts.push({ code: index % 2 === 1, start, text: part });
    start += part.length + 1;
  }

  return parts;
};

const Inline = ({ text }: { text: string }) =>
  segments(text).map((segment) =>
    segment.code ? (
      <code
        className="bg-accent rounded-(--radius-small) px-1 py-px font-mono wrap-anywhere"
        key={segment.start}
      >
        {segment.text}
      </code>
    ) : (
      <span key={segment.start}>{segment.text}</span>
    )
  );

// A solid block after the newest text. It blinks only when motion is fine.
const StreamCaret = () => (
  <span
    aria-hidden="true"
    className="bg-foreground ml-0.5 inline-block h-3.5 w-1.5 align-middle motion-safe:animate-pulse"
  />
);

export const CodeBlock = ({
  block,
  density,
  copied,
  onCopy,
  streaming = false,
}: {
  block: Extract<Block, { kind: "code" }>;
  density: Density;
  copied: boolean;
  onCopy: () => void;
  streaming?: boolean;
}) => {
  const compact = density === "compact";

  return (
    <figure
      data-slot="code-block"
      className="border-border bg-muted min-w-0 overflow-hidden rounded-(--radius-control) border-(length:--border-hairline)"
    >
      <div
        className={cn(
          "border-border flex items-center gap-2 border-b-(length:--border-hairline) pl-3",
          compact ? "py-0.5 pr-1" : "py-1 pr-1.5"
        )}
      >
        <figcaption className="text-muted-foreground min-w-0 flex-1 text-(length:--text-caption-size) leading-(--text-caption-leading)">
          {block.language}
        </figcaption>
        <Button onClick={onCopy} size="sm" variant="ghost">
          {copied ? (
            <CheckIcon aria-hidden="true" data-icon="inline-start" />
          ) : (
            <CopyIcon aria-hidden="true" data-icon="inline-start" />
          )}
          {copied ? "Copied" : "Copy code"}
        </Button>
      </div>
      {/* Long lines scroll sideways, so the region takes focus for keys. */}
      <pre
        aria-label={`${block.language} code`}
        className={cn(
          "overflow-x-auto font-mono text-(length:--text-caption-size) leading-(--text-caption-leading)",
          compact ? "px-3 py-2" : "p-3"
        )}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be reachable by keyboard
        tabIndex={0}
      >
        <code>
          {block.code}
          {streaming ? <StreamCaret /> : null}
        </code>
      </pre>
    </figure>
  );
};

export const RichText = ({
  blocks,
  density,
  copied,
  onCopy,
  streaming,
}: {
  blocks: Block[];
  density: Density;
  copied: string | null;
  onCopy: (key: string, text: string) => void;
  streaming: boolean;
}) => {
  const last = blocks.at(-1);

  return (
    <div
      data-slot="rich-text"
      className={cn(
        "flex min-w-0 flex-col",
        density === "compact" ? "gap-2" : "gap-(--space-paragraph-gap)"
      )}
    >
      {blocks.map((block) => {
        const caret = streaming && block === last ? <StreamCaret /> : null;

        if (block.kind === "code") {
          return (
            <CodeBlock
              block={block}
              copied={copied === block.id}
              density={density}
              key={block.id}
              onCopy={() => onCopy(block.id, block.code)}
              streaming={caret !== null}
            />
          );
        }

        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";

          return (
            <List
              className={cn(
                "flex flex-col gap-1 pl-5",
                block.ordered ? "list-decimal" : "list-disc"
              )}
              key={block.id}
            >
              {block.items.map((item, index) => (
                <li className="wrap-break-word" key={item}>
                  <Inline text={item} />
                  {caret && index === block.items.length - 1 ? caret : null}
                </li>
              ))}
            </List>
          );
        }

        return (
          // A line break inside a paragraph, as Shift+Enter types, stays.
          <p className="wrap-break-word whitespace-pre-line" key={block.id}>
            <Inline text={block.text} />
            {caret}
          </p>
        );
      })}
      {streaming && !last ? (
        <span
          aria-hidden="true"
          className="bg-foreground my-1.5 inline-block size-2 rounded-full motion-safe:animate-pulse"
        />
      ) : null}
    </div>
  );
};

export const AttachmentChip = ({
  attachment,
}: {
  attachment: TurnAttachment;
}) => (
  <div
    data-slot="turn-attachment"
    className="border-border bg-muted flex max-w-full min-w-0 items-center gap-2 rounded-(--radius-control) border-(length:--border-hairline) py-1.5 pr-3 pl-2"
  >
    <FileIcon
      aria-hidden="true"
      className="text-subtle-foreground size-4 shrink-0"
    />
    <span className="flex min-w-0 flex-col">
      <span className="text-(length:--text-label-size) leading-(--text-label-leading) wrap-anywhere">
        {attachment.name}
      </span>
      <span className="text-subtle-foreground text-(length:--text-caption-size) leading-(--text-caption-leading) tabular-nums">
        {attachment.size}
      </span>
    </span>
  </div>
);

export const Attachments = ({
  attachments,
  className,
}: {
  attachments: TurnAttachment[];
  className?: string;
}) =>
  attachments.length > 0 ? (
    <ul
      aria-label="Attached files"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {attachments.map((attachment) => (
        <li className="min-w-0" key={attachment.name}>
          <AttachmentChip attachment={attachment} />
        </li>
      ))}
    </ul>
  ) : null;

// Shown under a reply while it streams, or once it was stopped. Words, not
// a colored dot, say which.
export const StreamStatus = ({ status }: { status: TurnStatus }) => {
  if (status !== "stopped") {
    return null;
  }

  return (
    <p className="text-subtle-foreground text-(length:--text-caption-size) leading-(--text-caption-leading)">
      Stopped partway. The text so far is kept.
    </p>
  );
};

const FALLBACK_MENU_ALIGN = 2;

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

// The actions under a turn. Your message gets Copy, Share and Edit; a reply
// gets Copy, Helpful, Read aloud, Share, a menu to write it again and a
// menu of more actions. Nothing shows while a reply streams, because there
// is nothing complete to act on yet. Tooltips open below a reply's actions
// and above your message's, so they never cover the turn they act on.
// Both menus stop at their first and last items instead of wrapping. size
// "row" draws the smaller row buttons, for a narrow column.
export const TurnActions = ({
  role,
  blocks,
  status,
  copied,
  createdAt,
  rated,
  speaking,
  canSpeak,
  onCopy,
  onRetry,
  onRate,
  onReadAloud,
  onShare,
  onEdit,
  size = "action",
  className,
}: Pick<
  TurnViewProps,
  | "role"
  | "blocks"
  | "status"
  | "copied"
  | "createdAt"
  | "rated"
  | "speaking"
  | "canSpeak"
  | "onCopy"
  | "onRetry"
  | "onRate"
  | "onReadAloud"
  | "onShare"
  | "onEdit"
> & { size?: "action" | "row"; className?: string }) => {
  if (status === "streaming") {
    return null;
  }

  const mine = role === "user";
  const isCopied = copied === "turn";
  const kind = size === "row" ? "row" : "action";
  const tipSide = mine ? "top" : "bottom";

  // Row-sized actions are 24px targets that touch, and wrap onto more lines
  // where the space they sit in is narrow.
  const rowClasses = cn(
    "text-subtle-foreground flex items-center",
    size === "row"
      ? "flex-wrap"
      : "h-(--size-turn-action-row) gap-(--space-turn-action-gap)",
    className
  );

  const menuButton =
    size === "row" ? (
      <Button size="icon-xs" variant="inset" />
    ) : (
      <Button size="icon-action" variant="inset" />
    );

  const menuOffset = themePixels(
    "--space-more-menu-align-offset",
    FALLBACK_MENU_ALIGN
  );

  const copy = (
    <IconButton
      icon={isCopied ? CheckIcon : CopyIcon}
      kind={kind}
      label={isCopied ? "Copied" : "Copy"}
      onClick={() => onCopy("turn", plainText(blocks))}
      tipSide={tipSide}
    />
  );

  const share = (
    <IconButton
      icon={ShareIcon}
      kind={kind}
      label="Share"
      onClick={onShare}
      tipSide={tipSide}
    />
  );

  const copyAs = (
    <MenuSubmenu
      icon={<CopyIcon aria-hidden="true" className="size-4 shrink-0" />}
      label="Copy as"
    >
      <MenuItem
        label="Plain text"
        onSelect={() => onCopy("turn", bareText(blocks))}
      />
      <MenuItem
        label="Markdown"
        onSelect={() => onCopy("turn", plainText(blocks))}
      />
    </MenuSubmenu>
  );

  if (mine) {
    return (
      <div className={rowClasses} data-slot="turn-actions">
        {copy}
        {share}
        <IconButton
          icon={PencilIcon}
          kind={kind}
          label="Edit"
          onClick={onEdit}
          tipSide={tipSide}
        />
      </div>
    );
  }

  return (
    <div className={rowClasses} data-slot="turn-actions">
      {copy}
      <IconButton
        aria-pressed={rated}
        icon={ThumbsUpIcon}
        kind={kind}
        label="Helpful"
        onClick={onRate}
        tipSide={tipSide}
      />
      <IconButton
        aria-disabled={canSpeak ? undefined : "true"}
        aria-pressed={speaking}
        icon={Volume2Icon}
        kind={kind}
        label={canSpeak ? "Read aloud" : "This browser can’t read aloud"}
        onClick={canSpeak ? onReadAloud : undefined}
        tipSide={tipSide}
      />
      {share}
      <MenuRoot loopFocus={false}>
        <Tip label="Write again" side={tipSide}>
          <MenuTrigger aria-label="Write again" render={menuButton}>
            <RotateCwIcon aria-hidden="true" />
          </MenuTrigger>
        </Tip>
        <MenuContent
          alignOffset={menuOffset}
          label="Write again"
          side="top"
          width="actions"
        >
          <MenuItem label="Same length" onSelect={() => onRetry("same")} />
          <MenuItem label="Shorter" onSelect={() => onRetry("shorter")} />
          <MenuItem label="Longer" onSelect={() => onRetry("longer")} />
        </MenuContent>
      </MenuRoot>
      <MenuRoot loopFocus={false}>
        <Tip label="More" side={tipSide}>
          <MenuTrigger aria-label="More" render={menuButton}>
            <EllipsisIcon aria-hidden="true" />
          </MenuTrigger>
        </Tip>
        <MenuContent
          alignOffset={menuOffset}
          label="More"
          side="top"
          width="actions"
        >
          {createdAt ? (
            <MenuInfoGroup info={`Written at ${formatTime(createdAt)}`}>
              {copyAs}
            </MenuInfoGroup>
          ) : (
            copyAs
          )}
        </MenuContent>
      </MenuRoot>
    </div>
  );
};
