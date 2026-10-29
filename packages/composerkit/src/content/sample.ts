// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { ImageIcon, PencilIcon, SearchIcon } from "lucide-react";

import type { ComposerProject } from "@/components/composer/options";

export type Project = ComposerProject;

export const HOME_SUGGESTIONS = [
  { icon: PencilIcon, label: "Help me write something" },
  { icon: SearchIcon, label: "Look something up" },
  { icon: ImageIcon, label: "Describe a picture" },
] as const;

export interface Conversation {
  id: string;
  title: string;
  projectId: string | null;
  updatedAt: string;
  pinned: boolean;
}

export const SAMPLE_PROJECTS: Project[] = [
  { id: "shrok", name: "shrok" },
  { id: "garden", name: "garden-planner" },
];

const TITLES = [
  "Pack list for a weekend of hiking",
  "Add retries to the sync client",
  "Outline the talk on local-first apps",
  "Why does my sourdough collapse in the oven?",
  "Split the settings page into tabs",
  "Explain the difference between a process and a thread",
  "Turn the onboarding steps into a checklist",
  "Name ideas for a plant-watering app",
  "Fix the date picker in Firefox",
  "Summarize the notes from Tuesday’s planning call",
  "Draft a polite reminder about the unpaid invoice",
  "Compare three ways to store user preferences",
  "Rewrite the error messages on the signup form",
  "What should go in a README for a small library?",
  "Plan meals for a week on a budget",
  "Make the sidebar keyboard friendly",
  "Translate the welcome email into Danish",
  "Find out why the build takes four minutes",
  "Questions to ask before adopting a new framework",
  "Clean up the CSS for the pricing table",
  "Write alt text for the product photos",
  "How do I read a flame graph?",
  "Schedule backups for the photo library",
  "Turn this spreadsheet into a chart",
  "Shorten the release notes for 0.3",
  "Set up a reading list for learning Rust",
  "Debug the websocket that drops after an hour",
  "Pick colors that pass contrast checks",
  "Estimate how long the migration will take",
  "Ideas for a tenth birthday party",
  "Continue the draft from yesterday",
  "Review the pull request that adds dark mode",
  "Reply to the landlord about the heating",
  "Explain how a hash map grows",
  "Write test data for the invoice page",
  "Sketch a schema for recurring events",
  "Brainstorm a name for the team offsite",
  "Check this regex for edge cases",
  "Tidy up the garden bed layout",
  "What changed between the two config files?",
];

const MINUTE = 60_000;
const NOW = Date.parse("2026-10-28T09:30:00Z");

export const SAMPLE_CONVERSATIONS: Conversation[] = TITLES.map(
  (title, index) => {
    let projectId: string | null = null;

    if (index % 7 === 1) {
      projectId = "shrok";
    } else if (index % 11 === 4) {
      projectId = "garden";
    }

    return {
      id: `c${index + 1}`,
      pinned: index === 0,
      projectId,
      title,
      updatedAt: new Date(NOW - index * index * 23 * MINUTE).toISOString(),
    };
  }
);

export const SAMPLE_NOW = NOW;
