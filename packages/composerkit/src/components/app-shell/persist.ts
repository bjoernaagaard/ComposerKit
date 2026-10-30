// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// The sidebar's open state and width, kept in the composerkit_shell cookie
// for 7 days so a reload paints the same layout. A server reads the cookie
// header and passes the values to AppShellProvider as defaultOpen and
// defaultWidth, so the first frame is right. In Next.js, read it in an
// async server component inside <Suspense>, which Cache Components needs:
//
//   const SavedShell = async ({ children }) => {
//     const shell = readShellCookie((await cookies()).toString());
//     return (
//       <AppShellProvider defaultOpen={shell.open} defaultWidth={shell.width}>
//         {children}
//       </AppShellProvider>
//     );
//   };
//
//   <Suspense><SavedShell>{children}</SavedShell></Suspense>
//
// A browser-only app calls readDocumentShellCookie() before it renders. It
// reads document.cookie, whose getter throws where cookies are blocked, such
// as in a sandboxed iframe. Reading and writing never throw: a missing,
// broken or blocked cookie means defaults. This module has no hooks, so a
// server component can call it.
export const SHELL_COOKIE = "composerkit_shell";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const MS_PER_SECOND = 1000;

export interface ShellCookie {
  open?: boolean;
  width?: number;
}

// The saved values in a Cookie header, such as document.cookie. A value
// that is missing or broken is left out.
export const readShellCookie = (
  cookieHeader: string | null | undefined
): ShellCookie => {
  const prefix = `${SHELL_COOKIE}=`;

  const raw = (cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);

  if (!raw) {
    return {};
  }

  try {
    const params = new URLSearchParams(decodeURIComponent(raw));
    const saved: ShellCookie = {};
    const open = params.get("open");
    const width = Number(params.get("width") ?? Number.NaN);

    if (open === "true" || open === "false") {
      saved.open = open === "true";
    }

    if (Number.isFinite(width) && width > 0) {
      saved.width = width;
    }

    return saved;
  } catch {
    return {};
  }
};

// The saved values in this document's cookie, for an app without a server.
// Where the cookie is blocked or there is no document, there are none.
export const readDocumentShellCookie = (): ShellCookie => {
  try {
    return readShellCookie(document.cookie);
  } catch {
    return {};
  }
};

// Saves the values for the next visit. Without a width, none is saved, so
// the next visit uses the theme's width. The Cookie Store API writes it
// where the page is a secure context; elsewhere the classic cookie string
// does.
export const writeShellCookie = (
  state: ShellCookie & { open: boolean }
): void => {
  const params = new URLSearchParams({ open: String(state.open) });

  if (state.width !== undefined) {
    params.set("width", String(state.width));
  }

  const value = encodeURIComponent(params.toString());

  try {
    if (typeof cookieStore !== "undefined") {
      cookieStore
        .set({
          expires: Date.now() + MAX_AGE_SECONDS * MS_PER_SECOND,
          name: SHELL_COOKIE,
          path: "/",
          sameSite: "lax",
          value,
        })
        .catch(() => {
          // Blocked cookies only mean the layout isn't kept for next time.
        });

      return;
    }

    if (typeof document !== "undefined") {
      // oxlint-disable-next-line unicorn/no-document-cookie -- the fallback where the Cookie Store API is missing, such as plain http
      document.cookie = `${SHELL_COOKIE}=${value}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
    }
  } catch {
    // Blocked cookies only mean the layout isn't kept for next time.
  }
};
