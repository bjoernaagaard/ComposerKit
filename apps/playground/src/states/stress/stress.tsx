// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Dev-only stress harness for the docs E2E (e2e/docs/08-stress.spec.ts).
// Each part gets its data through its own props, the way an app would pass
// it: the demo data, a 200 character label with spaces, the same length as
// one unbroken word, or nothing at all. ?part= picks the part and ?data=
// the dataset; the switcher at the bottom changes the dataset by hand, and
// ?bare hides it so screenshots show the part alone. For an empty menu,
// ?empty= picks how the app passes no items: nothing, an empty fragment,
// a fragment around an empty list, or a radio group with no items.
import { CopyIcon } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";

import { ConversationRow, ROW_DENSITIES } from "@/app/sidebar/conversation-row";
import { Sidebar } from "@/app/sidebar/sidebar";
import { TabStrip } from "@/app/title-bar";
import type { Tab } from "@/app/title-bar";
import { ConversationView } from "@/components/conversation/conversation-view";
import { toBlocks } from "@/components/conversation/types";
import type { Turn } from "@/components/conversation/types";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  MenuContent,
  MenuInfoGroup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSubmenu,
  MenuTrigger,
} from "@/components/ui/menu";
import { PopupLayer } from "@/components/ui/popup-layer";
import { Tip, TipProvider } from "@/components/ui/tip";
import { COMPOSER_OPTIONS } from "@/content/catalog";
import {
  SAMPLE_CONVERSATIONS,
  SAMPLE_NOW,
  SAMPLE_PROJECTS,
} from "@/content/sample";
import type { Conversation } from "@/content/sample";

// Both are exactly 200 characters: a long but real chat title, and a
// shared file link, which has no place to break.
export const LABEL_WITH_SPACES =
  "Summarize the quarterly infrastructure review from the Kraków and Wrocław offices, including the database migration timeline, the new on-call rotation and every open question Aleksandra raised in June";

export const LABEL_ONE_WORD =
  "https://northwind-industries-holdings.example.com/shared/aleksandra.wisniewska-kowalczyk/quarterly-infrastructure-review/2026-Q3/database-migration-timeline-and-on-call-rotation-final-revisions-12.pdf";

const DATASETS = ["demo", "spaces", "word", "empty"] as const;

type Dataset = (typeof DATASETS)[number];

const DATASET_NAMES: Record<Dataset, string> = {
  demo: "Demo",
  empty: "Empty",
  spaces: "200 with spaces",
  word: "200, one word",
};

const PARTS = [
  "button",
  "icon-button",
  "tooltip",
  "menu",
  "tabs",
  "row",
  "sidebar",
  "turns",
] as const;

type Part = (typeof PARTS)[number];

const params = new URLSearchParams(window.location.search);

const EMPTY_MENUS = ["nothing", "fragment", "map", "radio-group"] as const;

type EmptyMenu = (typeof EMPTY_MENUS)[number];

const NO_CHOICES: { id: string; label: string }[] = [];

const pick = <T extends string>(
  options: readonly T[],
  value: string | null
): T | undefined => options.find((option) => option === value);

const labelFor = (data: Dataset, demo: string) => {
  if (data === "spaces") {
    return LABEL_WITH_SPACES;
  }

  if (data === "word") {
    return LABEL_ONE_WORD;
  }

  return demo;
};

const ignore = () => null;

const stressConversations = (data: Dataset): Conversation[] => {
  if (data === "empty") {
    return [];
  }

  const [first, second, ...rest] = SAMPLE_CONVERSATIONS.slice(0, 6);

  if (!first || !second) {
    return [];
  }

  return [
    { ...first, title: labelFor(data, first.title) },
    { ...second, title: labelFor(data, second.title) },
    ...rest,
  ];
};

// The ways an app hands a menu no items, as it would with an empty list.
const EmptyMenuItems = ({ given }: { given: EmptyMenu }) => {
  const [choice, setChoice] = useState("");

  if (given === "fragment") {
    // oxlint-disable-next-line react/jsx-no-useless-fragment -- the empty fragment is the case under test
    return <></>;
  }

  if (given === "map") {
    return (
      <>
        {NO_CHOICES.map((item) => (
          <MenuItem key={item.id} label={item.label} />
        ))}
      </>
    );
  }

  if (given === "radio-group") {
    return (
      <MenuRadioGroup onValueChange={setChoice} value={choice}>
        {NO_CHOICES.map((item) => (
          <MenuRadioItem key={item.id} label={item.label} value={item.id} />
        ))}
      </MenuRadioGroup>
    );
  }

  return null;
};

const MenuPart = ({ data }: { data: Dataset }) => {
  const [style, setStyle] = useState("same");
  const label = labelFor(data, "Pin chat");
  const emptyGiven = pick(EMPTY_MENUS, params.get("empty")) ?? "nothing";

  if (data === "empty" && emptyGiven !== "nothing") {
    return (
      <MenuRoot defaultOpen>
        <MenuTrigger
          render={<Button variant="outline">Open the menu</Button>}
        />
        <MenuContent label="Stress menu" width="actions">
          <EmptyMenuItems given={emptyGiven} />
        </MenuContent>
      </MenuRoot>
    );
  }

  return (
    <MenuRoot defaultOpen>
      <MenuTrigger render={<Button variant="outline">Open the menu</Button>} />
      <MenuContent label="Stress menu" width="actions">
        {data === "empty" ? null : (
          <>
            <MenuInfoGroup info={labelFor(data, "Sent today at 09:41")}>
              <MenuItem label={label} />
              <MenuSubmenu label={labelFor(data, "Redo with")}>
                <MenuRadioGroup onValueChange={setStyle} value={style}>
                  <MenuRadioItem
                    label={labelFor(data, "Same length")}
                    value="same"
                  />
                  <MenuRadioItem label="Shorter" value="shorter" />
                </MenuRadioGroup>
              </MenuSubmenu>
            </MenuInfoGroup>
            <MenuItem
              description={labelFor(data, "You can undo it right away")}
              label={labelFor(data, "Archive chat")}
            />
          </>
        )}
      </MenuContent>
    </MenuRoot>
  );
};

const TabsPart = ({ data }: { data: Dataset }) => {
  const tabs: Tab[] =
    data === "empty"
      ? []
      : SAMPLE_CONVERSATIONS.slice(0, 3).map((conversation, index) => ({
          id: `stress-${conversation.id}`,
          title:
            index === 1
              ? conversation.title
              : labelFor(data, conversation.title),
        }));

  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const panelId = useId();

  return (
    <div className="bg-window flex flex-col gap-2 p-2">
      <TabStrip
        activeTabId={active}
        label="Stress tabs"
        onSelectTab={setActive}
        panelId={panelId}
        tabs={tabs}
      />
      <div
        className="text-muted-foreground px-2.5 wrap-anywhere"
        id={panelId}
        role="tabpanel"
      >
        {tabs.find((tab) => tab.id === active)?.title ?? "No tabs"}
      </div>
    </div>
  );
};

const RowsPart = ({ data }: { data: Dataset }) => {
  const [conversation] = stressConversations(data);

  if (!conversation) {
    return <p>No conversation to show.</p>;
  }

  return (
    <ul className="bg-sidebar flex max-w-(--size-sidebar) flex-col gap-(--size-row-gap) p-(--space-sidebar-padding)">
      {ROW_DENSITIES.map((density, index) => (
        <li key={density}>
          <ConversationRow
            active={index === 0}
            conversation={conversation}
            density={density}
            now={SAMPLE_NOW}
            onArchive={ignore}
            onOpen={ignore}
            onTogglePin={ignore}
            project={SAMPLE_PROJECTS[0]}
          />
        </li>
      ))}
    </ul>
  );
};

const SidebarPart = ({ data }: { data: Dataset }) => (
  <div className="h-160 w-(--size-sidebar)">
    <Sidebar
      activeConversationId={null}
      archived={null}
      conversations={stressConversations(data)}
      now={SAMPLE_NOW}
      onAddProject={ignore}
      onArchive={ignore}
      onNewChat={ignore}
      onOpenConversation={ignore}
      onStartProjectChat={ignore}
      onTogglePin={ignore}
      onUndoArchive={ignore}
      projects={data === "empty" ? [] : SAMPLE_PROJECTS}
    />
  </div>
);

const stressTurns = (data: Dataset): Turn[] => {
  if (data === "empty") {
    return [];
  }

  const text = labelFor(data, "Plan a weekend of hiking near Zakopane.");

  return [
    {
      attachments: [
        { name: labelFor(data, "route-notes.pdf"), size: "1.2 MB" },
      ],
      blocks: toBlocks([{ kind: "paragraph", text }]),
      id: "stress-prompt",
      role: "user",
    },
    {
      attachments: [],
      blocks: toBlocks([{ kind: "paragraph", text }]),
      id: "stress-reply",
      role: "assistant",
    },
  ];
};

const TurnsPart = ({ data }: { data: Dataset }) => (
  <div className="h-160">
    <ConversationView
      options={COMPOSER_OPTIONS}
      projects={SAMPLE_PROJECTS}
      reply={() => [{ kind: "paragraph", text: labelFor(data, "Done.") }]}
      title="Stress conversation"
      turns={stressTurns(data)}
    />
  </div>
);

const renderPart = (part: Part, data: Dataset): ReactNode => {
  const label = labelFor(data, "Start a new chat");

  switch (part) {
    case "button": {
      // The way the Button docs say to pass a label from data.
      return (
        <Button>
          <span className="truncate">{data === "empty" ? "" : label}</span>
        </Button>
      );
    }

    case "icon-button": {
      return (
        <IconButton
          icon={CopyIcon}
          kind="control"
          label={labelFor(data, "Copy message")}
        />
      );
    }

    case "tooltip": {
      return (
        <Tip label={labelFor(data, "Copy message")}>
          <Button variant="outline">Copy</Button>
        </Tip>
      );
    }

    case "menu": {
      return <MenuPart data={data} />;
    }

    case "tabs": {
      return <TabsPart data={data} />;
    }

    case "row": {
      return <RowsPart data={data} />;
    }

    case "sidebar": {
      return <SidebarPart data={data} />;
    }

    default: {
      return <TurnsPart data={data} />;
    }
  }
};

export const Stress = () => {
  const part = pick(PARTS, params.get("part")) ?? "button";

  const [data, setData] = useState<Dataset>(
    pick(DATASETS, params.get("data")) ?? "demo"
  );

  const [popupLayer, setPopupLayer] = useState<HTMLDivElement | null>(null);

  const choose = (next: Dataset) => {
    const url = new URL(window.location.href);

    url.searchParams.set("data", next);
    window.history.replaceState(null, "", url);
    setData(next);
  };

  return (
    <TipProvider>
      <PopupLayer container={popupLayer}>
        <main className="bg-background text-foreground min-h-full p-4">
          <h1 className="sr-only">{`Stress: ${part}, ${DATASET_NAMES[data]}`}</h1>
          <div data-stress-stage={part} key={`${part}-${data}`}>
            {renderPart(part, data)}
          </div>
          <div ref={setPopupLayer} />
          {params.has("bare") ? null : (
            <fieldset className="bg-muted text-foreground fixed bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full p-1 font-sans text-xs">
              <legend className="sr-only">Dataset</legend>
              {DATASETS.map((option) => (
                <button
                  aria-pressed={option === data}
                  className="aria-pressed:bg-background rounded-full px-3 py-1"
                  key={option}
                  onClick={() => choose(option)}
                  type="button"
                >
                  {DATASET_NAMES[option]}
                </button>
              ))}
            </fieldset>
          )}
        </main>
      </PopupLayer>
    </TipProvider>
  );
};
