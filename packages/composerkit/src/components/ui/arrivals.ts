// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { useEffect, useState } from "react";

// Elements that arrive while a person watches, such as a message they sent
// or a file they attached, ease in instead of popping. What was already
// there when the view mounted stays still, and so does a whole list that
// was swapped for another, such as opening a different chat.
//
// An element marked data-entering on its first render gets its first style
// from @starting-style, and then transitions to its resting style. The mark
// stays for the element's life, because @starting-style only applies once,
// and taking the mark off mid-way would cut the transition short.

// Fades and grows a little, for chips and the jump button.
export const ENTER_POP =
  "data-entering:transition-[opacity,scale] data-entering:duration-(--motion-enter) data-entering:ease-(--motion-ease-out) data-entering:starting:opacity-0 data-entering:motion-safe:starting:scale-(--enter-scale)";

// Fades and grows from further back, for an icon that replaces another.
export const ENTER_ICON =
  "data-entering:transition-[opacity,scale] data-entering:duration-(--motion-enter) data-entering:ease-(--motion-ease-out) data-entering:starting:opacity-0 data-entering:motion-safe:starting:scale-(--icon-enter-scale)";

// Fades and rises a few pixels into place, for a message in a conversation.
export const ENTER_RISE =
  "data-entering:transition-[opacity,translate] data-entering:duration-(--motion-turn-enter) data-entering:ease-(--motion-ease-out) data-entering:starting:opacity-0 data-entering:motion-safe:starting:translate-y-(--space-turn-enter-offset)";

const NONE: ReadonlySet<string> = new Set();

interface Memory {
  key: string;
  known: ReadonlySet<string>;
  arrived: ReadonlySet<string>;
}

// The ids that arrived after the first render. It is empty on the first
// render, and when none of the earlier ids remain, because then the whole
// list was replaced rather than added to. It keeps what it saw in state and
// updates it during render, as React documents for reading earlier props.
export const useArrivals = (ids: readonly string[]): ReadonlySet<string> => {
  const key = JSON.stringify(ids);

  const [memory, setMemory] = useState<Memory>(() => ({
    arrived: NONE,
    key,
    known: new Set(ids),
  }));

  if (memory.key === key) {
    return memory.arrived;
  }

  const fresh = ids.filter((id) => !memory.known.has(id));
  const replaced = memory.known.size > 0 && fresh.length === ids.length;
  let { arrived } = memory;

  if (replaced) {
    arrived = NONE;
  } else if (fresh.length > 0) {
    arrived = new Set([...ids.filter((id) => arrived.has(id)), ...fresh]);
  }

  setMemory({ arrived, key, known: new Set(ids) });

  return arrived;
};

// False until the calling component has mounted. Something it renders after
// that, such as a new icon, arrived while a person watched.
export const useHasCommitted = (): boolean => {
  const [committed, setCommitted] = useState(false);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- a mount is the event this records
    setCommitted(true);
  }, []);

  return committed;
};
