// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import "@/main.css";
import "@/designs/emil/emil.css";
import "@/designs/apple/apple.css";
import "@/designs/glass/glass.css";
import "@/designs/taste/taste.css";
import { StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/app";
import { startDirection } from "@/designs/direction";
import { startTheme } from "@/theme/apply";

import { Catalog } from "./catalog/catalog";
import { ComposerStates } from "./states/composer/composer-states";

startTheme(document.documentElement);

startDirection();

const root = document.querySelector("#root");

if (!root) {
  throw new Error("index.html is missing the #root element");
}

// /catalog shows every component option; /states/composer is the
// state-machine harness for the composer. Paths are read after the base
// URL, so the demo also works under a subpath such as GitHub Pages, which
// adds a trailing slash to each route.
const TRAILING_SLASH = /\/$/u;

const route = window.location.pathname
  .slice(import.meta.env.BASE_URL.length - 1)
  .replace(TRAILING_SLASH, "");

const page = (): ReactNode => {
  if (route === "/catalog") {
    return <Catalog />;
  }

  if (route === "/states/composer") {
    return <ComposerStates />;
  }

  return <App />;
};

createRoot(root).render(<StrictMode>{page()}</StrictMode>);
