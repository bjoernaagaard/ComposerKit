// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import {
  ChevronDownIcon,
  ListFilterIcon,
  PanelLeftIcon,
  PinIcon,
  PlusIcon,
  RotateCwIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import { MODE_TOGGLE_APPEARANCES, ModeToggle } from "@/app/mode-toggle";
import type { ModeToggleAppearance } from "@/app/mode-toggle";
import { ConversationRow, ROW_DENSITIES } from "@/app/sidebar/conversation-row";
import type { RowDensity } from "@/app/sidebar/conversation-row";
import { TAB_APPEARANCES, TabStrip } from "@/app/title-bar";
import type { TabAppearance } from "@/app/title-bar";
import { COMPOSER_LAYOUTS, Composer } from "@/components/composer/composer";
import type {
  ComposerLayout,
  ComposerMode,
} from "@/components/composer/composer";
import { initialComposer } from "@/components/composer/machine";
import { useComposerController } from "@/components/composer/use-composer-controller";
import { ConversationView } from "@/components/conversation/conversation-view";
import { CONVERSATION_LAYOUTS } from "@/components/conversation/layouts";
import type { ConversationLayout } from "@/components/conversation/layouts";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  MENU_DENSITIES,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import type { MenuDensity } from "@/components/ui/menu";
import { PopupLayer } from "@/components/ui/popup-layer";
import { TipProvider } from "@/components/ui/tip";
import { COMPOSER_OPTIONS, DEFAULT_CHOICES } from "@/content/catalog";
import { PLACEHOLDER_REPLY, SAMPLE_TURNS } from "@/content/conversation";
import {
  SAMPLE_CONVERSATIONS,
  SAMPLE_NOW,
  SAMPLE_PROJECTS,
} from "@/content/sample";
import { DirectionSelector } from "@/designs/direction";
import { SCHEMES, setScheme } from "@/theme/apply";
import { useTheme } from "@/theme/use-theme";

import tokens from "../../../../crates/composerkit-theme/design-tokens.json";

const ROW_SAMPLE_SIZE = 8;

const DENSITY_NOTES: Record<RowDensity, string> = {
  compact: "24px rows and 13px text. About a quarter more chats fit.",
  "two-line": "44px rows. Adds how long ago and which project.",
  measured: "30px rows and 14px text. The default.",
};

const Section = ({
  title,
  option,
  children,
}: {
  title: string;
  option: string;
  children: ReactNode;
}) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2
        className="text-foreground flex items-baseline gap-2 text-(length:--text-brand-size) leading-(--text-brand-leading) font-(--weight-semibold)"
        id={headingId}
      >
        {title}
        <code className="text-subtle-foreground font-mono text-(length:--text-caption-size) font-normal">
          {option}
        </code>
      </h2>
      {children}
    </section>
  );
};

const Example = ({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) => (
  <figure className="flex min-w-0 flex-col gap-2">
    <figcaption className="flex flex-col">
      <code className="text-foreground font-mono text-(length:--text-caption-size)">
        {label}
      </code>
      {note ? (
        <span className="text-subtle-foreground text-(length:--text-caption-size) leading-(--text-caption-leading)">
          {note}
        </span>
      ) : null}
    </figcaption>
    {children}
  </figure>
);

const RowExamples = () => {
  const [conversations, setConversations] = useState(() =>
    SAMPLE_CONVERSATIONS.slice(0, ROW_SAMPLE_SIZE)
  );

  const [activeId, setActiveId] = useState(conversations[1]?.id ?? null);
  const removed = ROW_SAMPLE_SIZE - conversations.length;
  const restore = useRef<HTMLButtonElement>(null);
  const lists = useRef<HTMLDivElement>(null);
  const restoring = useRef(false);

  // The focused control is gone after archiving or restoring, so focus moves
  // to the way back, or to the first restored row.
  useEffect(() => {
    if (removed > 0) {
      restore.current?.focus();
    } else if (restoring.current) {
      restoring.current = false;
      lists.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [removed]);

  return (
    <>
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,var(--size-sidebar)),1fr))] gap-6"
        ref={lists}
      >
        {ROW_DENSITIES.map((density) => (
          <Example
            key={density}
            label={`density="${density}"`}
            note={DENSITY_NOTES[density]}
          >
            <ul className="bg-sidebar border-border flex max-w-(--size-sidebar) flex-col gap-(--size-row-gap) rounded-(--radius-menu) border-(length:--border-hairline) p-(--space-sidebar-padding)">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <ConversationRow
                    active={conversation.id === activeId}
                    conversation={conversation}
                    density={density}
                    now={SAMPLE_NOW}
                    onArchive={() =>
                      setConversations((list) =>
                        list.filter((item) => item.id !== conversation.id)
                      )
                    }
                    onOpen={() => setActiveId(conversation.id)}
                    onTogglePin={() =>
                      setConversations((list) =>
                        list.map((item) =>
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
          </Example>
        ))}
      </div>
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

const BUTTON_VARIANTS = [
  {
    note: "The one action a view asks for.",
    variant: "default",
  },
  {
    note: "A second choice that sits beside the main one.",
    variant: "outline",
  },
  {
    note: "Small actions inside content, such as Undo or Try again.",
    variant: "ghost",
  },
] as const;

const BUTTON_SIZES = ["sm", "default", "lg"] as const;

const ICON_BUTTON_KINDS = [
  { icon: PanelLeftIcon, kind: "small", label: "Hide sidebar" },
  { icon: ListFilterIcon, kind: "control", label: "Filter chats" },
  { icon: PlusIcon, kind: "pill", label: "Attach files" },
  { icon: PinIcon, kind: "row", label: "Pin chat" },
] as const;

const LAYOUT_NOTES: Record<ComposerLayout, string> = {
  inline: "One row that grows as you type. Shortest at rest.",
  roomy: "Taller, with the Work tray inside the box.",
  stacked: "Text on top, controls below, tray hanging under. The default.",
};

// A message sent here has nowhere to go, so the composer just clears.
const ignoreSent = () => null;

const placeholderReply = () => PLACEHOLDER_REPLY;

const ComposerExample = ({ layout }: { layout: ComposerLayout }) => {
  const composer = useComposerController(
    ignoreSent,
    initialComposer(COMPOSER_OPTIONS, DEFAULT_CHOICES)
  );

  return (
    <Composer
      dispatch={composer.dispatch}
      handlers={composer.handlers}
      label={`Message, ${layout} layout`}
      layout={layout}
      mode="work"
      options={COMPOSER_OPTIONS}
      projects={SAMPLE_PROJECTS}
      state={composer.state}
    />
  );
};

const CONVERSATION_NOTES: Record<ConversationLayout, string> = {
  bubbles: "Both sides in bubbles, the reply outlined. Fewest turns fit.",
  document: "Your message in a bubble, the reply as plain text. The default.",
  transcript: "No bubbles. One row per turn with the speaker. Most turns fit.",
};

const MENU_NOTES: Record<MenuDensity, string> = {
  compact: "25px items and tighter corners. Fits long lists.",
  regular: "29px items. The default.",
};

// The same items in each density, so only the spacing differs.
const MenuExample = ({ density }: { density: MenuDensity }) => {
  const [effort, setEffort] = useState<string>(DEFAULT_CHOICES.effort);

  return (
    <MenuRoot>
      <MenuTrigger
        render={
          <Button variant="outline">
            Open the {density} menu
            <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
          </Button>
        }
      />
      <MenuContent density={density} label={`${density} menu`}>
        <MenuRadioGroup label="Effort" onValueChange={setEffort} value={effort}>
          {COMPOSER_OPTIONS.efforts.map((item) => (
            <MenuRadioItem key={item.id} label={item.label} value={item.id} />
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem label="Pin chat" />
        <MenuItem
          description="You can undo it right away"
          label="Archive chat"
        />
      </MenuContent>
    </MenuRoot>
  );
};

const TOGGLE_NOTES: Record<ModeToggleAppearance, string> = {
  pill: "A round track with a sliding thumb. The default.",
  segmented: "Squarer, with the thumb inside the track. Fits toolbars.",
  underline: "No track. A bar slides under the chosen mode.",
};

const ModeToggleExample = ({
  appearance,
}: {
  appearance: ModeToggleAppearance;
}) => {
  const [mode, setMode] = useState<ComposerMode>("work");

  return <ModeToggle appearance={appearance} mode={mode} onChange={setMode} />;
};

const TAB_NOTES: Record<TabAppearance, string> = {
  filled: "The open tab is a raised box. The default.",
  underline: "No box. A bar sits under the open tab.",
};

const TabsExample = ({ appearance }: { appearance: TabAppearance }) => {
  // Ids carry the appearance so the two strips never share a tab id.
  const tabs = SAMPLE_CONVERSATIONS.slice(0, 3).map((conversation) => ({
    id: `${appearance}-${conversation.id}`,
    title: conversation.title,
  }));

  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const panelId = useId();

  return (
    <div className="bg-window flex flex-col gap-2 rounded-(--radius-menu) p-2">
      <TabStrip
        activeTabId={active}
        appearance={appearance}
        label={`${appearance} tabs`}
        onSelectTab={setActive}
        panelId={panelId}
        tabs={tabs}
      />
      <div
        aria-labelledby={`tab-${active}`}
        className="text-muted-foreground px-2.5 pb-1 text-(length:--text-caption-size) leading-(--text-caption-leading)"
        id={panelId}
        role="tabpanel"
      >
        Showing “{tabs.find((tab) => tab.id === active)?.title}”
      </div>
    </div>
  );
};

const SchemeSwitch = () => {
  const { scheme } = useTheme();

  return (
    <fieldset aria-label="Color scheme" className="flex min-w-0 gap-1">
      {SCHEMES.map((option) => (
        <button
          aria-pressed={scheme === option.id}
          className={`h-7 rounded-full px-3 text-(length:--text-label-size) ${scheme === option.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          key={option.id}
          onClick={() => setScheme(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
};

// The roles in the token file, drawn in the scheme on screen.
const PALETTE_ROLES = Object.keys(tokens.color.light);

const PaletteSwatches = () => (
  <ul className="grid grid-cols-[repeat(auto-fill,minmax(var(--size-catalog-grid-item-min),1fr))] gap-3">
    {PALETTE_ROLES.map((role) => (
      <li className="flex items-center gap-2" key={role}>
        <span
          aria-hidden="true"
          className="border-border size-8 shrink-0 rounded-(--radius-control) border-(length:--border-hairline) bg-(--swatch)"
          style={{ "--swatch": `var(--${role})` }}
        />
        <code className="text-muted-foreground font-mono text-(length:--text-caption-size)">
          {role}
        </code>
      </li>
    ))}
  </ul>
);

// Every component option the library offers, side by side, with sample data.
// Menus and tooltips mount inside main, so every part of the page sits in a
// landmark.
export const Catalog = () => {
  const [popupLayer, setPopupLayer] = useState<HTMLDivElement | null>(null);

  return (
    <TipProvider>
      <PopupLayer container={popupLayer}>
        <title>ComposerKit components</title>
        <div className="bg-background text-foreground min-h-full">
          <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h1 className="text-(length:--text-hero-size) leading-(--text-hero-leading)">
                  ComposerKit components
                </h1>
                <p className="text-muted-foreground max-w-[60ch]">
                  Every component with each option it takes. The code under each
                  example is the prop to pass.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <DirectionSelector />
                <SchemeSwitch />
              </div>
            </header>

            <Section option="setScheme" title="Palette">
              <p className="text-muted-foreground max-w-[60ch]">
                One palette with a light and a dark scheme. Switch the scheme
                above to see both.
              </p>
              <PaletteSwatches />
            </Section>

            <Section option="density" title="Conversation row">
              <RowExamples />
            </Section>

            <Section option="variant × size" title="Button">
              <div className="flex flex-col gap-4">
                {BUTTON_VARIANTS.map(({ variant, note }) => (
                  <Example
                    key={variant}
                    label={`variant="${variant}"`}
                    note={note}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      {BUTTON_SIZES.map((size) => (
                        <Button key={size} size={size} variant={variant}>
                          {size === "lg"
                            ? "Start a new chat"
                            : "Show all chats"}
                        </Button>
                      ))}
                      <Button size="sm" variant={variant}>
                        <RotateCwIcon
                          aria-hidden="true"
                          data-icon="inline-start"
                        />
                        Try again
                      </Button>
                      <Button disabled variant={variant}>
                        Disabled
                      </Button>
                    </div>
                  </Example>
                ))}
              </div>
            </Section>

            <Section option="kind" title="Icon button">
              <div className="flex flex-wrap gap-8">
                {ICON_BUTTON_KINDS.map((item) => (
                  <Example key={item.kind} label={`kind="${item.kind}"`}>
                    <div className="flex items-center gap-3">
                      <IconButton
                        icon={item.icon}
                        kind={item.kind}
                        label={item.label}
                      />
                      <IconButton
                        disabled
                        icon={item.icon}
                        kind={item.kind}
                        label={`${item.label} (disabled)`}
                      />
                    </div>
                  </Example>
                ))}
              </div>
            </Section>

            <Section option="density" title="Menu">
              <div className="flex flex-wrap gap-8">
                {MENU_DENSITIES.map((density) => (
                  <Example
                    key={density}
                    label={`density="${density}"`}
                    note={MENU_NOTES[density]}
                  >
                    <MenuExample density={density} />
                  </Example>
                ))}
              </div>
            </Section>

            <Section option="appearance" title="Mode toggle">
              <div className="flex flex-wrap gap-8">
                {MODE_TOGGLE_APPEARANCES.map((appearance) => (
                  <Example
                    key={appearance}
                    label={`appearance="${appearance}"`}
                    note={TOGGLE_NOTES[appearance]}
                  >
                    <ModeToggleExample appearance={appearance} />
                  </Example>
                ))}
              </div>
            </Section>

            <Section option="tabAppearance" title="Title bar tabs">
              <div className="flex flex-col gap-6">
                {TAB_APPEARANCES.map((appearance) => (
                  <Example
                    key={appearance}
                    label={`tabAppearance="${appearance}"`}
                    note={TAB_NOTES[appearance]}
                  >
                    <TabsExample appearance={appearance} />
                  </Example>
                ))}
              </div>
            </Section>

            <Section option="layout" title="Conversation">
              <p className="text-muted-foreground max-w-[60ch]">
                An open chat with the composer below it. People choose a layout
                in the Appearance menu under the avatar. Copying, redoing,
                stopping and sending all work here.
              </p>
              <div className="flex flex-col gap-8">
                {CONVERSATION_LAYOUTS.map((layout) => (
                  <Example
                    key={layout.id}
                    label={`layout="${layout.id}"`}
                    note={CONVERSATION_NOTES[layout.id]}
                  >
                    <div className="bg-background border-border h-160 overflow-hidden rounded-(--radius-menu) border-(length:--border-hairline)">
                      <ConversationView
                        layout={layout.id}
                        title={`${layout.label} layout sample`}
                        options={COMPOSER_OPTIONS}
                        projects={SAMPLE_PROJECTS}
                        reply={placeholderReply}
                        turns={SAMPLE_TURNS}
                      />
                    </div>
                  </Example>
                ))}
              </div>
            </Section>

            <Section option="layout" title="Composer">
              <p className="text-muted-foreground">
                Type, attach files and send in each one. The composer also has
                13 fixed states, such as an upload in progress or a failed send.{" "}
                <a
                  className="text-foreground underline"
                  href={`${import.meta.env.BASE_URL}states/composer`}
                >
                  Open the composer states
                </a>
                .
              </p>
              <div className="flex flex-col gap-8">
                {COMPOSER_LAYOUTS.map((layout) => (
                  <Example
                    key={layout}
                    label={`layout="${layout}"`}
                    note={LAYOUT_NOTES[layout]}
                  >
                    <ComposerExample layout={layout} />
                  </Example>
                ))}
              </div>
            </Section>
            <div ref={setPopupLayer} />
          </main>
        </div>
      </PopupLayer>
    </TipProvider>
  );
};
