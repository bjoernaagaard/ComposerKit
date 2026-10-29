// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { EllipsisIcon, PinIcon, PinOffIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu";
import { Tip } from "@/components/ui/tip";
import type { Conversation, Project } from "@/content/sample";

import tokens from "../../../../../crates/composerkit-theme/design-tokens.json";

export interface RowProps {
  conversation: Conversation;
  project: Project | undefined;
  active: boolean;
  now: number;
  onOpen: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
}

// A title that scrolls sideways to reveal the rest on hover or focus.
// With reduced motion it wraps instead, so the full title is always reachable.
export const MarqueeLabel = ({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) => {
  const viewport = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const element = viewport.current;

    if (!element) {
      return;
    }

    const measure = () =>
      setOverflow(Math.max(0, element.scrollWidth - element.clientWidth));

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const overflowing = overflow > 0;

  return (
    <span
      className={`marquee-mask block min-w-0 flex-1 overflow-hidden ${className}`}
      data-overflowing={overflowing}
      ref={viewport}
    >
      <span
        className="marquee-track"
        data-overflowing={overflowing}
        style={{
          "--overflow": `${overflow}px`,
          "--overflow-ms": overflow * tokens.motion.marqueeMsPerPixel,
        }}
      >
        {text}
      </span>
    </span>
  );
};

// While the actions show, the title gives up their width so its end stays
// visible: two 20px action fills, the 8px between them and the right inset.
// Each button is 24px around its fill, so the buttons sit 2px further out.
export const ROW_ACTIONS_ROOM =
  "pr-1.5 group-focus-within:pr-13 group-hover:pr-13 group-has-[[data-popup-open]]:pr-13";

// Pin and actions appear on hover and whenever focus is inside the row.
export const RowActions = ({
  conversation,
  onTogglePin,
  onArchive,
}: Pick<RowProps, "conversation" | "onTogglePin" | "onArchive">) => (
  <span className="bg-sidebar absolute top-1/2 right-0.5 flex -translate-y-1/2 items-center gap-1 rounded-(--radius-control) opacity-0 transition-opacity duration-(--motion-duration) group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-popup-open]]:opacity-100">
    <MenuRoot>
      <Tip label="More actions">
        <MenuTrigger
          aria-label={`More actions for ${conversation.title}`}
          render={<Button size="icon-xs" variant="inset" />}
        >
          <EllipsisIcon aria-hidden="true" />
        </MenuTrigger>
      </Tip>
      <MenuContent align="end" label="More actions" width="narrow">
        <MenuItem
          label={conversation.pinned ? "Unpin chat" : "Pin chat"}
          onSelect={onTogglePin}
        />
        <MenuItem
          description="You can undo it right away"
          label="Archive chat"
          onSelect={onArchive}
        />
      </MenuContent>
    </MenuRoot>
    <IconButton
      icon={conversation.pinned ? PinOffIcon : PinIcon}
      label={
        conversation.pinned
          ? `Unpin ${conversation.title}`
          : `Pin ${conversation.title}`
      }
      onClick={onTogglePin}
      kind="row"
    />
  </span>
);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const AGO = new Intl.RelativeTimeFormat(undefined, { style: "narrow" });

const relativeTime = (iso: string, now: number): string => {
  const elapsed = Math.max(0, now - Date.parse(iso));

  if (elapsed < HOUR) {
    return AGO.format(-Math.max(1, Math.round(elapsed / MINUTE)), "minute");
  }

  if (elapsed < DAY) {
    return AGO.format(-Math.round(elapsed / HOUR), "hour");
  }

  return AGO.format(-Math.round(elapsed / DAY), "day");
};

export type RowDensity = "compact" | "measured" | "two-line";

export const ROW_DENSITIES: RowDensity[] = ["compact", "measured", "two-line"];

// measured: 30px rows, 14/20 text and a 12.5px radius. The default.
// compact fits about a quarter more chats; two-line adds age and project.
const DENSITY_CLASSES: Record<RowDensity, string> = {
  compact:
    "min-h-(--size-row-compact) items-center rounded-(--radius-small) py-0.5 text-(length:--text-caption-size) leading-(--text-caption-leading)",
  measured:
    "min-h-(--size-row) items-center rounded-(--radius-control) py-(--space-row-padding-y) text-(length:--text-body-size) leading-(--text-body-leading)",
  "two-line":
    "min-h-(--size-row-two-line) flex-col justify-center rounded-(--radius-control) py-0.5 text-(length:--text-body-size) leading-(--text-body-leading)",
};

export type ConversationRowProps = RowProps & { density?: RowDensity };

export const ConversationRow = ({
  conversation,
  project,
  active,
  now,
  density = "measured",
  onOpen,
  onTogglePin,
  onArchive,
}: ConversationRowProps) => (
  <div
    data-slot="conversation-row"
    className="group relative"
    data-density={density}
  >
    <button
      aria-current={active ? "page" : undefined}
      className={`hover:bg-accent flex w-full ${ROW_ACTIONS_ROOM} pl-(--space-row-padding-x) text-left transition-colors duration-(--motion-duration) ${DENSITY_CLASSES[density]} ${active ? "bg-accent text-foreground" : "text-muted-foreground"}`}
      onClick={onOpen}
      type="button"
    >
      <MarqueeLabel text={conversation.title} />
      {density === "two-line" ? (
        <span className="text-subtle-foreground truncate text-(length:--text-caption-size) leading-(--text-caption-leading)">
          <time dateTime={conversation.updatedAt}>
            {relativeTime(conversation.updatedAt, now)}
          </time>
          {project ? ` · ${project.name}` : ""}
        </span>
      ) : null}
    </button>
    <RowActions
      conversation={conversation}
      onArchive={onArchive}
      onTogglePin={onTogglePin}
    />
  </div>
);
