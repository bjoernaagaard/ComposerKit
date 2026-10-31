// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { useEffect, useState } from "react";
import type { ClipboardEvent, DOMAttributes, DragEvent } from "react";

export interface FileDropState {
  // A drag that carries files is somewhere over the window.
  ready: boolean;
  // The files are over this element.
  over: boolean;
}

export type FileDropZoneProps = Pick<
  DOMAttributes<HTMLElement>,
  "onDragEnter" | "onDragOver" | "onDragLeave" | "onDrop" | "onPaste"
>;

export interface FileDrop {
  state: FileDropState;
  zoneProps: FileDropZoneProps;
}

const IDLE: FileDropState = { over: false, ready: false };

const NO_ZONE: FileDropZoneProps = {};

// A drag of selected text or a link carries no "Files", so it is left to
// the browser and drops into a text field as before.
const carriesFiles = (transfer: DataTransfer | null): boolean =>
  transfer?.types.includes("Files") ?? false;

// Takes files dropped on one element, or pasted into it, and hands them to
// onFiles. While it is enabled, a file dropped anywhere else in the window
// does nothing, so the browser never leaves the app to open it. Spread
// zoneProps on the element. state tells it when files enter the window and
// when they are over it.
export const useFileDrop = ({
  enabled,
  onFiles,
}: {
  enabled: boolean;
  onFiles: (files: File[]) => void;
}): FileDrop => {
  const [ready, setReady] = useState(false);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // dragenter and dragleave fire for every element the pointer crosses,
    // so only the count reaching zero means the files left the window.
    let depth = 0;

    const finish = () => {
      depth = 0;
      setReady(false);
      setOver(false);
    };

    const onEnter = (event: globalThis.DragEvent) => {
      if (carriesFiles(event.dataTransfer)) {
        depth += 1;
        setReady(true);
      }
    };

    const onLeave = (event: globalThis.DragEvent) => {
      if (!carriesFiles(event.dataTransfer)) {
        return;
      }

      depth = Math.max(0, depth - 1);

      if (depth === 0) {
        finish();
      }
    };

    // Runs after the drop zone's own handler, which has taken the files
    // when it prevented the default.
    const onOver = (event: globalThis.DragEvent) => {
      if (
        event.defaultPrevented ||
        !event.dataTransfer ||
        !carriesFiles(event.dataTransfer)
      ) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "none";
    };

    const onDrop = (event: globalThis.DragEvent) => {
      if (carriesFiles(event.dataTransfer)) {
        event.preventDefault();
        finish();
      }
    };

    window.addEventListener("dragenter", onEnter, true);
    window.addEventListener("dragleave", onLeave, true);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop, true);
    window.addEventListener("dragend", finish, true);

    return () => {
      window.removeEventListener("dragenter", onEnter, true);
      window.removeEventListener("dragleave", onLeave, true);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop, true);
      window.removeEventListener("dragend", finish, true);
      setReady(false);
      setOver(false);
    };
  }, [enabled]);

  if (!enabled) {
    return { state: IDLE, zoneProps: NO_ZONE };
  }

  const accept = (event: DragEvent<HTMLElement>) => {
    if (carriesFiles(event.dataTransfer)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setOver(true);
    }
  };

  return {
    state: { over, ready },
    zoneProps: {
      onDragEnter: accept,
      onDragLeave: (event) => {
        const { relatedTarget } = event;

        if (
          !(relatedTarget instanceof Node) ||
          !event.currentTarget.contains(relatedTarget)
        ) {
          setOver(false);
        }
      },
      onDragOver: accept,
      onDrop: (event) => {
        if (carriesFiles(event.dataTransfer)) {
          event.preventDefault();
          event.stopPropagation();
          onFiles([...event.dataTransfer.files]);
        }
      },
      onPaste: (event: ClipboardEvent<HTMLElement>) => {
        const files = [...event.clipboardData.files];

        // Without files, text pastes as it always has.
        if (files.length > 0) {
          event.preventDefault();
          onFiles(files);
        }
      },
    },
  };
};
