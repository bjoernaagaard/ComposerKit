// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

/* oxlint-disable shadcn/no-unknown-classes -- harness classes live in switcher.css, outside the design system on purpose */
import "./switcher.css";
import { CornerDownRightIcon } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";

import { Composer } from "@/components/composer/composer";
import { composerReducer } from "@/components/composer/machine";
import { INERT_HANDLERS } from "@/components/composer/use-composer-controller";
import { PopupLayer } from "@/components/ui/popup-layer";
import { TipProvider } from "@/components/ui/tip";
import { COMPOSER_OPTIONS } from "@/content/catalog";
import { SAMPLE_PROJECTS } from "@/content/sample";
import { DirectionSelector } from "@/designs/direction";

import { FIXTURES } from "./fixtures";
import type { StateFixture } from "./fixtures";

const PARAM = "__state";

const [DEFAULT_ENTRY] = FIXTURES;

if (!DEFAULT_ENTRY) {
  throw new Error("The harness needs at least one entry");
}

const readState = (): StateFixture => {
  const id = new URLSearchParams(window.location.search).get(PARAM);

  return FIXTURES.find((item) => item.id === id) ?? DEFAULT_ENTRY;
};

const writeState = (id: string): void => {
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, id);
  window.history.replaceState(null, "", url);
};

const GROUPS = [...Map.groupBy(FIXTURES, (item) => item.group)];

// Text fields and open menus own their keys, so the harness leaves them be.
// Menus leave Left, Right and letter keys unhandled.
const ownsKeys = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.closest('[role="menu"]') !== null);

const HeadingArrow = () => (
  <CornerDownRightIcon aria-hidden="true" className="size-3" />
);

// One fixture rendered through the real Composer. Keyed by state id, so
// switching states resets it. Handlers are inert, so pending states hold still.
const Stage = ({ fixture }: { fixture: StateFixture }) => {
  const [state, dispatch] = useReducer(composerReducer, fixture.state);

  return (
    <Composer
      dispatch={dispatch}
      handlers={{
        ...INERT_HANDLERS,
        dictationSupported: fixture.dictationSupported,
      }}
      mode={fixture.mode}
      options={COMPOSER_OPTIONS}
      projects={SAMPLE_PROJECTS}
      state={state}
    />
  );
};

export const ComposerStates = () => {
  const [active, setActive] = useState(readState);
  const [hidden, setHidden] = useState(false);
  const [popupLayer, setPopupLayer] = useState<HTMLDivElement | null>(null);
  const list = useRef<HTMLElement>(null);

  const select = (id: string) => {
    const next = FIXTURES.find((item) => item.id === id);

    if (next) {
      writeState(id);
      setActive(next);
    }
  };

  useEffect(() => {
    list.current
      ?.querySelector(`[data-entry="${active.id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        ownsKeys(event.target)
      ) {
        return;
      }

      if (event.key === "h" || event.key === "H") {
        setHidden((value) => !value);

        return;
      }

      const step = { ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1 }[
        event.key
      ];

      if (!step) {
        return;
      }

      event.preventDefault();
      const index = FIXTURES.findIndex((item) => item.id === active.id);
      const next = FIXTURES[(index + step + FIXTURES.length) % FIXTURES.length];

      if (next) {
        writeState(next.id);
        setActive(next);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <TipProvider>
      <PopupLayer container={popupLayer}>
        <main
          className="state-page bg-background text-foreground h-full overflow-y-auto"
          data-hidden={hidden}
        >
          <h1 className="sr-only">Composer states</h1>
          <div className="p-3">
            <DirectionSelector />
          </div>
          <div className="state-layout">
            <nav aria-label="States" className="state-switcher" ref={list}>
              {GROUPS.map(([group, items]) => (
                <fieldset className="state-switcher-group" key={group}>
                  <legend className="state-switcher-heading">
                    <HeadingArrow />
                    {group}
                  </legend>
                  {items.map((item) => (
                    <button
                      aria-pressed={item.id === active.id}
                      data-entry={item.id}
                      key={item.id}
                      onClick={() => select(item.id)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </fieldset>
              ))}
            </nav>
            <div className="state-switcher-select">
              <select
                aria-label="State"
                onChange={(event) => select(event.target.value)}
                value={active.id}
              >
                {GROUPS.map(([group, items]) => (
                  <optgroup key={group} label={group}>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <svg
                aria-hidden="true"
                fill="none"
                height="12"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                viewBox="0 0 16 16"
                width="12"
              >
                <path d="m4 6 4 4 4-4" />
              </svg>
            </div>
            <div className="state-stage">
              <Stage fixture={active} key={active.id} />
            </div>
          </div>
          <div ref={setPopupLayer} />
        </main>
      </PopupLayer>
    </TipProvider>
  );
};
