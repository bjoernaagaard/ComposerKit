// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { FilesIcon, FolderIcon, LaptopIcon, PlugIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ComposerAction } from "@/components/composer/machine";
import type { ComposerProject } from "@/components/composer/options";
import { Button } from "@/components/ui/button";
import {
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu";
import { Tip } from "@/components/ui/tip";

const NO_PROJECT = "none";

const TrayLabel = ({
  icon: Glyph,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) => (
  <>
    <Glyph aria-hidden="true" className="size-4 shrink-0" />
    <span className="text-foreground truncate font-normal @max-[480px]/composer:sr-only">
      {label}
    </span>
  </>
);

// Extra controls for work mode: project, files, tools and where the work
// runs. It hangs below the composer, or sits inside it as the last row
// when the composer is tall enough.
export const ComposerTray = ({
  embedded = false,
  projectId,
  projects,
  dispatch,
  onFiles,
  sending,
}: {
  projectId: string | null;
  projects: readonly ComposerProject[];
  dispatch: (action: ComposerAction) => void;
  onFiles: () => void;
  sending: boolean;
  embedded?: boolean;
}) => {
  const project = projects.find((item) => item.id === projectId);

  return (
    <div
      className={
        embedded
          ? "border-border mx-(--space-composer-footer-padding) border-t-(length:--border-hairline)"
          : "bg-muted relative mx-(--space-tray-inset) -mt-(--size-tray-tuck) rounded-b-(--radius-tray) px-1 pt-(--size-tray-tuck)"
      }
      data-slot="composer-tray"
    >
      <fieldset
        aria-label="Work options"
        className="flex min-w-0 items-center gap-2 py-1.5"
      >
        <MenuRoot>
          <MenuTrigger
            aria-label={
              project ? `Project ${project.name}. Change` : "Pick a project"
            }
            render={<Button size="tray" variant="quiet" />}
          >
            <TrayLabel
              icon={FolderIcon}
              label={project?.name ?? "Pick a project"}
            />
          </MenuTrigger>
          <MenuContent label="Projects" side="bottom">
            <MenuRadioGroup
              onValueChange={(value) =>
                dispatch({
                  projectId: value === NO_PROJECT ? null : value,
                  type: "projectChanged",
                })
              }
              value={projectId ?? NO_PROJECT}
            >
              <MenuRadioItem label="No project" value={NO_PROJECT} />
              {projects.map((item) => (
                <MenuRadioItem
                  key={item.id}
                  label={item.name}
                  value={item.id}
                />
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </MenuRoot>
        <Button
          disabled={sending}
          onClick={onFiles}
          size="tray"
          variant="quiet"
        >
          <TrayLabel icon={FilesIcon} label="Files" />
        </Button>
        <MenuRoot>
          <MenuTrigger render={<Button size="tray" variant="quiet" />}>
            <TrayLabel icon={PlugIcon} label="Tools" />
          </MenuTrigger>
          <MenuContent label="Tools" side="bottom">
            <MenuItem
              description="Tools you connect show up here."
              disabled
              label="No tools yet"
            />
          </MenuContent>
        </MenuRoot>
        <span className="flex-1" />
        <MenuRoot>
          <Tip label="Where this runs">
            <MenuTrigger
              aria-label="Where this runs"
              render={<Button size="icon-round" variant="quiet" />}
            >
              <LaptopIcon aria-hidden="true" className="size-4" />
            </MenuTrigger>
          </Tip>
          <MenuContent align="end" label="Where this runs" side="bottom">
            <MenuRadioGroup value="local">
              <MenuRadioItem
                description="Uses this device"
                label="This computer"
                value="local"
              />
              <MenuRadioItem
                description="Not available yet"
                disabled
                label="Remote machine"
                value="remote"
              />
            </MenuRadioGroup>
          </MenuContent>
        </MenuRoot>
      </fieldset>
    </div>
  );
};
