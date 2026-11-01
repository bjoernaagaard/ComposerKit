// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import "./global.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Provider } from "../components/provider";

export const metadata: Metadata = {
  description:
    "Composer and conversation components for React, installed with shadcn.",
  title: { default: "ComposerKit", template: "%s · ComposerKit" },
};

const Layout = ({ children }: { children: ReactNode }) => (
  <html lang="en" suppressHydrationWarning>
    <body className="flex min-h-screen flex-col" suppressHydrationWarning>
      <Provider>{children}</Provider>
    </body>
  </html>
);

export default Layout;
