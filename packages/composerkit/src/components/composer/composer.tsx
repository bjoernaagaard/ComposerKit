// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import {
  FileIcon,
  ImageIcon,
  Maximize2Icon,
  MicIcon,
  Minimize2Icon,
  PlusIcon,
  RotateCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode, Ref } from "react";

import {
  addOptionId,
  ComposerAddMenu,
} from "@/components/composer/composer-add-menu";
import type { ComposerAddItem } from "@/components/composer/composer-add-menu";
import {
  ComposerAttachments,
  failureNotice,
} from "@/components/composer/composer-attachments";
import {
  focusCameFromKeyboard,
  useAddMenu,
  useFieldSize,
  useStopSettle,
  useTypeToFocus,
} from "@/components/composer/composer-hooks";
import {
  ModelMenu,
  PermissionMenu,
} from "@/components/composer/composer-menus";
import { PrimaryAction } from "@/components/composer/composer-primary";
import type { ComposerReplyStatus } from "@/components/composer/composer-primary";
import { ComposerTray } from "@/components/composer/composer-tray";
import { canSend } from "@/components/composer/machine";
import type {
  ComposerAction,
  ComposerState,
} from "@/components/composer/machine";
import type {
  ComposerOptions,
  ComposerProject,
} from "@/components/composer/options";
import type { ComposerHandlers } from "@/components/composer/use-composer-controller";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

export type ComposerMode = "chat" | "work";

export type ComposerLayout = "stacked" | "inline" | "roomy";

export const COMPOSER_LAYOUTS: ComposerLayout[] = [
  "stacked",
  "inline",
  "roomy",
];

// stacked: the text on top, a row of controls below it and the tray hanging
// underneath. The default.
// inline: one row while the text fits beside the controls. A line break, or
// text too long for the row, moves the text to its own row on top and the
// controls to a row below, as stacked has them.
// roomy: taller, with the tray as the last row inside the box.
const SURFACE_CLASSES: Record<ComposerLayout, string> = {
  inline: "min-h-(--size-composer-inline-min-height)",
  roomy: "",
  stacked: "min-h-(--size-composer-min-height)",
};

const PLACEHOLDER: Record<ComposerMode, string> = {
  chat: "Send a message",
  work: "Describe a task",
};

const PHASE_ANNOUNCEMENT = {
  failed: "The message wasn’t sent.",
  idle: "",
  sending: "Sending.",
} as const;

// The expand control shows from this many lines of wrapped text, or as soon
// as the text holds a line break.
const EXPAND_FROM_LINES = 5;

// What the add button always offers. The composer opens a file picker for
// each.
const BUILT_IN_ADD_ITEMS: readonly ComposerAddItem[] = [
  {
    description: "Documents, code or any other file",
    icon: FileIcon,
    id: "files",
    label: "Files",
  },
  {
    description: "Photos and screenshots",
    icon: ImageIcon,
    id: "images",
    label: "Images",
  },
];

const NO_ADD_ITEMS: readonly ComposerAddItem[] = [];

// Docked in a conversation, the one-row field is a taller box with the text
// at its top, so a click below the line still lands in it. The text stays
// where it is in a one-line box: the box starts the inset above it.
const DOCKED_ONE_ROW_FIELD =
  "min-h-(--size-conversation-composer-text-height) pt-(--space-conversation-composer-text-inset) mt-[calc(var(--size-conversation-composer-text-height)-2*var(--space-conversation-composer-text-inset)-var(--text-composer-leading))]";

const fieldClasses = ({
  twoRows,
  layout,
  conversation,
  showExpand,
  expanded,
}: {
  twoRows: boolean;
  layout: ComposerLayout;
  conversation: boolean;
  showExpand: boolean;
  expanded: boolean;
}): string =>
  cn(
    "text-foreground placeholder:text-subtle-foreground resize-none [scrollbar-width:thin] overflow-y-auto bg-transparent p-0 text-(length:--text-composer-size) leading-(--text-composer-leading) outline-none focus-visible:outline-none",
    twoRows
      ? "mx-(--space-composer-padding-x) mt-(--space-composer-two-row-top) max-h-[calc(var(--size-composer-max-height)-var(--space-composer-two-row-top)-var(--space-composer-row-gap)-var(--size-composer-control)-var(--space-composer-footer-padding))] min-h-(--size-composer-two-row-text-min-height)"
      : "min-w-0 self-center",
    conversation && !twoRows && DOCKED_ONE_ROW_FIELD,
    layout === "roomy" && "mt-4 min-h-(--size-composer-roomy-text-min-height)",
    showExpand &&
      "mr-[calc(var(--space-composer-padding-x)+var(--space-composer-expand-reserve))]",
    expanded && "max-h-none min-h-0 flex-1"
  );

// A click in the field shows only the caret. Focus that came from the
// keyboard, or a field that is read-only and so shows no caret, rings the
// box the way a focused button is ringed.
const surfaceClasses = ({
  twoRows,
  layout,
  conversation,
  expanded,
}: {
  twoRows: boolean;
  layout: ComposerLayout;
  conversation: boolean;
  expanded: boolean;
}): string =>
  cn(
    "bg-card text-card-foreground inset-ring-border outline-ring relative z-10 rounded-(--radius-composer) shadow-(--shadow-composer) inset-ring-(length:--border-panel) has-[[data-slot=composer-field]:read-only:focus]:outline-(length:--border-focus-width) has-[[data-slot=composer-field]:read-only:focus]:outline-offset-(--border-focus-offset) has-[[data-slot=composer-field]:read-only:focus]:outline-solid data-keyboard-focus:outline-(length:--border-focus-width) data-keyboard-focus:outline-offset-(--border-focus-offset) data-keyboard-focus:outline-solid",
    twoRows
      ? "flex flex-col"
      : "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-(--space-composer-add-gap) px-(--space-composer-footer-padding)",
    SURFACE_CLASSES[layout],
    conversation &&
      "min-h-(--size-conversation-composer-min-height) rounded-(--radius-conversation-composer)",
    expanded && "flex-1"
  );

const dictationLabel = (supported: boolean, dictating: boolean): string => {
  if (!supported) {
    return "This browser can’t take dictation";
  }

  return dictating ? "Stop dictating" : "Dictate";
};

const SendFailure = ({ onRetry }: { onRetry: () => void }) => (
  <div className="text-destructive mx-3 mt-2 flex items-center gap-2 text-(length:--text-caption-size) leading-(--text-caption-leading)">
    <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
    <span className="min-w-0 flex-1">
      There’s no connection, so nothing was sent. Your draft is still here.
    </span>
    <Button onClick={onRetry} size="sm" variant="ghost">
      <RotateCwIcon aria-hidden="true" data-icon="inline-start" />
      Try again
    </Button>
  </div>
);

const FilePicker = ({
  ref,
  accept,
  onFiles,
}: {
  ref: Ref<HTMLInputElement>;
  accept?: string;
  onFiles: (files: File[]) => void;
}) => (
  <input
    accept={accept}
    aria-hidden="true"
    className="hidden"
    multiple
    onChange={(event) => {
      onFiles([...(event.target.files ?? [])]);
      event.target.value = "";
    }}
    ref={ref}
    tabIndex={-1}
    type="file"
  />
);

// Lets the box fill its container, and back. It sits in the top right
// corner and comes last in the tab order. As a toggle it keeps one name and
// reports its state with aria-pressed; the tooltip says what a press does.
const ExpandToggle = ({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) => {
  const Glyph = expanded ? Minimize2Icon : Maximize2Icon;

  return (
    <div className="absolute top-(--space-composer-expand-inset) right-(--space-composer-expand-inset)">
      <Tip label={expanded ? "Exit full height" : "Full height"} side="top">
        <Button
          aria-label="Full height"
          aria-pressed={expanded}
          className="h-(--size-composer-expand-height) w-(--size-composer-expand-width)"
          data-kind="composer"
          data-slot="icon-button"
          onClick={onToggle}
          size="icon-composer"
          variant="inset"
        >
          <Glyph aria-hidden="true" />
        </Button>
      </Tip>
    </div>
  );
};

const Notices = ({
  state,
  dispatch,
  handlers,
  onEmptied,
}: {
  state: ComposerState;
  dispatch: (action: ComposerAction) => void;
  handlers: ComposerHandlers;
  onEmptied: () => void;
}) => {
  if (state.attachments.length === 0 && state.phase !== "failed") {
    return null;
  }

  return (
    <div className="col-span-full">
      <ComposerAttachments
        attachments={state.attachments}
        dispatch={dispatch}
        onEmptied={onEmptied}
        onRetry={handlers.handleRetryUpload}
      />
      {state.phase === "failed" ? (
        <SendFailure onRetry={handlers.handleSubmit} />
      ) : null}
    </div>
  );
};

// The add button, and in Work mode the permission menu.
const LeadingControls = ({
  ref,
  state,
  dispatch,
  options,
  mode,
  layout,
  listId,
  menuOpen,
  onAdd,
}: {
  ref: Ref<HTMLDivElement>;
  state: ComposerState;
  dispatch: (action: ComposerAction) => void;
  options: ComposerOptions;
  mode: ComposerMode;
  layout: ComposerLayout;
  listId: string;
  menuOpen: boolean;
  onAdd: () => void;
}) => (
  <div className="flex items-center gap-(--space-composer-add-gap)" ref={ref}>
    <IconButton
      aria-controls={menuOpen ? listId : undefined}
      aria-expanded={menuOpen}
      aria-haspopup="listbox"
      disabled={state.phase === "sending"}
      icon={PlusIcon}
      kind="composer"
      label="Add files and more"
      onClick={onAdd}
      // The field keeps focus, so the list stays tied to it.
      onMouseDown={(event) => event.preventDefault()}
      tipSide="top"
    />
    {mode === "work" ? (
      <PermissionMenu
        compact={layout === "inline"}
        dispatch={dispatch}
        permission={state.permission}
        permissions={options.permissions}
      />
    ) : null}
  </div>
);

// The model menu, dictation and the round button passed as children.
const TrailingControls = ({
  ref,
  state,
  dispatch,
  options,
  handlers,
  layout,
  dictationBlocked,
  children,
}: {
  ref: Ref<HTMLDivElement>;
  state: ComposerState;
  dispatch: (action: ComposerAction) => void;
  options: ComposerOptions;
  handlers: ComposerHandlers;
  layout: ComposerLayout;
  dictationBlocked: boolean;
  children: ReactNode;
}) => (
  <div className="ml-auto flex items-center" ref={ref}>
    <ModelMenu
      compact={layout === "inline"}
      dispatch={dispatch}
      effort={state.effort}
      model={state.model}
      options={options}
    />
    <IconButton
      aria-disabled={handlers.dictationSupported ? undefined : "true"}
      aria-pressed={state.dictating}
      className="mr-(--space-composer-trailing-gap)"
      disabled={dictationBlocked}
      icon={MicIcon}
      kind="composer"
      label={dictationLabel(handlers.dictationSupported, state.dictating)}
      onClick={
        handlers.dictationSupported ? handlers.handleToggleDictation : undefined
      }
      tipSide="top"
    />
    {children}
  </div>
);

const placeholderFor = (mode: ComposerMode, dictating: boolean): string =>
  dictating ? "Listening…" : PLACEHOLDER[mode];

const activeOptionId = (
  listId: string,
  menu: { isOpen: boolean; highlighted: string | undefined }
): string | undefined =>
  menu.isOpen && menu.highlighted
    ? addOptionId(listId, menu.highlighted)
    : undefined;

// Two rows once the text holds a line break or outgrows the one row, and
// always while expanded. The expand control shows for long text, and stays
// while expanded so the box can always be collapsed.
const arrange = ({
  layout,
  expandable,
  expanded,
  hardBreak,
  measure,
}: {
  layout: ComposerLayout;
  expandable: boolean;
  expanded: boolean;
  hardBreak: boolean;
  measure: { overflows: boolean; lines: number };
}) => {
  const twoRows =
    expanded || layout !== "inline" || hardBreak || measure.overflows;

  const longText = hardBreak || measure.lines >= EXPAND_FROM_LINES;

  return {
    showExpand: expandable && (expanded || (twoRows && longText)),
    twoRows,
  };
};

const rootClasses = (conversation: boolean, expanded: boolean): string =>
  cn(
    "@container/composer relative w-full",
    conversation
      ? "max-w-(--size-message-column)"
      : "max-w-(--size-composer-width)",
    expanded && "flex h-full flex-col"
  );

// One row: controls on both sides of the text. Two rows: the text on top
// and the controls below it. The field keeps its place among the box's
// children in both, so switching never remounts it and focus stays put.
const Arrangement = ({
  twoRows,
  field,
  leading,
  trailing,
}: {
  twoRows: boolean;
  field: ReactNode;
  leading: ReactNode;
  trailing: ReactNode;
}) =>
  twoRows ? (
    <>
      {field}
      <div
        className="mt-(--space-composer-row-gap) flex items-center px-(--space-composer-footer-padding) pb-(--space-composer-footer-padding)"
        data-slot="composer-controls"
        key="controls"
      >
        {leading}
        {trailing}
      </div>
    </>
  ) : (
    <>
      {leading}
      {field}
      {trailing}
    </>
  );

type TrayPlace = "inside" | "below";

// Work mode's tray: inside the box in the roomy layout, below it otherwise.
const WorkTray = ({
  where,
  mode,
  layout,
  state,
  projects,
  dispatch,
  onFiles,
}: {
  where: TrayPlace;
  mode: ComposerMode;
  layout: ComposerLayout;
  state: ComposerState;
  projects: readonly ComposerProject[];
  dispatch: (action: ComposerAction) => void;
  onFiles: () => void;
}) => {
  const embedded = layout === "roomy";

  if (mode !== "work" || embedded !== (where === "inside")) {
    return null;
  }

  return (
    <ComposerTray
      dispatch={dispatch}
      embedded={embedded}
      onFiles={onFiles}
      projectId={state.projectId}
      projects={projects}
      sending={state.phase === "sending"}
    />
  );
};

export interface ComposerProps {
  state: ComposerState;
  dispatch: (action: ComposerAction) => void;
  handlers: ComposerHandlers;
  mode: ComposerMode;
  options: ComposerOptions;
  projects: readonly ComposerProject[];
  layout?: ComposerLayout;
  conversation?: boolean;
  expandable?: boolean;
  typeToFocus?: boolean;
  addItems?: readonly ComposerAddItem[];
  label?: string;
  onStopReply?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
  replyStatus?: ComposerReplyStatus;
}

// The message box: text, attachments, the add menu, model and permission
// menus, and the send button. Work mode adds the tray. State lives in the
// caller, usually through useComposerController.
//
// Enter sends and Shift+Enter starts a new line. While a reply runs,
// Escape stops it, and otherwise leaves the draft alone. With typeToFocus,
// a letter typed anywhere on the page outside a text field, an open menu or
// a modal dialog moves focus here and lands in the field. expandable adds a
// control that lets the box fill its container; the container decides how
// tall that is, and onExpandedChange tells it when that changes, so it can
// take what the box covers out of reach. While expanded the box keeps two
// rows and the control, whatever the text. addItems adds to what the add
// button offers. label names the box for screen readers; give each box on
// a page its own.
export const Composer = ({
  state,
  dispatch,
  handlers,
  mode,
  options,
  projects,
  layout = "stacked",
  conversation = false,
  expandable = false,
  typeToFocus = false,
  addItems = NO_ADD_ITEMS,
  label = "Message",
  onStopReply,
  onExpandedChange,
  replyStatus,
}: ComposerProps) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const { settle, settling } = useStopSettle();
  const sending = state.phase === "sending";
  const hardBreak = state.draft.includes("\n");

  const { field, surface, leading, trailing, measure } = useFieldSize({
    draft: state.draft,
    expanded,
    oneRowPossible: layout === "inline" && !hardBreak && !expanded,
  });

  const focusField = useCallback(() => field.current?.focus(), [field]);

  const changeExpanded = (next: boolean) => {
    setExpanded(next);
    onExpandedChange?.(next);
  };

  const { twoRows, showExpand } = arrange({
    expandable,
    expanded,
    hardBreak,
    layout,
    measure,
  });

  useTypeToFocus(typeToFocus, field, dispatch);

  const addMenu = useAddMenu({
    dispatch,
    draft: state.draft,
    field,
    items: [...BUILT_IN_ADD_ITEMS, ...addItems],
    run: (item) => {
      focusField();

      if (item.onSelect) {
        item.onSelect();
      } else if (item.id === "images") {
        imageInput.current?.click();
      } else {
        fileInput.current?.click();
      }
    },
  });

  const stopReply = onStopReply
    ? () => {
        onStopReply();
        settle();
        focusField();
      }
    : undefined;

  const submit = () => {
    if (canSend(state) && expanded) {
      changeExpanded(false);
    }

    handlers.handleSubmit();
  };

  // A mouse click leaves focus on the page, from where typing still reaches
  // the field. Pressing Send from the keyboard returns focus to the field,
  // because the button turns disabled.
  const sendFromButton = (event: MouseEvent<HTMLButtonElement>) => {
    submit();

    if (event.detail === 0) {
      focusField();
    } else {
      event.currentTarget.blur();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || addMenu.handleKey(event)) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape" && stopReply) {
      event.preventDefault();
      stopReply();
    }
  };

  const placeholder = placeholderFor(mode, state.dictating);
  const rows = twoRows ? "two" : "one";

  // The field is a text box, which cannot take a combobox role, so the
  // highlighted option is announced through the live region below as well
  // as through aria-activedescendant.
  const textarea = (
    <textarea
      aria-activedescendant={activeOptionId(listId, addMenu)}
      aria-controls={addMenu.shown.length > 0 ? listId : undefined}
      aria-label={placeholder}
      className={fieldClasses({
        conversation,
        expanded,
        layout,
        showExpand,
        twoRows,
      })}
      data-slot="composer-field"
      key="field"
      onBlur={() => {
        setKeyboardFocus(false);
        addMenu.handleClose();
      }}
      onChange={(event) => {
        addMenu.handleEdit(event.target);
        dispatch({ draft: event.target.value, type: "draftChanged" });
      }}
      onFocus={() => setKeyboardFocus(focusCameFromKeyboard())}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      readOnly={sending}
      ref={field}
      rows={1}
      value={state.draft}
    />
  );

  const leadingControls = (
    <LeadingControls
      dispatch={dispatch}
      key={`leading-${rows}`}
      layout={layout}
      listId={listId}
      menuOpen={addMenu.isOpen}
      mode={mode}
      onAdd={() => {
        addMenu.handleToggle();
        focusField();
      }}
      options={options}
      ref={leading}
      state={state}
    />
  );

  const trailingControls = (
    <TrailingControls
      dispatch={dispatch}
      dictationBlocked={onStopReply !== undefined}
      handlers={handlers}
      key={`trailing-${rows}`}
      layout={layout}
      options={options}
      ref={trailing}
      state={state}
    >
      <PrimaryAction
        conversation={conversation}
        onSend={sendFromButton}
        onStopReply={stopReply}
        onStopSending={handlers.handleStop}
        replyStatus={replyStatus}
        settling={settling}
        state={state}
      />
    </TrailingControls>
  );

  const tray = (where: TrayPlace) => (
    <WorkTray
      dispatch={dispatch}
      layout={layout}
      mode={mode}
      onFiles={() => fileInput.current?.click()}
      projects={projects}
      state={state}
      where={where}
    />
  );

  return (
    <div
      className={rootClasses(conversation, expanded)}
      data-expanded={expanded ? "" : undefined}
      data-layout={layout}
      data-rows={rows}
      data-slot="composer"
    >
      {addMenu.isOpen ? (
        <ComposerAddMenu
          highlighted={addMenu.highlighted}
          id={listId}
          items={addMenu.shown}
          onHighlight={addMenu.handleHighlight}
          onRun={addMenu.handleChoose}
        />
      ) : null}
      <form
        aria-label={label}
        className={surfaceClasses({ conversation, expanded, layout, twoRows })}
        data-keyboard-focus={keyboardFocus ? "" : undefined}
        data-slot="composer-surface"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        ref={surface}
      >
        <Notices
          dispatch={dispatch}
          handlers={handlers}
          onEmptied={focusField}
          state={state}
        />
        <Arrangement
          field={textarea}
          leading={leadingControls}
          trailing={trailingControls}
          twoRows={twoRows}
        />
        {showExpand ? (
          <ExpandToggle
            expanded={expanded}
            key="expand"
            onToggle={() => {
              changeExpanded(!expanded);
              focusField();
            }}
          />
        ) : null}
        {tray("inside")}
        <FilePicker onFiles={handlers.handleFiles} ref={fileInput} />
        <FilePicker
          accept="image/*"
          onFiles={handlers.handleFiles}
          ref={imageInput}
        />
      </form>
      {tray("below")}
      <p aria-live="polite" className="sr-only">
        <span>{PHASE_ANNOUNCEMENT[state.phase]}</span>{" "}
        <span>{failureNotice(state.attachments)}</span>{" "}
        <span>{addMenu.announcement}</span>
      </p>
    </div>
  );
};
