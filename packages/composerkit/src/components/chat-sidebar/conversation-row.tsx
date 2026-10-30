// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useRender } from "@base-ui/react/use-render";
import { EllipsisIcon, PinIcon, PinOffIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, ReactElement } from "react";

import { chatSidebarLabels } from "@/components/chat-sidebar/labels";
import type {
  ChatSidebarAgeUnit,
  ChatSidebarLabels,
} from "@/components/chat-sidebar/labels";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

// A chat as the sidebar lists it. updatedAt is an ISO 8601 date, and
// projectId is null for a chat in no project.
export interface ChatSidebarConversation {
  id: string;
  title: string;
  pinned: boolean;
  projectId: string | null;
  updatedAt: string;
}

export interface ChatSidebarProject {
  id: string;
  name: string;
}

// Returns the element a row renders instead of its <button>, such as
// <a href={`/c/${conversation.id}`} /> or a router's link, so the row is
// a real link: Cmd-click, middle-click and Copy link work.
export type ChatSidebarRenderLink = (
  conversation: ChatSidebarConversation
) => ReactElement;

// Puts data-hover on a row while a mouse is over it. :hover also matches
// where a finger tapped on a screen whose main pointer hovers, such as a
// touchscreen laptop, which would show the row's hidden actions under the
// finger and scroll its title. So chat-sidebar.css reads data-hover.
const mouseHover = (event: PointerEvent<HTMLElement>, over: boolean) => {
  if (event.pointerType === "mouse") {
    event.currentTarget.toggleAttribute("data-hover", over);
  }
};

export const MOUSE_HOVER_PROPS = {
  onPointerEnter: (event: PointerEvent<HTMLElement>) => mouseHover(event, true),
  onPointerLeave: (event: PointerEvent<HTMLElement>) =>
    mouseHover(event, false),
};

// A title that scrolls sideways to show the rest. It scrolls while a mouse
// hovers its row, and while the keyboard focuses its row, starting from the
// title's start, at --motion-marquee-ms-per-pixel after
// --motion-marquee-delay. A touch never scrolls it, and with reduced
// motion it never moves: it stays on one line and ends in an ellipsis, so
// the row never grows. chat-sidebar.css holds those rules.
export const MarqueeLabel = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  const viewport = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  // The distance to scroll goes straight onto the text as --overflow, in
  // px, and --overflow-px, as a number. It is measured again when the
  // text changes or the title's box resizes.
  useLayoutEffect(() => {
    const element = viewport.current;
    const content = track.current;

    if (!(element && content)) {
      return;
    }

    const measure = () => {
      const overflow = Math.max(0, element.scrollWidth - element.clientWidth);

      content.style.setProperty("--overflow", `${overflow}px`);
      content.style.setProperty("--overflow-px", String(overflow));
      setOverflowing(overflow > 0);
    };

    measure();
    const resized = new ResizeObserver(measure);
    const retitled = new MutationObserver(measure);

    resized.observe(element);
    retitled.observe(content, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => {
      resized.disconnect();
      retitled.disconnect();
    };
  }, []);

  return (
    <span
      className={cn(
        "block min-w-0 flex-1 overflow-hidden whitespace-nowrap",
        className
      )}
      data-overflowing={overflowing}
      data-slot="row-title"
      ref={viewport}
    >
      <span
        data-overflowing={overflowing}
        data-slot="row-title-track"
        ref={track}
      >
        {text}
      </span>
    </span>
  );
};

export interface RowActionsProps {
  conversation: ChatSidebarConversation;
  onTogglePin: () => void;
  onArchive: () => void;
  labels?: Partial<ChatSidebarLabels>;
}

// The row's More menu and Pin button. With a pointer that can hover they
// show while a mouse hovers the row, while the keyboard focuses it and
// while the menu is open, and until then a click or a tap goes to the
// row. A touch screen can't hover, so there the More button always shows
// and Pin waits in its menu, beside Archive. They sit over the row's end on no fill of their own, and the
// title gives up their width while they show (chat-sidebar.css).
export const RowActions = ({
  conversation,
  onTogglePin,
  onArchive,
  labels,
}: RowActionsProps) => {
  const text = chatSidebarLabels(labels);

  return (
    <span
      className="absolute end-0.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-(--radius-row-actions) transition-opacity duration-(--motion-duration) ease-(--motion-ease-out)"
      data-slot="row-actions"
    >
      <MenuRoot>
        <Tip label={text.moreActions}>
          <MenuTrigger
            aria-label={text.moreActionsFor(conversation.title)}
            data-row-action="more"
            render={<Button size="icon-xs" variant="inset" />}
          >
            <EllipsisIcon aria-hidden="true" />
          </MenuTrigger>
        </Tip>
        <MenuContent align="end" label={text.moreActions} width="narrow">
          <MenuItem
            label={conversation.pinned ? text.unpinChat : text.pinChat}
            onSelect={onTogglePin}
          />
          <MenuItem
            description={text.archiveChatDescription}
            label={text.archiveChat}
            onSelect={onArchive}
          />
        </MenuContent>
      </MenuRoot>
      <IconButton
        data-row-action="pin"
        icon={conversation.pinned ? PinOffIcon : PinIcon}
        label={
          conversation.pinned
            ? text.unpin(conversation.title)
            : text.pin(conversation.title)
        }
        onClick={onTogglePin}
        kind="row"
      />
    </span>
  );
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// How long ago iso was, in whole minutes, hours or days, at least one
// minute.
const elapsedSince = (
  iso: string,
  now: Date
): [amount: number, unit: ChatSidebarAgeUnit] => {
  const elapsed = Math.max(0, now.getTime() - Date.parse(iso));

  if (elapsed < HOUR) {
    return [Math.max(1, Math.round(elapsed / MINUTE)), "minute"];
  }

  if (elapsed < DAY) {
    return [Math.round(elapsed / HOUR), "hour"];
  }

  return [Math.round(elapsed / DAY), "day"];
};

// The two-line row's second line: how long ago the chat changed, and its
// project. Without now, ages count from the current time, which is read
// once the row is on screen, so server and client render the same, and
// again each minute.
const RowDetails = ({
  updatedAt,
  project,
  now,
  labels,
}: {
  updatedAt: string;
  project: string | undefined;
  now: Date | undefined;
  labels: ChatSidebarLabels;
}) => {
  const [clock, setClock] = useState<Date | null>(null);

  useEffect(() => {
    if (now) {
      return;
    }

    const tick = () => setClock(new Date());
    const timer = setInterval(tick, MINUTE);

    tick();

    return () => clearInterval(timer);
  }, [now]);

  const from = now ?? clock;

  return (
    <span
      className="text-subtle-foreground truncate text-(length:--text-caption-size) leading-(--text-caption-leading)"
      data-slot="row-details"
    >
      {from
        ? labels.rowDetails(
            labels.age(...elapsedSince(updatedAt, from)),
            project
          )
        : project}
    </span>
  );
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

// A click that asks the browser for a new tab or window, or a download.
const asksBrowser = (event: MouseEvent) =>
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey;

export interface ConversationRowProps {
  conversation: ChatSidebarConversation;
  // The chat's project, for the two-line row's second line.
  project?: ChatSidebarProject;
  // This chat is the one on screen.
  active: boolean;
  // When ages are measured from. Defaults to the current time.
  now?: Date;
  density?: RowDensity;
  renderLink?: ChatSidebarRenderLink;
  onOpen: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
  labels?: Partial<ChatSidebarLabels>;
}

// One chat in the list: a button that opens it, or a link with renderLink,
// and its actions over the row's end. The open chat has
// aria-current="page" and data-active. A click on a link that asks the
// browser for a new tab, such as Cmd-click, is left to the browser and
// doesn't open the chat here.
export const ConversationRow = ({
  conversation,
  project,
  active,
  now,
  density = "measured",
  renderLink,
  onOpen,
  onTogglePin,
  onArchive,
  labels,
}: ConversationRowProps) => {
  const text = chatSidebarLabels(labels);

  const opener = useRender({
    defaultTagName: "button",
    props: {
      "aria-current": active ? "page" : undefined,
      children: (
        <>
          <MarqueeLabel text={conversation.title} />
          {density === "two-line" ? (
            <RowDetails
              labels={text}
              now={now}
              project={project?.name}
              updatedAt={conversation.updatedAt}
            />
          ) : null}
        </>
      ),
      className: cn(
        "hover:bg-accent flex w-full ps-(--space-row-padding-x) pe-1.5 text-start transition-colors duration-(--motion-duration)",
        DENSITY_CLASSES[density],
        active ? "bg-accent text-foreground" : "text-muted-foreground"
      ),
      "data-active": active ? "" : undefined,
      "data-slot": "row-button",
      onClick: (event: MouseEvent) => {
        if (renderLink && asksBrowser(event)) {
          return;
        }

        onOpen();
      },
      type: renderLink ? undefined : "button",
    },
    render: renderLink?.(conversation),
  });

  return (
    <div
      className="relative"
      data-active={active ? "" : undefined}
      data-density={density}
      data-slot="conversation-row"
      {...MOUSE_HOVER_PROPS}
    >
      {opener}
      <RowActions
        conversation={conversation}
        labels={labels}
        onArchive={onArchive}
        onTogglePin={onTogglePin}
      />
    </div>
  );
};
