// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useStaticSearch } from "fumadocs-core/search/client";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
} from "fumadocs-ui/components/dialog/search";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";

// Searches the index that /api/search writes at build time, in the browser.
// Fumadocs reads the base path from Vite's import.meta.env, which Next does
// not set, so the index URL names the base path itself.
const SEARCH_INDEX = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/search`;

const StaticSearchDialog = (props: SharedProps) => {
  const search = useStaticSearch({ from: SEARCH_INDEX });

  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList />
      </SearchDialogContent>
    </SearchDialog>
  );
};

export default StaticSearchDialog;
