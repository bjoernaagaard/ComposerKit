// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import "./main.css";
import "./designs/emil/emil.css";
import "./designs/apple/apple.css";
import "./designs/glass/glass.css";
import "./designs/taste/taste.css";
import { StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/app";
import { Catalog } from "./catalog/catalog";
import { startDirection } from "./designs/direction";
import { ComposerStates } from "./states/composer/composer-states";
import { startTheme } from "./theme/apply";

startTheme(document.documentElement);

startDirection();

const root = document.querySelector("#root");

if (!root) {
  throw new Error("index.html is missing the #root element");
}

// /catalog shows every component option; /states/composer is the
// state-machine harness for the composer.
const page = (): ReactNode => {
  if (window.location.pathname === "/catalog") {
    return <Catalog />;
  }

  if (window.location.pathname === "/states/composer") {
    return <ComposerStates />;
  }

  return <App />;
};

createRoot(root).render(<StrictMode>{page()}</StrictMode>);
