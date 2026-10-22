"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { CONTACT, WEB3FORMS_KEY } from "@/config/site";
import { NO_RESTORE } from "@/lib/no-restore";

/**
 * "Say hello": a three-field form that posts to Web3Forms.
 *
 * Designed so it cannot become the "contact form that posts nowhere"
 * (DESIGN_BRIEF.md §1c, amended in §2.8):
 *
 *  - Without a configured key the form does not render at all, and the
 *    section falls back to the visible address it always had.
 *  - Any failure (network, timeout, a refusal from the service) ends in a
 *    mailto link prefilled with what the visitor typed, so nothing they
 *    wrote is lost and they are one click from sending it anyway.
 *  - The access key is public by design. Web3Forms keys only let someone
 *    send mail to the owner's inbox, which is what a form does; it is not a
 *    secret, and it comes from an environment variable so it is not in git.
 *
 * Spam: a honeypot checkbox that people never see and bots tick. Web3Forms
 * drops any submission with `botcheck` set. No captcha, so no third-party
 * script and no puzzle for a recruiter to solve.
 */

const ENDPOINT = "https://api.web3forms.com/submit";
const TIMEOUT_MS = 10_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Fields = { name: string; email: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;
type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "failed" };

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Please add your name.";
  if (!EMAIL_RE.test(f.email.trim()))
    e.email = "Please add an email address I can reply to.";
  if (f.message.trim().length < 10)
    e.message = "A sentence or two, please (10 characters or more).";
  return e;
}

/** The fallback: the same message, ready to send from the visitor's own mail app. */
export function mailtoFor(f: Partial<Fields> = {}) {
  const subject = f.name?.trim()
    ? `Hello from ${f.name.trim()}`
    : "Hello from your portfolio";
  const body = f.message?.trim() ?? "";
  const q = new URLSearchParams({ subject, body })
    .toString()
    .replace(/\+/g, "%20");
  return `mailto:${CONTACT.email}?${q}`;
}

const FIELD =
  "w-full rounded-trace border border-edge bg-substrate px-3 py-2.5 text-silk placeholder:text-silk-faint focus-visible:border-copper aria-[invalid=true]:border-copper";

export function ContactForm() {
  const id = useId();
  const [fields, setFields] = useState<Fields>({
    name: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  if (!WEB3FORMS_KEY) return null;

  const set = (k: keyof Fields) => (v: string) => {
    setFields((f) => ({ ...f, [k]: v }));
    // Clear a field's error as soon as it is being fixed, not on next submit.
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const found = validate(fields);
    setErrors(found);
    const first = (Object.keys(found) as (keyof Fields)[])[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    const honeypot = new FormData(ev.currentTarget).get("botcheck");
    setStatus({ kind: "sending" });
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `Portfolio: message from ${fields.name.trim()}`,
          from_name: "youssefelshafei.com",
          name: fields.name.trim(),
          email: fields.email.trim(),
          message: fields.message.trim(),
          botcheck: honeypot ? true : false,
        }),
        signal: abort.signal,
      });
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
      } | null;
      setStatus({ kind: res.ok && data?.success ? "sent" : "failed" });
    } catch {
      setStatus({ kind: "failed" });
    } finally {
      clearTimeout(timer);
    }
  }

  if (status.kind === "sent") {
    return (
      <div
        role="status"
        className="rounded-trace border border-signal/40 px-4 py-4 text-silk"
      >
        <p className="font-medium">
          Thanks, {fields.name.trim()}. It&apos;s sent.
        </p>
        <p className="mt-1 text-silk-dim">
          I&apos;ll reply to {fields.email.trim()}, usually within a couple of
          days.
        </p>
      </div>
    );
  }

  const sending = status.kind === "sending";
  const describe = (k: keyof Fields) =>
    errors[k] ? `${id}-${k}-error` : undefined;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-5"
    >
      <h3 id={`${id}-title`} className="text-h3">
        Say hello
      </h3>

      <div className="grid gap-5 sm:grid-cols-2">
        {(
          [
            ["name", "Name", "text", "name"],
            ["email", "Email", "email", "email"],
          ] as const
        ).map(([k, label, type, autoComplete]) => (
          <div key={k} className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-${k}`} className="text-micro text-silk-dim">
              {label}
            </label>
            <input
              id={`${id}-${k}`}
              name={k}
              type={type}
              autoComplete={autoComplete}
              required
              value={fields[k]}
              onChange={(e) => set(k)(e.target.value)}
              aria-invalid={errors[k] ? true : undefined}
              aria-describedby={describe(k)}
              className={FIELD}
            />
            {errors[k] && (
              <p id={`${id}-${k}-error`} className="text-micro text-copper">
                {errors[k]}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-message`} className="text-micro text-silk-dim">
          Message
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          required
          rows={5}
          maxLength={5000}
          value={fields.message}
          onChange={(e) => set("message")(e.target.value)}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describe("message")}
          className={`${FIELD} resize-y`}
        />
        {errors.message && (
          <p id={`${id}-message-error`} className="text-micro text-copper">
            {errors.message}
          </p>
        )}
      </div>

      {/* Honeypot. Off screen rather than display:none, which some bots skip,
          and out of the tab order and the accessibility tree. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label>
          Leave this unticked
          <input
            type="checkbox"
            name="botcheck"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          {...NO_RESTORE}
          disabled={sending}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-trace border border-copper bg-copper px-5 font-medium text-substrate hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send message"}
        </button>
        <p className="text-micro text-silk-faint">
          Or email me directly; the address is above.
        </p>
      </div>

      <p aria-live="polite" className="text-micro">
        {status.kind === "failed" && (
          <span className="text-silk">
            That didn&apos;t go through, and nothing you wrote is lost.{" "}
            <a
              href={mailtoFor(fields)}
              className="text-copper underline underline-offset-2"
            >
              Send it from your email app instead
            </a>
            .
          </span>
        )}
      </p>
    </form>
  );
}
