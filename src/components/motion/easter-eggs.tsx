"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CONTACT } from "@/config/site";

/**
 * Hidden extras, for the curious. None of them changes what the page says or
 * gets in the way of reading it, and each one undoes itself.
 *
 * - The Konami code (↑ ↑ ↓ ↓ ← → ← → B A) overclocks the board: the circuit
 *   backdrop runs hot and fast until the code is entered again.
 * - Typing "siuu" anywhere celebrates the greatest of all time.
 * - A note in the browser console for anyone reading the source.
 *
 * The WireFish terminal has its own (try `sudo`), in terminal.tsx.
 * Keys are ignored while typing into a field, so none of this can fire by
 * accident inside the contact form, the chatbot or a demo.
 */

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];
const SIUU = ["s", "i", "u", "u"];

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

const endsWith = (buf: string[], seq: string[]) =>
  buf.length >= seq.length &&
  seq.every((k, i) => buf[buf.length - seq.length + i] === k);

/** Burst particles, fixed so the server and client render the same thing. */
const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  const d = 140 + ((i * 37) % 90);
  return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: 4 + (i % 3) * 2 };
});

export function EasterEggs() {
  const reduced = useReducedMotion();
  const [toast, setToast] = useState<string | null>(null);
  const [siuu, setSiuu] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // For the people who open devtools on a portfolio. Hello.
    console.log(
      "%c▣ youssefelshafei.com%c\n\nReading the source? Good instinct.\nEverything here is a static Next.js site; the demos are ports of each project's real logic.\n\nTry the Konami code, or type siuu.\nSay hi: " +
        CONTACT.email,
      "color:#f0803c;font:600 14px monospace",
      "color:inherit;font:12px monospace",
    );
  }, []);

  useEffect(() => {
    const say = (text: string) => {
      setToast(text);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 3200);
    };
    let buf: string[] = [];
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      buf = [...buf, key].slice(-KONAMI.length);
      if (endsWith(buf, KONAMI)) {
        buf = [];
        const root = document.documentElement;
        const on = !root.hasAttribute("data-overclock");
        root.toggleAttribute("data-overclock", on);
        say(
          on
            ? "Overclocked. The board is running hot."
            : "Back to stock clocks.",
        );
      } else if (endsWith(buf, SIUU)) {
        buf = [];
        setSiuu((n) => n + 1);
        say("SIUUU! Ronaldo is the GOAT.");
      }
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <>
      <p
        role="status"
        className="pointer-events-none fixed top-20 left-1/2 z-50 -translate-x-1/2"
      >
        <AnimatePresence>
          {toast && (
            <motion.span
              key={toast}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              className="shadow-lg shadow-black/40 block rounded-window border border-copper bg-surface px-4 py-2 font-mono text-micro text-copper"
            >
              {toast}
            </motion.span>
          )}
        </AnimatePresence>
      </p>

      {/* The celebration. Decorative: the toast above announces it. */}
      <AnimatePresence>
        {siuu > 0 && !reduced && (
          <motion.div
            key={siuu}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ delay: 1.4, duration: 0.5 }}
            onAnimationComplete={() => setSiuu(0)}
          >
            <motion.span
              className="font-mono text-[clamp(3rem,12vw,9rem)] font-semibold tracking-tight text-copper"
              style={{ textShadow: "0 0 40px rgba(240,128,60,0.55)" }}
              initial={{ scale: 0.4, y: 40, rotate: -6 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
            >
              SIUUU
            </motion.span>
            {SPARKS.map((p, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full bg-copper"
                style={{ width: p.s, height: p.s }}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{ x: p.x, y: p.y, opacity: 0 }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
