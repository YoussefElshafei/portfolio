"use client";

import { MessageSquare } from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * The "Ask about me" button, fixed to the bottom right.
 *
 * The panel and its knowledge base are a separate chunk, fetched the first
 * time the button is pressed (or hovered/focused, so it is usually already
 * there by the click). Nobody who never opens it pays for it.
 */
const loadPanel = () => import("@/components/ask/ask-panel");
const AskPanel = lazy(loadPanel);

export function AskLauncher() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  const close = useCallback(() => {
    restoreFocus.current = true;
    setOpen(false);
  }, []);

  // Focus returns to the control that opened the panel. This waits for the
  // re-render: on phones the button is hidden while the panel is open, and a
  // hidden button cannot take focus.
  useEffect(() => {
    if (!open && restoreFocus.current) {
      restoreFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={everOpened ? "ask-panel" : undefined}
        onPointerEnter={() => void loadPanel()}
        onFocus={() => void loadPanel()}
        onClick={() => {
          setEverOpened(true);
          setOpen((o) => !o);
        }}
        className={`fixed right-4 bottom-4 z-30 inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-window border border-edge bg-surface px-3 text-silk hover:border-copper hover:text-copper sm:right-6 sm:bottom-6 sm:px-4 ${
          open ? "invisible sm:visible" : ""
        }`}
      >
        <MessageSquare className="size-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Ask about me</span>
      </button>

      {everOpened && (
        <Suspense fallback={null}>
          <AskPanel open={open} onClose={close} />
        </Suspense>
      )}
    </>
  );
}
