// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { PopupLayer } from "@/components/ui/popup-layer";

// The live half of a preview. Menus and tooltips mount inside it, so they
// get the preview's styles, and the example's own root element is tagged
// with data-example, so a test can find exactly what the example draws.
// target picks an element inside the example instead of its root.
export const PreviewFrame = ({
  name,
  target,
  children,
}: {
  name: string;
  target?: string;
  children: ReactNode;
}) => {
  const root = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const element = target
      ? root.current?.querySelector(target)
      : root.current?.firstElementChild;

    if (element instanceof HTMLElement) {
      element.dataset.example = name;
    }
  });

  return (
    <PopupLayer container={layer}>
      <div className="contents" ref={root}>
        {children}
      </div>
      <div ref={setLayer} />
    </PopupLayer>
  );
};
