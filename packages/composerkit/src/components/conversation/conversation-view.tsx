// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { ArrowDownIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { MouseEvent } from "react";

import { Composer } from "@/components/composer/composer";
import { formatSize } from "@/components/composer/composer-attachments";
import { initialComposer } from "@/components/composer/machine";
import type { ComposerState } from "@/components/composer/machine";
import type {
  ComposerOptions,
  ComposerProject,
} from "@/components/composer/options";
import { useComposerController } from "@/components/composer/use-composer-controller";
import {
  DEFAULT_CONVERSATION_LAYOUT,
  LAYOUT_PARTS,
} from "@/components/conversation/layouts";
import type { ConversationLayout } from "@/components/conversation/layouts";
import {
  bareText,
  plainText,
  reveal,
  totalLength,
} from "@/components/conversation/parts";
import type { ReplyStyle, TurnStatus } from "@/components/conversation/parts";
import { toBlocks } from "@/components/conversation/types";
import type {
  Block,
  BlockContent,
  Turn,
} from "@/components/conversation/types";
import { IconButton } from "@/components/ui/icon-button";
import { themePixels } from "@/components/ui/theme-value";

interface Stream {
  turnId: string;
  // Characters shown. Zero while the reply has not started.
  shown: number;
}

interface Copied {
  turnId: string;
  key: string;
}

// A few words at a time, slow enough to watch a reply arrive.
const STREAM_STEP = 6;
const STREAM_TICK_MS = 60;

// How long the reply takes to start, while a pulsing dot holds its place.
const REPLY_WAIT_MS = 700;
const COPIED_MS = 2000;

// Within this many pixels of the end counts as reading the newest turn.
const PIN_SLACK = 48;
const FALLBACK_LIST_PADDING = 32;

// Long enough for a screen reader to notice the live region emptied, so
// the same words said twice are read twice.
const ANNOUNCE_GAP_MS = 100;

const PARAGRAPH_BREAK = /\n\s*\n/u;

// A blank line starts a new paragraph; a single line break stays inside
// its paragraph.
const draftBlocks = (draft: string): BlockContent[] =>
  draft
    .split(PARAGRAPH_BREAK)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ kind: "paragraph", text }));

const sentTurn = (sent: ComposerState, id: string): Turn => ({
  attachments: sent.attachments
    .filter((item) => item.status === "ready")
    .map((item) => ({ name: item.name, size: formatSize(item.sizeBytes) })),
  blocks: toBlocks(draftBlocks(sent.draft)),
  createdAt: new Date().toISOString(),
  id,
  role: "user",
});

interface TurnState {
  status: TurnStatus;
  // Characters to show, for a reply that is streaming or was stopped.
  shown: number | undefined;
}

const statusOf = (
  turn: Turn,
  stream: Stream | null,
  stopped: Record<string, number>
): TurnState => {
  if (stream?.turnId === turn.id) {
    return { shown: stream.shown, status: "streaming" };
  }

  const cut = stopped[turn.id];

  return cut === undefined
    ? { shown: undefined, status: "done" }
    : { shown: cut, status: "stopped" };
};

const canSpeak = (): boolean => "speechSynthesis" in globalThis;

// The scroll position that puts the bottom of the turns, plus the list's
// bottom padding, at the bottom of the view.
const endOf = (scroller: HTMLElement, turns: HTMLElement): number => {
  const padding = themePixels(
    "--space-conversation-list-padding",
    FALLBACK_LIST_PADDING
  );

  return turns.offsetTop + turns.offsetHeight + padding - scroller.clientHeight;
};

// Edit puts your message in an empty composer, and after the draft in one
// that already has text, so nothing typed is lost.
const withMessage = (draft: string, message: string): string =>
  draft.trim() ? `${draft.trimEnd()}\n\n${message}` : message;

export interface ConversationViewProps {
  turns: Turn[];
  reply: (message: Turn, style: ReplyStyle) => BlockContent[];
  options: ComposerOptions;
  projects: readonly ComposerProject[];
  layout?: ConversationLayout;
  assistantName?: string;
  title?: string;
  notice?: string;
}

// An open chat: the turns scroll above the composer. Sending moves your
// message near the top of the view and leaves the view there while the
// reply arrives, so you read it from its start; once the reply runs past
// the bottom, a button jumps to the end. The layout only changes how turns
// are drawn, so switching it keeps the conversation. `reply` gives the text
// for the answer to a message you send; it streams in a few characters at
// a time. A title names the conversation and its composer for screen
// readers; give each conversation on a page its own. `notice` is a line of
// small print above the composer. While the composer fills the view, the
// turns it covers are out of reach.
export const ConversationView = ({
  turns: initialTurns,
  reply,
  options,
  projects,
  layout = DEFAULT_CONVERSATION_LAYOUT,
  assistantName = "Assistant",
  title,
  notice,
}: ConversationViewProps) => {
  const [turns, setTurns] = useState(initialTurns);
  const [stream, setStream] = useState<Stream | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [stopped, setStopped] = useState<Record<string, number>>({});
  // The latest stream, for handlers that start a new reply.
  const streamRef = useRef(stream);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const [copied, setCopied] = useState<Copied | null>(null);
  const [rated, setRated] = useState<ReadonlySet<string>>(new Set());
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const announceTimer = useRef<number | null>(null);
  const [atEnd, setAtEnd] = useState(true);
  // atEnd as of the last scroll, for the resize observer.
  const atEndRef = useRef(true);
  const [jumpFocused, setJumpFocused] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  // Space under the turns that lets your newest message scroll to the top.
  const runway = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  // Your newest message, which the view scrolls near the top once.
  const anchor = useRef<{ id: string; scrolled: boolean } | null>(null);
  const idPrefix = useId();
  const sentCount = useRef(0);

  // useId gives a prefix no caller's turn ids can share, so a reply never
  // streams into the wrong turn.
  const newTurnId = useCallback((): string => {
    sentCount.current += 1;

    return `${idPrefix}sent-${sentCount.current}`;
  }, [idPrefix]);

  // Empties the live region first, so a message the same as the last one
  // is read again.
  const announce = useCallback((text: string) => {
    if (announceTimer.current !== null) {
      window.clearTimeout(announceTimer.current);
    }

    setAnnouncement("");
    announceTimer.current = window.setTimeout(() => {
      announceTimer.current = null;
      setAnnouncement(text);
    }, ANNOUNCE_GAP_MS);
  }, []);

  useEffect(
    () => () => {
      if (announceTimer.current !== null) {
        window.clearTimeout(announceTimer.current);
      }
    },
    []
  );

  const streamingTurn = stream
    ? turns.find((turn) => turn.id === stream.turnId)
    : undefined;

  // Holds the reply's place for a moment, then reveals it a few characters
  // at a time.
  useEffect(() => {
    if (!stream || !streamingTurn) {
      return;
    }

    const timer = window.setTimeout(
      () => {
        setWaiting(false);

        if (stream.shown >= totalLength(streamingTurn.blocks)) {
          setStream(null);
          announce(`${assistantName} has replied.`);

          return;
        }

        setStream({ ...stream, shown: stream.shown + STREAM_STEP });
      },
      waiting ? REPLY_WAIT_MS : STREAM_TICK_MS
    );

    return () => window.clearTimeout(timer);
  }, [stream, streamingTurn, assistantName, waiting, announce]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(null), COPIED_MS);

    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(
    () => () => {
      if (canSpeak()) {
        window.speechSynthesis.cancel();
      }
    },
    []
  );

  const updateAtEnd = useCallback(() => {
    const element = scroller.current;
    const list = content.current;

    if (!(element && list)) {
      return;
    }

    const next = element.scrollTop >= endOf(element, list) - PIN_SLACK;
    atEndRef.current = next;
    setAtEnd(next);
  }, []);

  // Sizes the runway so your newest message can sit near the top of the
  // view, then scrolls it there once. The view does not follow the reply.
  const placeAnchor = useCallback(() => {
    const element = scroller.current;
    const list = content.current;
    const { current } = anchor;

    if (!(element && list && current)) {
      return;
    }

    const turn = list.querySelector<HTMLElement>(
      `[data-turn-id="${CSS.escape(current.id)}"]`
    );

    if (!turn) {
      return;
    }

    const top =
      turn.offsetTop -
      themePixels("--space-conversation-list-padding", FALLBACK_LIST_PADDING);

    if (runway.current) {
      runway.current.style.height = `${Math.max(0, top - endOf(element, list))}px`;
    }

    if (!current.scrolled) {
      current.scrolled = true;
      requestAnimationFrame(() => element.scrollTo({ top }));
    }
  }, []);

  // Opens at the end of the conversation.
  useLayoutEffect(() => {
    const element = scroller.current;
    const list = content.current;

    if (element && list) {
      element.scrollTop = endOf(element, list);
    }
  }, []);

  // Turns grow as a reply streams and the view shrinks as the composer
  // grows; either can move the end out of view. A view that showed the end
  // keeps showing it as it shrinks, so a growing composer never hides the
  // last reply. Turns that grow do not move the view.
  useEffect(() => {
    const element = scroller.current;
    const list = content.current;

    if (!(element && list)) {
      return;
    }

    let height = element.clientHeight;

    const observer = new ResizeObserver(() => {
      const shrunk = height - element.clientHeight;
      height = element.clientHeight;

      if (shrunk > 0 && atEndRef.current) {
        element.scrollTop += shrunk;
      }

      placeAnchor();
      updateAtEnd();
    });

    observer.observe(list);
    observer.observe(element);

    return () => observer.disconnect();
  }, [placeAnchor, updateAtEnd]);

  // Scrolls at once. Focus stays on the button for the keyboard; a click
  // leaves it, so the button can go once the end is in view.
  const jumpToEnd = (event: MouseEvent<HTMLButtonElement>) => {
    const element = scroller.current;
    const list = content.current;

    if (element && list) {
      element.scrollTo({ top: endOf(element, list) });
    }

    if (event.detail > 0) {
      event.currentTarget.blur();
    }
  };

  // Starting a new reply ends the one streaming, which keeps what it has
  // shown, just as Stop does.
  const interruptStream = useCallback((nextTurnId: string) => {
    const { current } = streamRef;

    if (current && current.turnId !== nextTurnId) {
      setStopped((cuts) => ({ ...cuts, [current.turnId]: current.shown }));
    }
  }, []);

  const startReply = (turnId: string) => {
    interruptStream(turnId);
    setStopped((cuts) =>
      Object.fromEntries(Object.entries(cuts).filter(([id]) => id !== turnId))
    );
    setWaiting(true);
    setStream({ shown: 0, turnId });
    announce(`${assistantName} is writing a reply.`);
  };

  const stop = () => {
    if (!stream) {
      return;
    }

    setStopped((cuts) => ({ ...cuts, [stream.turnId]: stream.shown }));
    setStream(null);
    setWaiting(false);
    announce("Reply stopped. What it wrote so far stays.");
  };

  const copy = async (turnId: string, key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ key, turnId });
      announce("Copied.");
    } catch {
      announce("Copying failed. Select the text and copy it by hand.");
    }
  };

  // Share and Read aloud take the blocks on screen, so a stopped reply
  // shares only what it showed.
  const share = async (turnId: string, blocks: Block[]) => {
    const text = plainText(blocks);

    if ("share" in navigator) {
      try {
        await navigator.share({ text });
      } catch {
        // Closing the share sheet is not an error worth announcing.
      }

      return;
    }

    await copy(turnId, "turn", text);
    announce("Copied, ready to paste wherever you share it.");
  };

  const readAloud = (turnId: string, blocks: Block[]) => {
    if (!canSpeak()) {
      return;
    }

    window.speechSynthesis.cancel();

    if (speaking === turnId) {
      setSpeaking(null);

      return;
    }

    const utterance = new SpeechSynthesisUtterance(bareText(blocks));
    utterance.addEventListener("end", () =>
      setSpeaking((current) => (current === turnId ? null : current))
    );
    setSpeaking(turnId);
    window.speechSynthesis.speak(utterance);
  };

  const rate = (turnId: string) => {
    const next = new Set(rated);
    const on = !next.has(turnId);

    if (on) {
      next.add(turnId);
    } else {
      next.delete(turnId);
    }

    setRated(next);
    announce(on ? "Marked as helpful." : "No longer marked as helpful.");
  };

  const onSent = useCallback(
    (sent: ComposerState) => {
      const message = sentTurn(sent, newTurnId());

      const answer: Turn = {
        attachments: [],
        blocks: toBlocks(reply(message, "same")),
        createdAt: new Date().toISOString(),
        id: newTurnId(),
        role: "assistant",
      };

      interruptStream(answer.id);
      anchor.current = { id: message.id, scrolled: false };
      setTurns((list) => [...list, message, answer]);
      setWaiting(true);
      setStream({ shown: 0, turnId: answer.id });
      announce(`Sent. ${assistantName} is writing a reply.`);
    },
    [interruptStream, reply, assistantName, newTurnId, announce]
  );

  const composer = useComposerController(onSent, initialComposer(options));
  const { Turn: TurnView, listClassName } = LAYOUT_PARTS[layout];

  const edit = (turn: Turn) => {
    const draft = withMessage(composer.state.draft, plainText(turn.blocks));
    composer.dispatch({ draft, type: "draftChanged" });

    const field = view.current?.querySelector<HTMLTextAreaElement>(
      '[data-slot="composer-field"]'
    );

    field?.focus();
    requestAnimationFrame(() =>
      field?.setSelectionRange(draft.length, draft.length)
    );
  };

  const showJump = (!atEnd || jumpFocused) && !composerExpanded;

  return (
    <div
      className="@container/conversation relative flex h-full min-h-0 flex-col"
      data-layout={layout}
      data-slot="conversation-view"
      ref={view}
    >
      {title ? <h1 className="sr-only">{title}</h1> : null}
      <div
        className="relative flex min-h-40 flex-1 flex-col"
        inert={composerExpanded}
      >
        <section
          aria-label={title ?? "Conversation"}
          className="relative min-h-0 flex-1 overflow-y-auto px-(--space-conversation-gutter) py-(--space-conversation-list-padding) focus-visible:-outline-offset-2"
          data-slot="message-scroller"
          onScroll={updateAtEnd}
          ref={scroller}
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the message list scrolls, so it must be reachable by keyboard
          tabIndex={0}
        >
          <div
            className={`mx-auto flex w-full max-w-(--size-message-column) flex-col ${listClassName}`}
            ref={content}
          >
            {turns.map((turn) => {
              const { status, shown } = statusOf(turn, stream, stopped);
              const previous = turns[turns.indexOf(turn) - 1];

              const blocks =
                shown === undefined ? turn.blocks : reveal(turn.blocks, shown);

              return (
                <div data-turn-id={turn.id} key={turn.id}>
                  <TurnView
                    attachments={turn.attachments}
                    blocks={blocks}
                    canSpeak={canSpeak()}
                    copied={copied?.turnId === turn.id ? copied.key : null}
                    createdAt={turn.createdAt}
                    headingId={`${idPrefix}-${turn.id}`}
                    onCopy={(key, text) => copy(turn.id, key, text)}
                    onEdit={() => edit(turn)}
                    onRate={() => rate(turn.id)}
                    onReadAloud={() => readAloud(turn.id, blocks)}
                    onRetry={(style) => {
                      if (previous) {
                        setTurns((list) =>
                          list.map((item) =>
                            item.id === turn.id
                              ? {
                                  ...item,
                                  blocks: toBlocks(reply(previous, style)),
                                }
                              : item
                          )
                        );
                      }

                      startReply(turn.id);
                    }}
                    onShare={() => share(turn.id, blocks)}
                    onStop={stop}
                    rated={rated.has(turn.id)}
                    role={turn.role}
                    speaker={turn.role === "user" ? "You" : assistantName}
                    speaking={speaking === turn.id}
                    status={status}
                  />
                </div>
              );
            })}
          </div>
          <div aria-hidden="true" ref={runway} />
        </section>
      </div>
      {/* Expanding the composer lifts it over the conversation, to a fixed
          distance below the top of the view. */}
      <div className="group/dock has-data-expanded:bg-background flex shrink-0 flex-col items-center px-(--space-conversation-gutter) pb-(--space-composer-bottom) has-data-expanded:absolute has-data-expanded:inset-x-0 has-data-expanded:top-0 has-data-expanded:bottom-0 has-data-expanded:z-20 has-data-expanded:pt-(--space-composer-expanded-top)">
        {notice ? (
          <p className="text-subtle-foreground mb-(--space-disclaimer-gap) text-center text-(length:--text-footnote-size) leading-(--text-footnote-leading) group-has-data-expanded/dock:absolute group-has-data-expanded/dock:inset-x-0 group-has-data-expanded/dock:top-[calc(var(--space-composer-expanded-top)-var(--space-disclaimer-gap)-var(--text-footnote-leading))]">
            {notice}
          </p>
        ) : null}
        <h2 className="sr-only">New message</h2>
        <div className="relative flex min-h-0 w-full max-w-(--size-message-column) flex-1 flex-col">
          {showJump ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-[calc(100%+var(--space-jump-offset))] z-10 flex justify-center">
              <IconButton
                className="pointer-events-auto"
                icon={ArrowDownIcon}
                kind="jump"
                label="Scroll to the newest message"
                onBlur={() => setJumpFocused(false)}
                onClick={jumpToEnd}
                onFocus={() => setJumpFocused(true)}
                tipSide="top"
              />
            </div>
          ) : null}
          <Composer
            conversation
            dispatch={composer.dispatch}
            expandable
            handlers={composer.handlers}
            label={title ? `Message in ${title}` : "Message"}
            layout="inline"
            mode="chat"
            onExpandedChange={setComposerExpanded}
            onStopReply={stream ? stop : undefined}
            options={options}
            projects={projects}
            replyStatus={waiting ? "waiting" : "streaming"}
            state={composer.state}
            typeToFocus
          />
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
};
