// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useReducer } from "react";

import { Composer } from "@/components/composer/composer";
import { composerReducer } from "@/components/composer/machine";
import { INERT_HANDLERS } from "@/components/composer/use-composer-controller";
import { COMPOSER_OPTIONS } from "@/content/catalog";
import { SAMPLE_PROJECTS } from "@/content/sample";
import { FIXTURES } from "@/states/composer/fixtures";

// One fixed state from src/states/composer/fixtures.ts, drawn by the real
// Composer. The handlers do nothing, so pending states hold still.
export const ComposerStateExample = ({ id }: { id: string }) => {
  const fixture = FIXTURES.find((item) => item.id === id);

  if (!fixture) {
    throw new Error(`No composer fixture named ${id}`);
  }

  const [state, dispatch] = useReducer(composerReducer, fixture.state);

  return (
    <Composer
      dispatch={dispatch}
      handlers={{
        ...INERT_HANDLERS,
        dictationSupported: fixture.dictationSupported,
      }}
      label={`Message, ${fixture.label} state`}
      mode={fixture.mode}
      options={COMPOSER_OPTIONS}
      projects={SAMPLE_PROJECTS}
      state={state}
    />
  );
};
