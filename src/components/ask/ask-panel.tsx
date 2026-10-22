"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { CONTACT } from "@/config/site";
import { ask, type Entry } from "@/lib/ask/engine";
import { ENTRY_BY_ID, INDEX, SUGGESTIONS } from "@/lib/ask/knowledge";

/**
 * The "Ask about me" panel. A non-modal dialog: the page stays usable behind
 * it, Escape closes it, and focus goes to the question field on open and
 * back to the launcher on close.
 *
 * Every reply is computed in the browser by lib/ask/engine.ts. There is no
 * network request anywhere in this file, so there is no loading state, no
 * error state and nothing that can rate-limit.
 */

type Turn =
  | { who: "you"; text: string }
  | { who: "bot"; entry: Entry }
  | { who: "bot"; unknown: true };

const MAX_LEN = 200;

export default function AskPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the newest exchange in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [turns]);

  function submit(question: string) {
    const q = question.trim().slice(0, MAX_LEN);
    if (!q) return;
    const reply = ask(INDEX, q);
    setTurns((t) => [
      ...t,
      { who: "you", text: q },
      reply.kind === "answer"
        ? { who: "bot", entry: reply.entry }
        : { who: "bot", unknown: true },
    ]);
    setDraft("");
    inputRef.current?.focus();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(draft);
  }

  const last = turns[turns.length - 1];
  const chips =
    last && last.who === "bot" && "entry" in last
      ? (last.entry.related ?? [])
          .map((id) => ENTRY_BY_ID.get(id)?.title)
          .filter((t): t is string => Boolean(t))
      : turns.length === 0
        ? [...SUGGESTIONS]
        : [];

  return (
    <div
      id="ask-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      hidden={!open}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[24rem]"
    >
      <h2 id={titleId} className="sr-only">
        Ask about Youssef
      </h2>
      <TerminalWindow
        title="ask youssef"
        bodyClassName=""
        meta={
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-my-2 -mr-2 inline-flex size-9 cursor-pointer items-center justify-center rounded-trace text-silk-faint hover:text-silk pointer-coarse:size-11"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        }
      >
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          className="flex max-h-[min(24rem,55dvh)] flex-col gap-3 overflow-y-auto px-4 py-4 text-micro"
        >
          <p className="font-sans text-silk-dim">
            Ask about Youssef&apos;s projects, skills or availability. Answers
            come only from this site&apos;s content, matched in your browser. No
            AI service, so it won&apos;t guess.
          </p>
          {turns.map((t, i) =>
            t.who === "you" ? (
              <p key={i} className="text-silk">
                <span aria-hidden="true" className="text-copper">
                  ${" "}
                </span>
                <span className="sr-only">You asked: </span>
                {t.text}
              </p>
            ) : "entry" in t ? (
              <div key={i} className="font-sans text-silk-dim">
                <p className="leading-relaxed">{t.entry.answer}</p>
                {t.entry.link && (
                  <a
                    href={t.entry.link.href}
                    onClick={() => {
                      if (t.entry.link?.href.startsWith("#")) onClose();
                    }}
                    {...(t.entry.link.href.startsWith("http")
                      ? { target: "_blank", rel: "noreferrer noopener" }
                      : {})}
                    className="mt-1 inline-block text-copper underline decoration-hairline underline-offset-2 hover:decoration-copper"
                  >
                    {t.entry.link.label}
                  </a>
                )}
              </div>
            ) : (
              <p key={i} className="font-sans text-silk-dim">
                I don&apos;t have that information, but you can email Youssef at{" "}
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="text-copper underline decoration-hairline underline-offset-2 hover:decoration-copper"
                >
                  {CONTACT.email}
                </a>
                .
              </p>
            ),
          )}
        </div>

        {chips.length > 0 && (
          <ul
            aria-label="Suggested questions"
            className="flex flex-wrap gap-2 border-t border-hairline px-4 py-3"
          >
            {chips.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => submit(q)}
                  className="inline-flex min-h-8 cursor-pointer items-center rounded-trace border border-hairline px-2 font-sans text-micro text-silk-dim hover:border-edge hover:text-silk pointer-coarse:min-h-11"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={onSubmit}
          className="flex items-center gap-2 border-t border-hairline px-4 py-3"
        >
          <span aria-hidden="true" className="text-copper">
            $
          </span>
          <label htmlFor={`${titleId}-q`} className="sr-only">
            Your question
          </label>
          <input
            ref={inputRef}
            id={`${titleId}-q`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_LEN}
            autoComplete="off"
            placeholder="Ask a question"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-micro text-silk placeholder:text-silk-faint"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-trace border border-edge px-3 font-sans text-micro text-silk-dim hover:border-copper hover:text-copper"
          >
            Ask
          </button>
        </form>
      </TerminalWindow>
    </div>
  );
}
