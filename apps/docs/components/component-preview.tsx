// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { Tab, Tabs } from "fumadocs-ui/components/tabs";

import {
  COMPOSER_STATE_NAMES,
  EXAMPLES,
  REPO_ONLY_FILES,
} from "../examples/registry";
import { ComponentSource } from "./component-source";
import { PreviewFrame } from "./preview-frame";

// A live example with its source on a second tab, modeled on shadcn's
// ComponentPreview. The caption is the prop the example shows and a note,
// as the old catalog printed them. An example built on the demo app's own
// parts gets a Repo code tab that says shadcn add does not install them.
export const ComponentPreview = ({ name }: { name: string }) => {
  const example = EXAMPLES.get(name);

  if (!example) {
    throw new Error(`No example named ${name} in examples/registry.tsx`);
  }

  const figure = (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="flex flex-col">
        <code className="text-foreground font-mono text-(length:--text-caption-size)">
          {example.label}
        </code>
        {example.note ? (
          <span className="text-subtle-foreground text-(length:--text-caption-size) leading-(--text-caption-leading)">
            {example.note}
          </span>
        ) : null}
      </figcaption>
      <PreviewFrame name={name} target={example.target}>
        {example.element}
      </PreviewFrame>
    </figure>
  );

  const repoOnly = REPO_ONLY_FILES.has(example.file);
  const codeTab = repoOnly ? "Repo code" : "Code";

  return (
    <Tabs items={["Preview", codeTab]}>
      <Tab className="p-0" value="Preview">
        <div
          // oxlint-disable-next-line shadcn/no-unknown-classes -- not-prose is the typography plugin's opt-out marker and has no CSS of its own
          className="bg-background text-foreground not-prose p-4"
          data-slot="preview"
        >
          {example.fit ? (
            <div className="flex flex-wrap gap-8">{figure}</div>
          ) : (
            figure
          )}
        </div>
      </Tab>
      <Tab className="p-0" value={codeTab}>
        {repoOnly ? (
          <p className="text-muted-foreground px-4 pt-3 text-(length:--text-caption-size) leading-(--text-caption-leading)">
            Repo code, not installable. This example uses the demo app&apos;s
            own parts in <code>packages/composerkit/src/app</code>, which no
            registry item ships, so <code>shadcn add</code> does not install
            them.
          </p>
        ) : null}
        <ComponentSource file={example.file} label={name} />
      </Tab>
    </Tabs>
  );
};

// Every composer state in src/states/composer/fixtures.ts.
export const ComposerStatePreviews = () =>
  COMPOSER_STATE_NAMES.map((name) => (
    <ComponentPreview key={name} name={name} />
  ));
