// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

const PopupLayerContext = createContext<HTMLElement | undefined>(undefined);

// Where tooltips and menus mount. Without a PopupLayer they go to the end
// of <body>, outside every landmark. An app can give them an element inside
// one, such as its main region, so all of its content sits in a landmark.
// Popups are positioned against the window, so a layer inside a region that
// scrolls or clips does not cut them off. Keep the layer out of anything
// made inert, or the popups go inert with it.
export interface PopupLayerProps {
  container: HTMLElement | null;
  children: ReactNode;
}

export const PopupLayer = ({ container, children }: PopupLayerProps) => (
  <PopupLayerContext value={container ?? undefined}>
    {children}
  </PopupLayerContext>
);

export const usePopupLayer = (): HTMLElement | undefined =>
  useContext(PopupLayerContext);
