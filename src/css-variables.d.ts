// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import "react";

// Lets style props carry CSS custom properties such as --icon without a cast.
declare module "react" {
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined;
  }
}
