// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import type { ComposerOptions } from "@/components/composer/options";

// The composer as a pure reducer. Each field matches a field of the Rust
// composer state and each action an enum variant, so both ports move
// through the same states.

export type Phase = "idle" | "sending" | "failed";

export type UploadFailure = "tooLarge" | "offline";

export interface Attachment {
  id: string;
  name: string;
  sizeBytes: number;
  status: "uploading" | "ready" | "failed";
  progress: number;
  failure: UploadFailure | null;
}

export type SendFailure = "offline";

export interface ComposerState {
  draft: string;
  attachments: Attachment[];
  phase: Phase;
  failure: SendFailure | null;
  model: string;
  effort: string;
  permission: string;
  projectId: string | null;
  dictating: boolean;
}

export type ComposerAction =
  | { type: "draftChanged"; draft: string }
  | { type: "filesAdded"; attachments: Attachment[] }
  | { type: "uploadProgressed"; id: string; progress: number }
  | { type: "uploadFinished"; id: string }
  | { type: "uploadFailed"; id: string; failure: UploadFailure }
  | { type: "uploadRetried"; id: string }
  | { type: "attachmentRemoved"; id: string }
  | { type: "submitted" }
  | { type: "sendSucceeded" }
  | { type: "sendFailed"; failure: SendFailure }
  | { type: "stopped" }
  | { type: "modelChanged"; model: string }
  | { type: "effortChanged"; effort: string }
  | { type: "permissionChanged"; permission: string }
  | { type: "projectChanged"; projectId: string | null }
  | { type: "dictationChanged"; dictating: boolean }
  | { type: "dictationHeard"; text: string };

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// An empty composer with the first model, effort and permission chosen,
// unless `chosen` names others.
export const initialComposer = (
  options: ComposerOptions,
  chosen: Partial<Pick<ComposerState, "model" | "effort" | "permission">> = {}
): ComposerState => ({
  attachments: [],
  dictating: false,
  draft: "",
  effort: chosen.effort ?? options.efforts[0]?.id ?? "",
  failure: null,
  model: chosen.model ?? options.models[0]?.id ?? "",
  permission: chosen.permission ?? options.permissions[0]?.id ?? "",
  phase: "idle",
  projectId: null,
});

// Retrying only helps an upload the connection cut off.
export const canRetry = (attachment: Attachment): boolean =>
  attachment.status === "failed" && attachment.failure === "offline";

export const isUploading = (state: ComposerState): boolean =>
  state.attachments.some((attachment) => attachment.status === "uploading");

export const canSend = (state: ComposerState): boolean => {
  if (state.phase === "sending" || isUploading(state)) {
    return false;
  }

  const hasReadyFile = state.attachments.some(
    (attachment) => attachment.status === "ready"
  );

  return state.draft.trim().length > 0 || hasReadyFile;
};

const updateAttachment = (
  state: ComposerState,
  id: string,
  patch: Partial<Attachment>
): ComposerState => ({
  ...state,
  attachments: state.attachments.map((attachment) =>
    attachment.id === id ? { ...attachment, ...patch } : attachment
  ),
});

// A second file with an id in use would act as the same file, so it is
// left out.
const addNew = (
  attachments: Attachment[],
  added: Attachment[]
): Attachment[] => {
  const ids = new Set(attachments.map(({ id }) => id));

  const fresh = added.filter(({ id }) => {
    const isNew = !ids.has(id);
    ids.add(id);

    return isNew;
  });

  return [...attachments, ...fresh];
};

const retryUpload = (state: ComposerState, id: string): ComposerState => {
  const attachment = state.attachments.find((item) => item.id === id);

  if (!(attachment && canRetry(attachment))) {
    return state;
  }

  return updateAttachment(state, id, {
    failure: null,
    progress: 0,
    status: "uploading",
  });
};

const appendSpoken = (draft: string, text: string): string => {
  if (draft.length === 0 || draft.endsWith(" ") || draft.endsWith("\n")) {
    return `${draft}${text}`;
  }

  return `${draft} ${text}`;
};

// While a message is in flight its draft and files are frozen, because a
// successful send clears them and would drop anything added meanwhile.
const FROZEN_WHILE_SENDING = new Set<ComposerAction["type"]>([
  "attachmentRemoved",
  "dictationHeard",
  "draftChanged",
  "filesAdded",
  "uploadRetried",
]);

const applyAction = (
  state: ComposerState,
  action: ComposerAction
): ComposerState => {
  switch (action.type) {
    case "draftChanged": {
      return { ...state, draft: action.draft };
    }

    case "filesAdded": {
      return {
        ...state,
        attachments: addNew(state.attachments, action.attachments),
      };
    }

    case "uploadProgressed": {
      return updateAttachment(state, action.id, { progress: action.progress });
    }

    case "uploadFinished": {
      return updateAttachment(state, action.id, {
        progress: 1,
        status: "ready",
      });
    }

    case "uploadFailed": {
      return updateAttachment(state, action.id, {
        failure: action.failure,
        status: "failed",
      });
    }

    case "uploadRetried": {
      return retryUpload(state, action.id);
    }

    case "attachmentRemoved": {
      return {
        ...state,
        attachments: state.attachments.filter(
          (attachment) => attachment.id !== action.id
        ),
      };
    }

    case "submitted": {
      if (!canSend(state)) {
        return state;
      }

      return { ...state, dictating: false, failure: null, phase: "sending" };
    }

    case "sendSucceeded": {
      return {
        ...state,
        attachments: [],
        draft: "",
        failure: null,
        phase: "idle",
      };
    }

    case "sendFailed": {
      return { ...state, failure: action.failure, phase: "failed" };
    }

    case "stopped": {
      return { ...state, phase: "idle" };
    }

    case "modelChanged": {
      return { ...state, model: action.model };
    }

    case "effortChanged": {
      return { ...state, effort: action.effort };
    }

    case "permissionChanged": {
      return { ...state, permission: action.permission };
    }

    case "projectChanged": {
      return { ...state, projectId: action.projectId };
    }

    case "dictationChanged": {
      return { ...state, dictating: action.dictating };
    }

    case "dictationHeard": {
      return { ...state, draft: appendSpoken(state.draft, action.text) };
    }

    default: {
      return state;
    }
  }
};

export const composerReducer = (
  state: ComposerState,
  action: ComposerAction
): ComposerState =>
  state.phase === "sending" && FROZEN_WHILE_SENDING.has(action.type)
    ? state
    : applyAction(state, action);
