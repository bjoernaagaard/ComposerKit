// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { Composer } from "@/components/composer/composer";
import type {
  ComposerLayout,
  ComposerMode,
} from "@/components/composer/composer";
import { initialComposer } from "@/components/composer/machine";
import { useComposerController } from "@/components/composer/use-composer-controller";
import { COMPOSER_OPTIONS, DEFAULT_CHOICES } from "@/content/catalog";
import { SAMPLE_PROJECTS } from "@/content/sample";

// A message sent here has nowhere to go, so the composer just clears.
const ignoreSent = () => null;

// A working composer: type, attach files and send.
export const ComposerLayoutExample = ({
  layout,
  mode = "work",
}: {
  layout: ComposerLayout;
  mode?: ComposerMode;
}) => {
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
      mode={mode}
      options={COMPOSER_OPTIONS}
      projects={SAMPLE_PROJECTS}
      state={composer.state}
    />
  );
};
