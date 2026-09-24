"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search } from "lucide-react";
import { SECTIONS } from "@/lib/sections";
import { PROJECTS } from "@/data/projects";

/**
 * Command palette — Cmd/Ctrl+K.
 *
 * The third way to move around the site, and the only one built for the
 * keyboard first. The trace bus is the ambient visual route and the header nav
 * is the semantic one; this is the fast one, and it reaches things neither of
 * the others can — a project by a technology it uses, so typing "kafka"
 * surfaces TradeWatch.
 *
 * Implemented as a combobox over a listbox, which is the pattern assistive
 * technology already understands: the input keeps focus throughout and
 * `aria-activedescendant` moves the selection, so arrow keys never strand a
 * screen reader on an element the input no longer owns.
 */

type Command = {
  id: string;
  label: string;
  /** Rendered after the label in mono: the section index, or the match reason. */
  hint?: string;
  group: "Sections" | "Projects";
  href: string;
  /** Extra text matched against, never displayed directly. */
  keywords: readonly string[];
};

const COMMANDS: readonly Command[] = [
  ...SECTIONS.map((s): Command => ({
    id: `section-${s.id}`,
    label: s.label,
    hint: s.ref,
    group: "Sections",
    href: `#${s.id}`,
    keywords: [s.id],
  })),
  ...PROJECTS.map((p): Command => ({
    id: `project-${p.id}`,
    label: p.name,
    group: "Projects",
    href: `#work-${p.id}`,
    // The stack is what makes this better than the nav: a visitor who cares
    // about Kafka can find the project without knowing its name.
    keywords: [p.id, p.tagline, ...p.stack],
  })),
];

/** Substring match across the label and every keyword, case-insensitive. */
function filter(query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...COMMANDS];
  return COMMANDS.filter((c) =>
    [c.label, ...c.keywords].some((s) => s.toLowerCase().includes(q)),
  );
}

/** The stack entry that caused a match, so the result explains itself. */
function matchReason(command: Command, query: string): string | undefined {
  const q = query.trim().toLowerCase();
  if (!q || command.label.toLowerCase().includes(q)) return command.hint;
  const hit = command.keywords.find((k) => k.toLowerCase().includes(q));
  return hit && hit.length < 24 ? hit : command.hint;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const listboxId = useId();
  const titleId = useId();

  /** Flat, in selection order. `active` indexes into this. */
  const results = useMemo(() => filter(query), [query]);

  /**
   * The same results arranged as real groups.
   *
   * Two shapes are needed: a flat list, because keyboard selection is a single
   * index across everything, and a grouped one, because a listbox's headings
   * have to label an actual `role="group"` containing all of that group's
   * options — not just sit above the first of them. Each item carries its flat
   * index so the two never drift apart.
   */
  const grouped = useMemo(() => {
    const out: {
      group: Command["group"];
      items: { command: Command; index: number }[];
    }[] = [];
    results.forEach((command, index) => {
      const last = out[out.length - 1];
      if (last && last.group === command.group)
        last.items.push({ command, index });
      else out.push({ group: command.group, items: [{ command, index }] });
    });
    return out;
  }, [results]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    returnFocusTo.current?.focus();
  }, []);

  const openPalette = useCallback(() => {
    returnFocusTo.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  const run = useCallback((command: Command) => {
    setOpen(false);
    setQuery("");
    setActive(0);
    // Move the hash, then put focus on the destination so a keyboard user
    // continues from where they navigated to rather than from the top.
    window.location.hash = command.href.slice(1);
    const target = document.getElementById(command.href.slice(1));
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  }, []);

  /* Global shortcut. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (v) return false;
          returnFocusTo.current = document.activeElement as HTMLElement | null;
          return true;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* Focus the input, lock scrolling, and keep Tab inside the panel. */
  useEffect(() => {
    if (!open) return;

    inputRef.current?.focus();

    // The input is the only focusable element in the panel: options are
    // `role="option"` divs selected through aria-activedescendant, never tab
    // stops. So the trap is simply to swallow Tab and keep focus where the
    // combobox expects it, rather than cycling through a list of one.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      inputRef.current?.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  /* Keep the highlighted row in view as the selection moves. */
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0,
      );
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(0, results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const command = results[active];
      if (command) run(command);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-trace border border-hairline text-silk-faint hover:border-edge hover:text-silk lg:size-auto lg:px-2.5 lg:py-1.5"
      >
        {/*
          A magnifier below `lg`, the shortcut above it. The shortcut hint is
          useless on a phone — there is no Cmd key — and hiding the trigger
          entirely made the palette unreachable without a keyboard, which meant
          touch users had no way to search projects by stack at all.
        */}
        <Search
          aria-hidden="true"
          className="size-4 lg:hidden"
          strokeWidth={1.75}
        />
        <span
          aria-hidden="true"
          className="hidden font-mono text-micro lg:inline"
        >
          ⌘K
        </span>
        <span className="sr-only">Search sections and projects</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-60">
          <div
            className="absolute inset-0 bg-substrate/80"
            onClick={close}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-4 top-[12vh] mx-auto max-w-column overflow-hidden rounded-trace border border-edge bg-surface sm:inset-x-8"
          >
            <h2 id={titleId} className="sr-only">
              Search sections and projects
            </h2>

            <div className="flex items-center gap-3 border-b border-hairline px-4">
              <span
                aria-hidden="true"
                className="font-mono text-micro text-copper"
              >
                &gt;
              </span>
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  results[active] ? `cmd-${results[active].id}` : undefined
                }
                placeholder="Jump to a section, or a project by name or stack"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKeyDown}
                className="w-full bg-transparent py-3.5 text-body text-silk outline-none placeholder:text-silk-faint"
              />
            </div>

            {/*
              A listbox may only contain `option` and `group` children. The
              first version used <ul>/<li> with <button role="option"> inside
              each <li>, which produced three critical axe violations at once:
              the options were not direct children of the listbox, the <li>
              wrappers were orphaned once the <ul> took a non-list role, and the
              group headings sat inside the list rather than labelling a group.

              Options are divs rather than buttons on purpose. In a combobox the
              options are never individually focusable — focus stays in the
              input and `aria-activedescendant` points at the active one — so a
              <button> here would be both the wrong role and a tab stop that
              should not exist.
            */}
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label="Results"
              className="max-h-[50vh] overflow-y-auto py-2"
            >
              {results.length === 0 && (
                <p className="px-4 py-3 text-micro text-silk-faint">
                  No match for{" "}
                  <span className="font-mono text-silk-dim">{query}</span>
                </p>
              )}

              {grouped.map(({ group, items }) => (
                <div key={group} role="group" aria-label={group}>
                  <p
                    aria-hidden="true"
                    className="px-4 pt-3 pb-1 text-micro text-silk-faint"
                  >
                    {group}
                  </p>
                  {items.map(({ command, index }) => {
                    const isActive = index === active;
                    const hint = matchReason(command, query);
                    return (
                      <div
                        key={command.id}
                        id={`cmd-${command.id}`}
                        data-command
                        data-active={isActive}
                        role="option"
                        aria-selected={isActive}
                        onMouseMove={() => setActive(index)}
                        onClick={() => run(command)}
                        className={`flex cursor-pointer items-baseline justify-between gap-4 px-4 py-2 ${
                          isActive
                            ? "bg-copper-wash text-copper"
                            : "text-silk hover:text-copper"
                        }`}
                      >
                        <span>{command.label}</span>
                        {hint && (
                          <span className="shrink-0 font-mono text-micro text-silk-faint">
                            {hint}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <p className="border-t border-hairline px-4 py-2.5 font-mono text-micro text-silk-faint">
              ↑↓ move · ↵ open · esc close
            </p>
          </div>
        </div>
      )}
    </>
  );
}
