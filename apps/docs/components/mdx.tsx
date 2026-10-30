// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import {
  createFileSystemGeneratorCache,
  createGenerator,
} from "fumadocs-typescript";
import { AutoTypeTable } from "fumadocs-typescript/ui";
import type { AutoTypeTableProps } from "fumadocs-typescript/ui";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

import { ComponentPreview, ComposerStatePreviews } from "./component-preview";
import { SampleDataFiles, SampleDataPages } from "./sample-data";
import { SpecSection } from "./spec-section";
import { TokenTable } from "./token-table";

// API tables are generated from the library's TypeScript types at build time.
const generator = createGenerator({
  cache: createFileSystemGeneratorCache(".next/fumadocs-typescript"),
});

export const getMDXComponents = (components?: MDXComponents) =>
  ({
    ...defaultMdxComponents,
    AutoTypeTable: (props: Partial<AutoTypeTableProps>) => (
      <AutoTypeTable {...props} generator={generator} />
    ),
    ComponentPreview,
    ComposerStatePreviews,
    SampleDataFiles,
    SampleDataPages,
    SpecSection,
    TokenTable,
    // Fumadocs makes each code block's scroll area a region with no name,
    // which axe flags (landmark-unique). The block's title names it. A
    // block without a title is a shell command. Fumadocs floats the copy
    // button over an untitled block, where it covers the command once the
    // line is wider than the page, so those get a title bar to hold it.
    pre: ({
      ref: _ref,
      title = "Terminal",
      ...props
    }: ComponentProps<"pre">) => (
      <CodeBlock
        {...props}
        title={title}
        viewportProps={{ "aria-label": title }}
      >
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    ...components,
  }) satisfies MDXComponents;

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
