// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { Composer } from "@/components/composer/composer";
import type { ComposerMode } from "@/components/composer/composer";
import type {
  ComposerAction,
  ComposerState,
} from "@/components/composer/machine";
import type { ComposerOptions } from "@/components/composer/options";
import type { ComposerHandlers } from "@/components/composer/use-composer-controller";
import { HOME_SUGGESTIONS } from "@/content/sample";
import type { Project } from "@/content/sample";
import { cn } from "@/lib/utils";

import { ModeToggle } from "./mode-toggle";

const HERO_TITLE: Record<ComposerMode, string> = {
  chat: "Start with a question",
  work: "Start with a task",
};

export const HomeView = ({
  mode,
  onModeChange,
  composer,
  dispatch,
  handlers,
  options,
  projects,
}: {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  composer: ComposerState;
  dispatch: (action: ComposerAction) => void;
  handlers: ComposerHandlers;
  options: ComposerOptions;
  projects: Project[];
}) => (
  <div className="@container/home h-full">
    <div
      className="flex min-h-full flex-col items-center px-3 pt-1.5 @max-[480px]/home:pb-(--space-home-bottom)"
      data-slot="home-view"
    >
      <ModeToggle mode={mode} onChange={onModeChange} />
      <div
        className="flex w-full flex-[0.85] flex-col items-center justify-end pt-(--space-hero-padding-top) pb-(--space-hero-padding-bottom) @max-[480px]/home:flex-1 @max-[480px]/home:justify-center"
        data-slot="home-hero"
      >
        <h1 className="text-foreground text-center text-(length:--text-hero-size) leading-(--text-hero-leading) font-normal text-balance">
          {HERO_TITLE[mode]}
        </h1>
      </div>
      <div className="flex w-full max-w-(--size-composer-width) flex-col @max-[480px]/home:flex-col-reverse">
        <div
          className={cn(
            "relative top-(--space-suggestion-web-wide-offset) @max-[480px]/home:top-0",
            mode === "chat" &&
              "h-(--size-composer-inline-min-height) @max-[480px]/home:h-auto"
          )}
        >
          <Composer
            dispatch={dispatch}
            handlers={handlers}
            layout={mode === "chat" ? "inline" : "stacked"}
            mode={mode}
            options={options}
            projects={projects}
            state={composer}
            typeToFocus
          />
        </div>
        <div
          aria-hidden={Boolean(composer.draft)}
          className={cn(
            "relative top-(--space-suggestion-web-wide-offset) mt-(--space-suggestion-gap) flex shrink-0 flex-col @max-[480px]/home:top-(--space-suggestion-web-narrow-offset) @max-[480px]/home:mt-0",
            composer.draft && "invisible"
          )}
        >
          {HOME_SUGGESTIONS.map(({ icon: Glyph, label }) => (
            <button
              className="text-subtle-foreground hover:bg-accent flex h-(--size-suggestion-row) items-center gap-(--space-suggestion-icon-gap) rounded-(--radius-control) px-(--space-suggestion-inset) text-left text-(length:--text-body-size) @max-[480px]/home:px-(--space-suggestion-narrow-inset)"
              key={label}
              onClick={() => dispatch({ draft: label, type: "draftChanged" })}
              tabIndex={composer.draft ? -1 : undefined}
              type="button"
            >
              <Glyph
                aria-hidden="true"
                className="size-(--size-suggestion-icon) shrink-0"
              />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 pb-6 @max-[480px]/home:hidden" />
    </div>
  </div>
);
