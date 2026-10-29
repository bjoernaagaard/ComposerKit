// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import type { ComposerMode } from "@/components/composer/composer";

const OPTIONS: { id: ComposerMode; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "work", label: "Work" },
];

export type ModeToggleAppearance = "pill" | "segmented" | "underline";

export const MODE_TOGGLE_APPEARANCES: ModeToggleAppearance[] = [
  "pill",
  "segmented",
  "underline",
];

// pill: a round track with a thumb that slides. The default.
// segmented: a squarer track with the thumb set inside it.
// underline: no track, just a bar that slides under the chosen label.
const TRACK_CLASSES: Record<ModeToggleAppearance, string> = {
  pill: "bg-secondary rounded-full",
  segmented:
    "bg-secondary border-border rounded-(--radius-control) border-(length:--border-hairline) p-(--space-mode-toggle-inset)",
  underline: "border-input border-b-(length:--border-hairline)",
};

const THUMB_CLASSES: Record<ModeToggleAppearance, string> = {
  pill: "border-border bg-card inset-y-0 left-0 w-1/2 rounded-full border-(length:--border-hairline) shadow-(--shadow-toggle-thumb)",
  segmented:
    "bg-card inset-y-(--space-mode-toggle-inset) left-(--space-mode-toggle-inset) w-[calc(50%-var(--space-mode-toggle-inset))] rounded-(--radius-small) border-(length:--border-hairline) border-transparent shadow-(--shadow-toggle-thumb)",
  underline:
    "border-foreground bottom-[calc(-1*var(--border-toggle-underline-offset))] left-0 h-0 w-1/2 border-b-(length:--border-toggle-underline-width)",
};

const OPTION_CLASSES: Record<ModeToggleAppearance, string> = {
  pill: "rounded-full",
  segmented: "rounded-(--radius-small)",
  underline: "rounded-(--radius-small)",
};

export interface ModeToggleProps {
  mode: ComposerMode;
  onChange: (mode: ComposerMode) => void;
  appearance?: ModeToggleAppearance;
}

// The Chat and Work switch above the heading. A thumb or bar marks the
// choice and its label turns semibold, since the thumb alone is faint
// against the track. Thumb edges and the bar are borders, which survive
// forced colors.
export const ModeToggle = ({
  mode,
  onChange,
  appearance = "pill",
}: ModeToggleProps) => (
  <fieldset
    data-slot="mode-toggle"
    aria-label="Composer mode"
    className="min-w-0"
    data-appearance={appearance}
  >
    {/* A fieldset's content box does not stretch, so the grid sits inside. */}
    <div
      data-slot="mode-toggle-track"
      className={`relative grid h-(--size-mode-toggle-height) w-(--size-mode-toggle-width) grid-cols-2 ${TRACK_CLASSES[appearance]}`}
    >
      <span
        data-slot="mode-toggle-thumb"
        aria-hidden="true"
        className={`absolute transition-transform duration-(--motion-duration) ease-(--motion-ease-out) ${THUMB_CLASSES[appearance]} ${mode === "work" ? "translate-x-full" : "translate-x-0"}`}
      />
      {OPTIONS.map((option) => {
        const selected = option.id === mode;

        return (
          <button
            aria-pressed={selected}
            className={`relative text-(length:--text-label-size) leading-(--text-label-leading) transition-colors duration-(--motion-duration) ${OPTION_CLASSES[appearance]} ${selected ? "text-foreground font-(--weight-semibold)" : "text-muted-foreground hover:text-foreground font-(--weight-regular)"}`}
            key={option.id}
            onClick={() => onChange(option.id)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  </fieldset>
);
