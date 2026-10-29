// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";

import {
  canRetry,
  canSend,
  composerReducer,
  MAX_UPLOAD_BYTES,
} from "@/components/composer/machine";
import type { Attachment, ComposerState } from "@/components/composer/machine";

export interface ComposerHandlers {
  dictationSupported: boolean;
  handleFiles: (files: File[]) => void;
  handleRetryUpload: (id: string) => void;
  handleStop: () => void;
  handleSubmit: () => void;
  handleToggleDictation: () => void;
}

const holdStill = (): void => {
  // A fixed state, such as one shown in a gallery, ignores every action.
};

// Handlers that do nothing, for showing one fixed composer state.
export const INERT_HANDLERS: ComposerHandlers = {
  dictationSupported: true,
  handleFiles: holdStill,
  handleRetryUpload: holdStill,
  handleStop: holdStill,
  handleSubmit: holdStill,
  handleToggleDictation: holdStill,
};

const UPLOAD_STEP_MS = 120;
const UPLOAD_STEP = 0.12;

// Sending clears the field at once; the reply that follows is the caller's.
const SEND_DELAY_MS = 0;
const OFFLINE_DELAY_MS = 400;

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface SpeechRecognizer {
  continuous: boolean;
  interimResults: boolean;
  onend: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognizerConstructor = new () => SpeechRecognizer;

// Some browsers expose the Web Speech API only with a webkit prefix, and
// some not at all.
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognizerConstructor;
    webkitSpeechRecognition?: SpeechRecognizerConstructor;
  }
}

const speechRecognizer = (): SpeechRecognizerConstructor | null =>
  window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;

// Support never changes while the page is open, so there is nothing to
// subscribe to. On the server there is no window, so dictation is off until
// the page hydrates.
const subscribeToNothing = () => holdStill;
const hasDictation = () => speechRecognizer() !== null;
const noDictationOnServer = () => false;

const toAttachment = (file: File, id: string): Attachment => {
  const tooLarge = file.size > MAX_UPLOAD_BYTES;

  return {
    failure: tooLarge ? "tooLarge" : null,
    id,
    name: file.name,
    progress: 0,
    sizeBytes: file.size,
    status: tooLarge ? "failed" : "uploading",
  };
};

// No upload runs for a file that is uploading in the initial state, so it
// starts as cut off by the connection, which shows its Retry button.
const holdUploads = (initial: ComposerState): ComposerState => ({
  ...initial,
  attachments: initial.attachments.map((attachment) =>
    attachment.status === "uploading"
      ? { ...attachment, failure: "offline", status: "failed" }
      : attachment
  ),
});

// Runs the composer: uploads, sending, stopping and dictation. `initial` is
// read once, on the first render. `onSent` gets the state that was sent.
export const useComposerController = (
  onSent: (state: ComposerState) => void,
  initial: ComposerState
) => {
  const [state, dispatch] = useReducer(composerReducer, initial, holdUploads);
  const stateRef = useRef(state);
  const timers = useRef(new Set<number>());
  const sendTimer = useRef<number | null>(null);
  const recognizer = useRef<SpeechRecognizer | null>(null);

  const dictationSupported = useSyncExternalStore(
    subscribeToNothing,
    hasDictation,
    noDictationOnServer
  );

  // useId gives a prefix no caller's attachment ids can share.
  const idPrefix = useId();
  const attachmentCount = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const active = timers.current;

    return () => {
      for (const id of active) {
        window.clearInterval(id);
      }
    };
  }, []);

  const upload = useCallback((id: string) => {
    let progress = 0;

    const timer = window.setInterval(() => {
      if (!navigator.onLine) {
        window.clearInterval(timer);
        timers.current.delete(timer);
        dispatch({ failure: "offline", id, type: "uploadFailed" });

        return;
      }

      progress = Math.min(1, progress + UPLOAD_STEP);

      if (progress >= 1) {
        window.clearInterval(timer);
        timers.current.delete(timer);
        dispatch({ id, type: "uploadFinished" });

        return;
      }

      dispatch({ id, progress, type: "uploadProgressed" });
    }, UPLOAD_STEP_MS);

    timers.current.add(timer);
  }, []);

  const handlers = useMemo<ComposerHandlers>(
    () => ({
      dictationSupported,
      handleFiles: (files) => {
        // Files are frozen while a message is sending, so nothing attaches.
        if (stateRef.current.phase === "sending") {
          return;
        }

        const attachments = files.map((file) => {
          attachmentCount.current += 1;

          return toAttachment(file, `${idPrefix}a${attachmentCount.current}`);
        });

        dispatch({ attachments, type: "filesAdded" });

        for (const attachment of attachments) {
          if (attachment.status === "uploading") {
            upload(attachment.id);
          }
        }
      },
      handleRetryUpload: (id) => {
        const { current } = stateRef;
        const attachment = current.attachments.find((item) => item.id === id);

        // The reducer ignores the retry otherwise, so no upload starts.
        if (
          current.phase === "sending" ||
          !attachment ||
          !canRetry(attachment)
        ) {
          return;
        }

        dispatch({ id, type: "uploadRetried" });
        upload(id);
      },
      handleStop: () => {
        if (sendTimer.current !== null) {
          window.clearTimeout(sendTimer.current);
          sendTimer.current = null;
        }

        dispatch({ type: "stopped" });
      },
      handleSubmit: () => {
        const { current } = stateRef;

        if (!canSend(current)) {
          return;
        }

        recognizer.current?.stop();
        dispatch({ type: "submitted" });

        if (!navigator.onLine) {
          sendTimer.current = window.setTimeout(() => {
            dispatch({ failure: "offline", type: "sendFailed" });
          }, OFFLINE_DELAY_MS);

          return;
        }

        sendTimer.current = window.setTimeout(() => {
          sendTimer.current = null;
          onSent(current);
          dispatch({ type: "sendSucceeded" });
        }, SEND_DELAY_MS);
      },
      handleToggleDictation: () => {
        if (recognizer.current) {
          recognizer.current.stop();

          return;
        }

        const Recognizer = speechRecognizer();

        if (!Recognizer) {
          return;
        }

        const instance = new Recognizer();
        instance.continuous = true;
        instance.interimResults = false;
        instance.onresult = (event) => {
          for (
            let index = event.resultIndex;
            index < event.results.length;
            index += 1
          ) {
            const result = event.results[index];

            if (result?.isFinal) {
              dispatch({
                text: result[0].transcript.trim(),
                type: "dictationHeard",
              });
            }
          }
        };

        instance.onend = () => {
          recognizer.current = null;
          dispatch({ dictating: false, type: "dictationChanged" });
        };

        recognizer.current = instance;
        instance.start();
        dispatch({ dictating: true, type: "dictationChanged" });
      },
    }),
    [dictationSupported, idPrefix, onSent, upload]
  );

  return { dispatch, handlers, state };
};
