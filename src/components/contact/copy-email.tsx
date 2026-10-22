"use client";

import { useEffect, useState } from "react";
import { CONTACT } from "@/config/site";

/**
 * Copies the address, and says so. The confirmation is a live region rather
 * than a toast, so a screen reader hears it and nothing pops over the page.
 *
 * If the Clipboard API is unavailable or refused (an insecure context, a
 * locked-down browser), the button says to copy the address shown above it
 * instead of failing silently.
 */
export function CopyEmail({ className = "" }: { className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <>
      <button type="button" onClick={copy} className={className}>
        {state === "copied" ? "Copied" : "Copy email"}
      </button>
      <span aria-live="polite" className="sr-only">
        {state === "copied"
          ? "Email address copied"
          : state === "failed"
            ? "Couldn't copy. The address is shown on the page."
            : ""}
      </span>
    </>
  );
}
