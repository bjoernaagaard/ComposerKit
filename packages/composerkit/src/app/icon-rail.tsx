// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import {
  BlocksIcon,
  CalendarClockIcon,
  FilesIcon,
  FolderIcon,
  HouseIcon,
  InboxIcon,
  NotebookPenIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  CONVERSATION_LAYOUTS,
  isConversationLayout,
} from "@/components/conversation/layouts";
import type { ConversationLayout } from "@/components/conversation/layouts";
import { Button } from "@/components/ui/button";
import {
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Tip } from "@/components/ui/tip";
import { SCHEMES, setScheme } from "@/theme/apply";
import { useTheme } from "@/theme/use-theme";

export type Destination =
  | "home"
  | "inbox"
  | "schedule"
  | "extensions"
  | "projects"
  | "files"
  | "notes";

// The demo's destinations. The rail shows a rule between the two groups.
export const DESTINATIONS: {
  id: Destination;
  label: string;
  icon: LucideIcon;
  group: 1 | 2;
}[] = [
  { group: 1, icon: HouseIcon, id: "home", label: "Home" },
  { group: 1, icon: InboxIcon, id: "inbox", label: "Inbox" },
  { group: 1, icon: CalendarClockIcon, id: "schedule", label: "Schedule" },
  { group: 1, icon: BlocksIcon, id: "extensions", label: "Extensions" },
  { group: 2, icon: FolderIcon, id: "projects", label: "Projects" },
  { group: 2, icon: FilesIcon, id: "files", label: "Files" },
  { group: 2, icon: NotebookPenIcon, id: "notes", label: "Notes" },
];

const isScheme = (value: string) =>
  SCHEMES.find((scheme) => scheme.id === value)?.id;

// The avatar at the foot of the rail opens the appearance settings.
export const AppearanceMenu = ({
  conversationLayout,
  onConversationLayoutChange,
}: {
  conversationLayout: ConversationLayout;
  onConversationLayoutChange: (layout: ConversationLayout) => void;
}) => {
  const theme = useTheme();

  return (
    <MenuRoot>
      <Tip label="Appearance" side="right">
        <MenuTrigger render={<Button size="icon-lg" variant="ghost" />}>
          {/* The initials are a picture of the account; the button is named
              for what it opens. */}
          <span className="sr-only">Appearance</span>
          <span
            aria-hidden="true"
            className="bg-avatar text-avatar-foreground flex size-6 items-center justify-center rounded-full text-xs font-(--weight-semibold)"
          >
            BA
          </span>
        </MenuTrigger>
      </Tip>
      <MenuContent label="Appearance" side="top" width="wide">
        <MenuRadioGroup
          label="Color scheme"
          onValueChange={(value) => {
            const scheme = isScheme(value);

            if (scheme) {
              setScheme(scheme);
            }
          }}
          value={theme.scheme}
        >
          {SCHEMES.map((scheme) => (
            <MenuRadioItem
              key={scheme.id}
              label={scheme.label}
              value={scheme.id}
            />
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuRadioGroup
          label="Conversation layout"
          onValueChange={(value) => {
            if (isConversationLayout(value)) {
              onConversationLayoutChange(value);
            }
          }}
          value={conversationLayout}
        >
          {CONVERSATION_LAYOUTS.map((layout) => (
            <MenuRadioItem
              key={layout.id}
              label={layout.label}
              value={layout.id}
            />
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </MenuRoot>
  );
};
