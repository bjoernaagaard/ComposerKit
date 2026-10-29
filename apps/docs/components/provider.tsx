// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { DirectionScript, startDirection } from "@/designs/direction";

import StaticSearchDialog from "./search";

export const Provider = ({ children }: { children: ReactNode }) => {
  // The inline script set the attribute before paint. This adds Emil's
  // listeners.
  useEffect(startDirection, []);

  return (
    <RootProvider search={{ SearchDialog: StaticSearchDialog }}>
      <DirectionScript />
      {children}
    </RootProvider>
  );
};
