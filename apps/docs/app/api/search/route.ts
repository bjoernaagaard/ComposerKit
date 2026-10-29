// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { createFromSource } from "fumadocs-core/search/server";

import { source } from "../../../lib/source";

export const revalidate = false;

// The static export writes the search index as a file, and the browser
// searches it with Orama, so no server is needed.
export const { staticGET: GET } = createFromSource(source, {
  language: "english",
});
