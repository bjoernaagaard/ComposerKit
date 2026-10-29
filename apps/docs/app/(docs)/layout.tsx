// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";

import { baseOptions } from "../../lib/layout.shared";
import { source } from "../../lib/source";

const Layout = ({ children }: { children: ReactNode }) => (
  <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
    {children}
  </DocsLayout>
);

export default Layout;
