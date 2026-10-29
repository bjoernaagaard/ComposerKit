// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { readFile } from "node:fs/promises";
import path from "node:path";

import { Markdown } from "fumadocs-core/content/md";
import { remarkGfm } from "fumadocs-core/mdx-plugins/remark-gfm";
import defaultMdxComponents from "fumadocs-ui/mdx";

const SPEC_FILE = "spec/functional.md";
const SPEC_PATH = path.resolve(process.cwd(), "../..", SPEC_FILE);
const SPEC_URL = `https://github.com/bjoernaagaard/ComposerKit/blob/main/${SPEC_FILE}`;

const HEADING = /^(?<marks>#{2,3}) (?<title>.+)$/u;

interface Section {
  title: string;
  start: number;
  end: number;
  body: string;
}

// Finds "## 1. Composer > ### Keyboard" (or just "## 5. Tooltips") in the
// spec and returns the text under it, up to the next heading at the same or
// a higher level. Line numbers are 1-based.
const findSection = (lines: string[], trail: string[]): Section => {
  const open: string[] = [];
  let found: { level: number; start: number } | undefined;

  for (const [index, line] of lines.entries()) {
    const match = HEADING.exec(line);

    if (!match?.groups) {
      continue;
    }

    const level = (match.groups.marks ?? "").length;

    if (found && level <= found.level) {
      return {
        body: lines.slice(found.start, index).join("\n"),
        end: index,
        start: found.start,
        title: trail.join(" › "),
      };
    }

    open.length = level - 2;
    open.push(match.groups.title ?? "");

    if (!found && open.join(" > ") === trail.join(" > ")) {
      found = { level, start: index + 1 };
    }
  }

  if (!found) {
    throw new Error(`${SPEC_FILE} has no section ${trail.join(" > ")}`);
  }

  return {
    body: lines.slice(found.start).join("\n"),
    end: lines.length,
    start: found.start,
    title: trail.join(" › "),
  };
};

// Quotes a section of spec/functional.md at build time, so the docs always
// say what the spec says. `section` is a heading trail such as
// "1. Composer > Keyboard".
export const SpecSection = async ({ section }: { section: string }) => {
  const spec = await readFile(SPEC_PATH, "utf-8");
  const lines = spec.split("\n");

  const found = findSection(
    lines,
    section.split(">").map((part) => part.trim())
  );

  return (
    <div data-spec-section={section}>
      <p>
        From{" "}
        <a href={`${SPEC_URL}#L${found.start}-L${found.end}`}>
          {SPEC_FILE}, {found.title}
        </a>{" "}
        (lines {found.start} to {found.end}).
      </p>
      <Markdown components={defaultMdxComponents} remarkPlugins={[remarkGfm]}>
        {found.body}
      </Markdown>
    </div>
  );
};
