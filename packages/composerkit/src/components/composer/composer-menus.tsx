// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { Menu } from "@base-ui/react/menu";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ShieldIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { ComposerAction } from "@/components/composer/machine";
import { choiceLabel } from "@/components/composer/options";
import type { ComposerOptions } from "@/components/composer/options";
import { Button } from "@/components/ui/button";
import {
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

// A compact trigger hides part of its label, so a tooltip shows all of it.
const CompactTip = ({
  compact,
  label,
  children,
}: {
  compact: boolean;
  label: string;
  children: ReactElement;
}) => (compact ? <Tip label={label}>{children}</Tip> : children);

// compact keeps only the icon visible; the accessible name keeps the label.
export const PermissionMenu = ({
  permission,
  permissions,
  dispatch,
  compact = false,
}: {
  permission: string;
  permissions: ComposerOptions["permissions"];
  dispatch: (action: ComposerAction) => void;
  compact?: boolean;
}) => {
  const current = permissions.find((item) => item.id === permission);
  const label = current?.label ?? permission;
  const StatusIcon = current?.caution ? TriangleAlertIcon : ShieldIcon;

  return (
    <MenuRoot>
      <CompactTip compact={compact} label={`Permissions: ${label}`}>
        <MenuTrigger
          render={
            <Button
              size="pill"
              variant={current?.caution ? "caution" : "quiet"}
            />
          }
        >
          <StatusIcon aria-hidden="true" data-icon="inline-start" />
          <span
            className={cn(
              "truncate font-normal @max-[520px]/composer:sr-only",
              compact && "sr-only"
            )}
          >
            {label}
          </span>
          <span className="sr-only">, change permissions</span>
        </MenuTrigger>
      </CompactTip>
      <MenuContent label="Permissions" side="bottom" width="composer">
        <MenuRadioGroup
          onValueChange={(value) =>
            dispatch({ permission: value, type: "permissionChanged" })
          }
          value={permission}
        >
          {permissions.map((item) => (
            <MenuRadioItem
              description={item.description}
              key={item.id}
              label={item.label}
              value={item.id}
            />
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </MenuRoot>
  );
};

const ModelList = ({
  model,
  options,
  dispatch,
  onBack,
}: {
  model: string;
  options: Pick<ComposerOptions, "models">;
  dispatch: (action: ComposerAction) => void;
  onBack: () => void;
}) => {
  const current = useRef<HTMLDivElement>(null);

  // The list replaces the first panel, so focus moves to the current model.
  useEffect(() => {
    current.current?.focus();
  }, []);

  return (
    <Menu.RadioGroup
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onBack();
        }
      }}
      onValueChange={(value: string) =>
        dispatch({ model: value, type: "modelChanged" })
      }
      value={model}
    >
      {options.models.map((item) => (
        <Menu.RadioItem
          className="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex min-h-(--size-menu-item) w-full items-center gap-2 rounded-(--radius-menu-item) px-(--space-menu-item-padding-x) text-left text-(length:--text-label-size) leading-(--text-label-leading) outline-none select-none"
          closeOnClick
          data-slot="menu-item"
          key={item.id}
          label={item.label}
          ref={item.id === model ? current : undefined}
          value={item.id}
        >
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <Menu.RadioItemIndicator className="text-muted-foreground flex">
            <CheckIcon aria-hidden="true" className="size-4" />
          </Menu.RadioItemIndicator>
        </Menu.RadioItem>
      ))}
    </Menu.RadioGroup>
  );
};

const STEP_KEYS = new Map([
  ["ArrowLeft", -1],
  ["ArrowRight", 1],
]);

// The effort as a row of steps inside the menu. It is a menu item, so the
// arrow keys reach it like any other; Left and Right change the step, a
// hidden status says which step it is on, and a hidden hint names the keys.
// The item is named by its label alone, so the status is not read twice.
const EffortSteps = ({
  effort,
  efforts,
  dispatch,
}: {
  effort: string;
  efforts: ComposerOptions["efforts"];
  dispatch: (action: ComposerAction) => void;
}) => {
  const hintId = useId();
  const nameId = useId();

  const index = Math.max(
    0,
    efforts.findIndex((item) => item.id === effort)
  );

  const current = efforts[index];

  const choose = (next: number) => {
    const item = efforts[next];

    if (item && item.id !== effort) {
      dispatch({ effort: item.id, type: "effortChanged" });
    }
  };

  return (
    <Menu.Item
      aria-describedby={hintId}
      aria-labelledby={nameId}
      className="data-highlighted:bg-accent flex h-(--size-model-menu-slider) items-center gap-3 rounded-(--radius-menu-item) px-(--space-menu-item-padding-x) text-(length:--text-caption-size) outline-none select-none"
      closeOnClick={false}
      data-slot="menu-item"
      label="Effort"
      // A click picks the step under the pointer. Enter, which also
      // clicks, leaves the step alone.
      onClick={(event) => {
        const track = event.currentTarget.querySelector("[data-steps]");

        if (event.detail === 0 || !track) {
          return;
        }

        const box = track.getBoundingClientRect();
        const share = (event.clientX - box.left) / box.width;
        choose(
          Math.min(
            efforts.length - 1,
            Math.max(0, Math.floor(share * efforts.length))
          )
        );
      }}
      onKeyDown={(event) => {
        const step = STEP_KEYS.get(event.key);

        if (step) {
          event.preventDefault();
          choose(Math.min(efforts.length - 1, Math.max(0, index + step)));
        }
      }}
    >
      <span
        className="text-subtle-foreground w-16 shrink-0 truncate"
        id={nameId}
      >
        <span className="sr-only">Effort: </span>
        {current?.label ?? "Effort"}
      </span>
      <span aria-hidden="true" className="flex flex-1 items-center" data-steps>
        {efforts.map((item, position) => (
          <span
            className="flex h-(--size-model-menu-slider) flex-1 items-center justify-center"
            key={item.id}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                position <= index ? "bg-foreground" : "bg-input",
                position === index && "size-2.5"
              )}
            />
          </span>
        ))}
      </span>
      <output className="sr-only">
        {current ? `${current.label}, ${index + 1} of ${efforts.length}` : ""}
      </output>
      <span hidden id={hintId}>
        Left and Right arrow keys change the effort.
      </span>
    </Menu.Item>
  );
};

// The menu's first row names the model; Enter or a click on it swaps the
// panel for the list of models, with focus on the current one. Left goes
// back. The second row is the effort, a row of steps that Left and Right
// move along. A click on the trigger does not focus it, so Escape returns
// focus to wherever it was before, such as the message field.
// compact hides the effort on the trigger; its accessible name keeps it.
export const ModelMenu = ({
  model,
  effort,
  options,
  dispatch,
  compact = false,
}: {
  model: string;
  effort: string;
  options: Pick<ComposerOptions, "models" | "efforts">;
  dispatch: (action: ComposerAction) => void;
  compact?: boolean;
}) => {
  const [view, setView] = useState<"main" | "models" | "back">("main");
  const returnTo = useRef<HTMLElement | null>(null);
  const modelRow = useRef<HTMLDivElement>(null);

  // Back from the list of models, focus returns to the row that opened it.
  useEffect(() => {
    if (view === "back") {
      modelRow.current?.focus();
    }
  }, [view]);
  const modelName = choiceLabel(options.models, model);
  const effortName = choiceLabel(options.efforts, effort);

  const finalFocus = () => {
    const previous = returnTo.current;
    returnTo.current = null;

    if (!previous) {
      return true;
    }

    // Focus was on the page itself, so it stays there.
    return previous.isConnected && previous !== document.body
      ? previous
      : false;
  };

  return (
    <MenuRoot
      onOpenChange={(open) => {
        if (!open) {
          setView("main");
        }
      }}
    >
      <CompactTip compact={compact} label={`${modelName}, ${effortName}`}>
        <MenuTrigger
          onKeyDown={() => {
            returnTo.current = null;
          }}
          onMouseDown={(event) => {
            const { activeElement } = document;
            returnTo.current =
              activeElement instanceof HTMLElement ? activeElement : null;
            event.preventDefault();
          }}
          render={<Button size="pill" variant="quiet" />}
        >
          <span className="text-foreground truncate font-normal">
            {modelName}
          </span>{" "}
          {/* The name starts with the words on the button, so speech
              input can say them to press it. */}
          <span
            className={cn(
              "truncate font-normal @max-[420px]/composer:sr-only",
              compact && "sr-only"
            )}
          >
            {effortName}
          </span>
          <span className="sr-only"> effort, choose model</span>
          <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
        </MenuTrigger>
      </CompactTip>
      <MenuContent
        align="end"
        finalFocus={finalFocus}
        label="Model and effort"
        side="top"
        width="model"
      >
        {view === "models" ? (
          <ModelList
            dispatch={dispatch}
            model={model}
            onBack={() => setView("back")}
            options={options}
          />
        ) : (
          <div className="flex flex-col gap-(--space-model-menu-row-gap)">
            <Menu.Item
              className="data-highlighted:bg-accent flex h-(--size-model-menu-header) items-center justify-center gap-1 rounded-(--radius-menu-item) text-(length:--text-label-size) outline-none select-none"
              closeOnClick={false}
              data-slot="menu-item"
              label={modelName}
              onClick={() => setView("models")}
              ref={modelRow}
            >
              <span className="sr-only">Model: </span>
              {modelName}
              <ChevronRightIcon
                aria-hidden="true"
                className="text-subtle-foreground size-4 rtl:-scale-x-100"
              />
            </Menu.Item>
            <EffortSteps
              dispatch={dispatch}
              effort={effort}
              efforts={options.efforts}
            />
          </div>
        )}
      </MenuContent>
    </MenuRoot>
  );
};
