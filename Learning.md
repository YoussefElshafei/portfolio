# Learning.md

A running explanation of this codebase, written to be read cold — months later, the night
before an interview, with no memory of building it.

**How to read this.** Part 1 is the map. Part 2 is the concepts, each one a thing you could
plausibly be asked about in an interview, explained from the problem rather than the
solution. Part 3 is the decision log, including things that were tried and thrown away.
Part 4 is questions with answers. Part 5 is the dated session log.

If you only have twenty minutes: read Part 2.3 (theming), Part 2.4 (contrast), Part 2.7
(accessibility) and Part 3. Those are where the real engineering is.

---

## Part 1 — The map

### What this project is

A personal portfolio site. The governing constraint is unusual and worth being able to
state out loud: **it must not look AI-generated.** `DESIGN_BRIEF.md` holds the full
anti-pattern list and the visual system; this file explains how that spec became code.

### Stack

| Layer      | Choice                               | Version installed |
| ---------- | ------------------------------------ | ----------------- |
| Framework  | Next.js, App Router                  | 16.3.5            |
| UI runtime | React                                | 19.2.8            |
| Language   | TypeScript, strict                   | 5.9.3             |
| Styling    | Tailwind CSS v4, CSS-first           | 4.x               |
| Animation  | `motion` (formerly Framer Motion)    | 13.4.0            |
| Icons      | `lucide-react` + inlined brand marks | 1.47.0            |
| Host       | Vercel                               | —                 |

### File map

```
src/
  app/
    globals.css          Design tokens, both themes, keyframes. The system's root.
    layout.tsx           Fonts, blocking theme script, page shell, metadata.
    page.tsx             Composes the seven sections. Nothing else.
    icon.svg             Favicon, drawn from the trace-bus motif.
  components/
    sections/            hero, about, skills, work, experience, involvement,
                         contact, and the shared section shell. All server-rendered.
    work/
      project-entry.tsx  One project: framing, disclosure, tags, links.
    nav/
      trace-bus.tsx      The PCB trace in the left gutter. Scroll indicator + nav.
      site-header.tsx    The real <nav>. Carries all semantics.
      mobile-nav.tsx     Sheet dialog. The whole navigation below `lg`.
    theme/
      theme-script.tsx   Blocking script that sets the theme before first paint.
      theme-toggle.tsx   Stateless sun/moon button.
    graph/
      project-graph.tsx  Node/edge diagram with a real list underneath it.
    motion/reveal.tsx    The two entrance primitives. The only other client code.
    visuals/pipeline.tsx TradeWatch's architecture, drawn in the trace language.
    icons/brand.tsx      GitHub / LinkedIn / envelope marks, inlined.
    contact-links.tsx    Shared by the contact section and the footer.
    site-footer.tsx
  lib/
    sections.ts          Section registry. Single source of truth for all navigation.
    nav-state.tsx        Context shared by the header nav and the trace bus.
  data/
    projects.ts          All six projects, including their graph coordinates.
    profile.ts           About, education, skills, experience, certifications.
    graph.ts             Derives graph nodes and edges from projects.ts.
  config/
    site.ts              Name, role, contact URLs. One file to edit.
```

### The two architectural ideas worth remembering

**1. One registry drives every navigation surface.** `src/lib/sections.ts` exports an array
of `{ id, label, ref }`. The header nav, the mobile sheet and the trace bus all map over
that same array. Add a section in one place and three UI surfaces update. They cannot drift
out of sync because there is nothing to keep in sync.

**2. The header nav and the trace bus are one instrument, not two menus.** They share state
through `NavStateProvider`. Focusing a header link lights the matching pad on the trace bus
and fires its packet animation. This matters for the interview answer: a decorative visual
that duplicates a menu is a liability; one wired into the same state reads as deliberate.

---

## Part 2 — Concepts

### 2.1 Next.js App Router: Server and Client Components

Everything in `app/` is a **React Server Component** by default. It runs on the server,
never ships its code to the browser, and can do things like read files or hit a database
directly. It cannot use `useState`, `useEffect`, or event handlers, because there is no
browser to run them in.

`"use client"` at the top of a file marks a **client boundary**. The thing most people get
wrong: it does not mean "this one component is a client component." It means _this module
and everything it imports_ gets bundled and shipped to the browser.

In this codebase that distinction is doing real work:

- `site-footer.tsx` has no `"use client"`. It is a Server Component. Its icon SVGs and
  links are rendered to HTML on the server and the browser downloads **zero JavaScript**
  for it.
- `trace-bus.tsx`, `site-header.tsx`, `mobile-nav.tsx`, `project-graph.tsx` and
  `theme-toggle.tsx` all need interactivity, so they are client components.
- `layout.tsx` stays a Server Component even though it _renders_ client components. A
  server component can render a client component; it just cannot pass a function as a prop
  to one.

**Interview framing:** "Server Components let me ship the footer as pure HTML with no
hydration cost, while still using React to author it."

#### Static prerendering

The build output prints:

```
Route (app)
┌ ○ /
├ ○ /_not-found
└ ○ /icon.svg
○  (Static)  prerendered as static content
```

`○` means the route was rendered to HTML at build time. There is no server work per
request — a CDN serves a file. This site has no dynamic data, so every route should stay
`○`. If one ever flips to `ƒ` (dynamic), something introduced a request-time dependency
like `cookies()` or `headers()`, and that is worth investigating rather than accepting.

#### `next/font`

```ts
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
```

Three things happen here that are easy to undersell:

1. **The font is downloaded at build time and self-hosted.** No request to
   `fonts.googleapis.com` at runtime. That removes a third-party connection, a DNS lookup
   and a privacy problem.
2. **A CSS variable is generated**, applied via `className={plexSans.variable}` on `<html>`,
   which is how Tailwind's `--font-sans` token points at it.
3. **Layout shift is eliminated.** Next computes fallback font metrics (`size-adjust`,
   `ascent-override`) so the fallback occupies the same space as the real font. This is why
   the measured CLS is `0.0000`. Without it, text reflows when the webfont lands and CLS
   goes up.

`display: "swap"` means text renders immediately in the fallback rather than being
invisible while the font loads (the "FOIT" problem).

Only the weights actually used are listed. Each weight is a separate file; listing weights
you never use is pure waste. This site ships three sans weights and two mono, 59.8 KB total.

---

### 2.2 Tailwind CSS v4: CSS-first configuration

**v3 had `tailwind.config.js`. v4 does not.** The theme is declared in CSS with `@theme`.

```css
@import "tailwindcss";

@theme inline {
  --color-copper: var(--copper);
  --text-h1: 1.9531rem;
  --radius-trace: 4px;
}
```

Tailwind reads **namespaces** from the variable prefix and generates utilities:

| Namespace          | Generates                                      |
| ------------------ | ---------------------------------------------- |
| `--color-copper`   | `text-copper`, `bg-copper`, `border-copper`, … |
| `--text-h1`        | `text-h1`                                      |
| `--radius-trace`   | `rounded-trace`                                |
| `--font-mono`      | `font-mono`                                    |
| `--spacing-gutter` | `pl-gutter`, `mt-gutter`, …                    |
| `--container-wide` | `max-w-wide`                                   |

#### `@theme` vs `@theme inline` — the important distinction

This trips people up and is a good thing to be able to explain.

With plain `@theme`, Tailwind resolves the value at build time and emits the _literal
value_ into the utility class. With `@theme inline`, it emits the `var()` reference itself.

```css
/* @theme        -> .text-copper { color: #f0803c }   (frozen at build) */
/* @theme inline -> .text-copper { color: var(--copper) }  (live) */
```

**This project requires `inline`.** The whole theme system works by redefining `--copper`
under `[data-theme="light"]`. If Tailwind froze the dark value into the class, switching
themes would change nothing. One keyword is the difference between a working theme switch
and a broken one.

#### Clearing defaults as governance

```css
--color-*: initial;
--radius-*: initial;
--shadow-*: initial;
--text-*: initial;
```

This **deletes** Tailwind's default palette, radius scale, shadow scale and type scale
before defining replacements. The consequence is that `bg-indigo-500`, `rounded-2xl` and
`shadow-lg` **do not compile**.

That is the point. `DESIGN_BRIEF.md` lists "rounded-2xl + shadow-lg on everything" as an
AI-generated tell. Writing that down in a document relies on discipline; deleting the
tokens turns it into a build error. This is the single most interesting thing in the
stylesheet and a genuinely good interview anecdote: _"I encoded the design constraints into
the type system of the CSS so they couldn't be violated by accident."_

A caveat worth knowing: clearing `--color-*` also removes `transparent` and `current`, so
they are re-added explicitly.

#### Cascade layers, and why the theme icon swap works

Tailwind v4 wraps its output in `@layer theme, base, components, utilities`. CSS cascade
layers have a rule that surprises people:

> **Unlayered styles beat layered styles**, regardless of specificity.

So this, written outside any layer in `globals.css`:

```css
:root[data-theme="dark"] [data-theme-icon="light"] {
  display: none;
}
```

wins over any Tailwind utility class, even though a utility might look more specific. This
is why the theme toggle can render both a sun and a moon and let CSS pick, without needing
`!important`.

---

### 2.3 The theme system, and the flash-of-wrong-theme problem

This is the highest-value section in the file. It is a classic interview question and most
implementations get it wrong.

#### The problem

The server renders HTML. The server **cannot know** the visitor's OS colour preference or
what they chose last visit — that information lives in the browser, in
`prefers-color-scheme` and `localStorage`. Neither is sent with the request.

So if you resolve the theme in React (`useEffect`, a context provider, a `useState`), the
sequence is:

1. Server sends HTML with _some_ default theme — say dark.
2. Browser paints it. **The user sees dark.**
3. JavaScript downloads, React hydrates, `useEffect` runs, reads `localStorage`, finds
   "light".
4. The page repaints light.

Between steps 2 and 4 the user sees a flash of the wrong theme. On a slow connection that
is several hundred milliseconds of white strobe at night. `DESIGN_BRIEF.md` §1c lists it as
a tell.

#### The solution: a blocking inline script

`src/components/theme/theme-script.tsx` injects this into `<head>`:

```js
(function () {
  try {
    var r = document.documentElement,
      s = localStorage.getItem("theme");
    r.dataset.theme =
      s === "light" || s === "dark"
        ? s
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
```

Why each piece matters:

- **It is inline, not `src=`.** An external script is a network round trip; the browser
  would paint before it arrives. Inline code is in the HTML already.
- **It is in `<head>`, before `<body>`.** A classic `<script>` without `async` or `defer`
  is _parser-blocking_: the browser stops building the DOM and executes it immediately.
  Because it runs before `<body>` exists, it runs before anything has been painted.
- **It sets an attribute on `<html>`**, which already exists at that moment. It cannot
  touch `<body>` — that has not been parsed yet.
- **It is wrapped in `try/catch`.** `localStorage` _throws_ in some privacy modes rather
  than returning null. An uncaught throw here would break the whole page before it renders.
- **Resolution order is: stored choice → OS preference → dark.** An explicit choice must
  outrank the OS setting, or the toggle appears broken after a refresh.

Verification: the test asserts `data-theme === "light"` **at `DOMContentLoaded`**, which is
before any paint. That is the actual proof there is no flash — not a screenshot.

#### `suppressHydrationWarning`

React compares server HTML against what it would render on the client. The server emitted
`<html>` with no `data-theme`; the script added one before React booted. React sees the
mismatch and warns. `suppressHydrationWarning` on `<html>` tells React this one element is
expected to differ. It suppresses the warning for that element only — it is not a blanket
mute, and it does not fix real mismatches elsewhere.

#### Why the toggle holds no state

The naive toggle stores the theme in `useState` to decide whether to show a sun or a moon.
That reintroduces the same class of bug: on the server there is no theme, so which icon do
you render? Whatever you pick may be wrong, and you get a hydration mismatch or a flicker.

This implementation has **no state at all**. It renders both icons:

```tsx
<Moon data-theme-icon="dark" />
<Sun data-theme-icon="light" />
```

and CSS hides one based on `html[data-theme]`, which the blocking script already set. The
correct icon is in the very first paint, there is nothing to hydrate, and nothing can
mismatch. The click handler mutates the DOM attribute and writes `localStorage` directly.

**The general lesson**, which is worth stating in an interview: _if state already lives in
the DOM and CSS can read it, duplicating it into React state creates a synchronisation
problem you did not need to have._

#### Smooth transition without a flash on load

Requirements that pull against each other: switching themes should animate, but the initial
load must not.

If you put `transition: background-color 280ms` on elements permanently, the initial paint
can animate from the browser default, which is the flash you were avoiding.

The fix is to make transitions exist only _during_ a deliberate switch:

```css
:root[data-theme-transition] * {
  transition: background-color 280ms …;
}
```

The toggle adds `data-theme-transition`, flips the theme, and removes the attribute 320ms
later. On first load the attribute is absent, so no transition can fire. It is also skipped
entirely when `prefers-reduced-motion: reduce` is set.

The `*` selector is normally a performance smell, but here it is scoped to a 320ms window
rather than being always-on, so there is no steady-state cost.

#### `color-scheme`

```css
:root[data-theme="dark"] {
  color-scheme: dark;
}
```

This is not decoration. It tells the browser to render **native UI** — scrollbars, form
controls, the `<input>` caret — in dark styling. Without it you get a dark page with a
bright white scrollbar.

---

### 2.4 Colour and contrast, with the actual maths

#### WCAG contrast ratio

Contrast is computed from **relative luminance**, not from the hex values directly.

Step 1 — normalise each channel to 0–1 and undo sRGB gamma encoding:

```
c = channel / 255
linear = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ^ 2.4
```

Step 2 — weight the channels by human perceptual sensitivity:

```
L = 0.2126*R + 0.7152*G + 0.0722*B
```

Green dominates because the eye is most sensitive to it. This is why a saturated green and
a saturated blue at the same "brightness" have wildly different contrast.

Step 3 — the ratio, lighter over darker:

```
(L_lighter + 0.05) / (L_darker + 0.05)
```

The `0.05` models ambient screen glare and is what bounds the scale at 21:1 (pure black on
pure white).

#### Thresholds

| Requirement                                  | Ratio     |
| -------------------------------------------- | --------- |
| Body text, AA                                | **4.5:1** |
| Large text (≥18.66px bold or ≥24px), AA      | 3:1       |
| UI component boundaries and focus indicators | 3:1       |
| Body text, AAA                               | 7:1       |

#### Why a light theme cannot be an inverted dark theme

This is the concrete example to remember. The dark theme's copper accent is `#F0803C`.

- On the dark background `#0B0E11`: **7.24:1** — comfortably AA.
- On the light background `#F6F4F1`: **2.43:1** — fails badly. Not even close.

The reason is that `#F0803C` is a _light_ colour. It has high luminance. Against a dark
background that is a large gap; against a light background there is almost no gap left.

So the accent is a **token pair**: `#F0803C` in dark, `#9A4512` in light (5.91:1). Same
hue family, different lightness and chroma. Every token in the palette works this way.

Every value in `globals.css` was computed with the formula above before being written down,
and two of the first-pass values failed and were changed. The measured ratios are in
comments next to each token, which is also why the colour specimen on the scaffold page
shows them — they are machine facts, so they are set in monospace.

---

### 2.5 SVG techniques

#### `viewBox` and coordinate space

```tsx
<svg viewBox="0 0 820 420" className="w-full" />
```

`viewBox` defines an internal coordinate system. Everything inside is drawn in those units
regardless of how large the SVG is on screen. CSS `width: 100%` then scales the whole thing
proportionally. This is why the graph is defined once in pixel-ish units and works at any
width.

The trace bus does the opposite: it sets `width` and `height` to the same numbers as the
`viewBox` so it renders at natural size and is never scaled. Scaled strokes and text look
wrong at small sizes; a navigation element should not be rubbery.

#### `pathLength` — normalising dash maths

```tsx
<path d={complexPath} pathLength={100} strokeDasharray="7 999" />
```

`pathLength` tells the renderer to _pretend_ the path is that long. All dash arithmetic
then happens in those units. Setting it to `100` means dash values become **percentages**.

This is what lets one CSS keyframe drive the packet animation on every path in the app,
regardless of each path's real geometry:

```css
@keyframes packet-travel {
  from {
    stroke-dashoffset: 100;
  }
  to {
    stroke-dashoffset: 0;
  }
}
```

Without `pathLength`, each path would need its length measured with `getTotalLength()` at
runtime and a per-element custom property. That is a layout read per element, and it is
avoidable.

#### The dash trick, used two different ways

`stroke-dasharray` takes `[dash, gap]`. Animating `stroke-dashoffset` slides the pattern
along the path. Two effects fall out of the same mechanism:

- **Draw-on:** `dasharray: 100 100`, offset animating `100 → 0`. One long dash slides in
  and the line appears to be drawn. This is the graph's edge entrance.
- **Travelling packet:** `dasharray: 7 999`, offset animating `100 → 0`. A short dash
  separated by a huge gap slides along, so you see a single moving blip. This is the packet.

Same property, different ratio.

#### Why coordinates are precomputed

`src/data/graph.ts` holds hand-authored `x`/`y` values. There is no force-directed layout.

A force simulation runs a physics loop every frame until it settles, which means:
CPU burn on load, a different layout on each visit (they are seeded randomly), and nodes
that drift while you are trying to click one.

A committed layout renders **byte-identical every time**. `DESIGN_BRIEF.md` §2.2 frames the
reason well: a diagram that is the same every time reads as a schematic; one that reshuffles
reads as a screensaver. The cost is that you place the nodes yourself. For nine nodes that
is a few minutes, and the result is better.

---

### 2.6 React patterns used here

#### Context, and not re-rendering the world

```tsx
const value = useMemo(
  () => ({ activeId, cursorId, setCursorId }),
  [activeId, cursorId],
);
```

Every consumer of a context re-renders when the **context value identity** changes. Without
`useMemo`, a fresh object literal is created on every provider render, so every consumer
re-renders every time — even if `activeId` and `cursorId` are unchanged. `useMemo` keeps
the same object until a dependency actually changes.

`setCursorId` is stable because `useState` setters never change identity, so it does not
need to be in the dependency array (it is included harmlessly).

#### `IntersectionObserver` instead of a scroll handler

The naive way to track which section is on screen is a `scroll` listener that reads
`getBoundingClientRect()` for each section. That is bad for two compounding reasons:

1. **Scroll events fire at up to display refresh rate** — 60–120 times a second.
2. **`getBoundingClientRect()` forces synchronous layout.** Reading a geometric property
   after any DOM write makes the browser recompute layout immediately ("layout thrashing").
   Doing it inside a scroll handler is the classic jank recipe.

`IntersectionObserver` inverts this. The browser tracks intersections internally, off the
main thread where it can, and calls you back **only when a threshold is crossed**:

```tsx
new IntersectionObserver(callback, {
  rootMargin: "-20% 0px -35% 0px",
  threshold: [0, 0.2, 0.5, 0.8, 1],
});
```

- `rootMargin` shrinks the viewport rectangle used for the test. The negative values here
  create a band in the upper-middle of the screen, so "active" means "in the reading zone",
  not "touching the bottom edge."
- `threshold` lists the visibility ratios that trigger a callback.

Measured result: **zero long tasks during a full-page scroll at 4× CPU throttling**, median
frame time 17ms (≈59fps).

#### `useRef` for values that should not trigger renders

```tsx
const ratios = useRef(new Map<string, number>());
```

The observer callback records each section's visibility ratio, then picks the highest. Those
intermediate ratios are bookkeeping — rendering on every one would defeat the point. A ref
is mutable storage that persists across renders and **does not** trigger one. State is for
"the UI must change"; a ref is for "I need to remember this."

#### Effect cleanup

```tsx
useEffect(() => {
  document.addEventListener("keydown", onKeyDown);
  const previous = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    document.removeEventListener("keydown", onKeyDown);
    document.body.style.overflow = previous;
  };
}, [open, close]);
```

Two details worth pointing at:

- Every subscription is removed in the cleanup. Without it, opening and closing the sheet
  repeatedly stacks duplicate listeners — a leak.
- The scroll lock **restores the previous value** rather than setting `""`. Assuming the
  prior state was empty is how you silently clobber something another component set. Save
  and restore is the habit.

---

### 2.7 Accessibility

#### The trace bus problem, and the reasoning

The trace bus is hover-driven and visual. A keyboard or screen-reader user gets nothing
from it. There were two options:

1. Make it fully accessible — real focusable links, ARIA labels.
2. Mark it decorative and guarantee an equivalent elsewhere.

Option 1 sounds more virtuous but is worse in practice: you end up with **two identical
navigations** and double the tab stops, and a screen reader announces every section twice.

So the bus is `aria-hidden="true"` with `tabIndex={-1}` on its anchors — invisible to
assistive tech, not in the tab order, still clickable with a mouse — and the header
`<nav aria-label="Sections">` carries the real semantics.

**This is only legitimate because the equivalent nav is always present**, at every
breakpoint. Marking something `aria-hidden` when it is the only way to do the thing is an
accessibility failure; doing it when a better path exists is correct.

The test asserts this: the first eight tab stops are skip-link → site name → four section
links → theme toggle → graph legend. No duplicates from the bus.

#### `aria-hidden` and `tabIndex={-1}` are both required

`aria-hidden="true"` removes an element from the accessibility tree but **does not** remove
it from the tab order. A focusable element inside an `aria-hidden` subtree is the worst of
both worlds: a keyboard user can focus it and the screen reader announces nothing. You need
both attributes.

#### The skip link

```tsx
<a href="#main" className="sr-only focus:not-sr-only focus:absolute …">
  Skip to content
</a>
```

Visually hidden until focused, then visible. A keyboard user landing on the page can jump
past the navigation instead of tabbing through every link on every page load. `sr-only`
hides visually while keeping it in the accessibility tree and tab order — which is
different from `display: none`, which removes it from both.

#### Dialog semantics for the mobile sheet

A sheet that is just a styled `div` is inaccessible. This one implements the full contract:

| Requirement                | Implementation                                      |
| -------------------------- | --------------------------------------------------- |
| Announced as a dialog      | `role="dialog"`                                     |
| Content behind is inert    | `aria-modal="true"`                                 |
| Has an accessible name     | `aria-labelledby` → the "Sections" heading          |
| Trigger state is exposed   | `aria-expanded` on the button                       |
| Escape closes it           | `keydown` listener                                  |
| Focus moves in             | `requestAnimationFrame` then focus first link       |
| Focus cannot escape        | Tab/Shift-Tab wrap at the boundaries                |
| Focus returns on close     | `triggerRef.current?.focus()`                       |
| Background does not scroll | `body.style.overflow = "hidden"`, restored on close |

The `requestAnimationFrame` before focusing matters: the panel is animating in, and
focusing an element that is not yet laid out can fail or cause a scroll jump.

#### `:focus-visible` vs `:focus`

```css
:focus-visible {
  outline: 2px solid var(--copper);
  outline-offset: 2px;
}
:focus:not(:focus-visible) {
  outline: none;
}
```

`:focus` matches on mouse clicks too, which is why people used to write `outline: none` and
break keyboard navigation for everyone. `:focus-visible` matches only when the browser
judges a focus ring is warranted — keyboard navigation, yes; a mouse click on a button, no.
You get a clean visual for mouse users and a real ring for keyboard users.

The copper ring measures 7.24:1 in dark and 5.91:1 in light, so it clears the 3:1 required
for a focus indicator with a lot of room.

#### `prefers-reduced-motion`

This is a real OS accessibility setting — people with vestibular disorders can be made
physically unwell by motion. Respecting it is not optional polish.

The rule applied here: **information must never be carried by motion alone.** Under reduced
motion the packet animation is skipped entirely, but the hover state is still shown by the
copper colour change, so nothing is lost. The trace bus fill snaps to position instead of
sweeping. Graph edges render fully drawn rather than animating in.

Note the CSS is written as `@media (prefers-reduced-motion: no-preference) { … }` — motion
is **opt-in**, guarded by the query, rather than added by default and then removed. If the
query fails to match for any reason, the safe outcome is what happens.

#### Responsive accessibility: swapping `sr-only` at a breakpoint

```tsx
<span className="block text-silk-faint md:sr-only">
  {`connects to ${neighbours.join(", ")}`}
</span>
```

Below `md` the graph SVG is hidden, so that text is the only way to learn the relationships
and it is **visible**. Above `md` the diagram conveys it visually, so the same text becomes
screen-reader-only to avoid redundancy. One element, right behaviour at both sizes.

---

### 2.8 Performance: how it was actually measured

Not guessed at. Chrome DevTools Protocol via Playwright:

```js
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
```

4× slowdown approximates a mid-range laptop under load.

#### The metrics and what they mean

| Metric        | What it is                                       | Measured        |
| ------------- | ------------------------------------------------ | --------------- |
| **FCP**       | First Contentful Paint — first pixel of content  | ~1.6–1.9s @4×   |
| **LCP**       | Largest Contentful Paint — main content visible  | ~1.8–2.7s @4×   |
| **CLS**       | Cumulative Layout Shift — how much content jumps | **0.0000**      |
| **Long Task** | Any main-thread task > 50ms; blocks input        | 0 during scroll |
| Frame time    | Time between rendered frames; 16.7ms = 60fps     | median **17ms** |

CLS is exactly zero because of `next/font` metric overrides and because no images load
above the fold.

A **long task** is the key concept. The main thread is single-threaded: while it runs a
task it cannot respond to a click or paint a frame. Anything over 50ms is perceptible as
unresponsiveness. Zero long tasks during a full scroll is the number that proves the trace
bus and graph are cheap.

#### The methodology lesson

Halfway through profiling, results came back suspiciously good — JS dropped from 184 KB to
55 KB and long tasks from 15 to 1. Checking the raw network responses showed **every
JavaScript chunk returning HTTP 500.** The page was serving no JavaScript at all. Of course
it was fast.

The cause was rebuilding `.next` while a production server was running, so the server held
stale chunk references.

The habit this teaches, and a genuinely good thing to say in an interview: **validate that
your measurement environment is sound before trusting any number, especially a number you
were hoping for.** A result that confirms what you wanted deserves _more_ scrutiny than one
that does not.

---

### 2.9 Tooling notes

**ESLint flat config** (`eslint.config.mjs`) is the modern format — an exported array of
config objects instead of `.eslintrc` with `extends`. Order matters:

```js
defineConfig([...nextVitals, ...nextTs, prettier, globalIgnores([...])]);
```

`eslint-config-prettier` goes **last** because its only job is to switch off stylistic
rules that would fight Prettier. Placed earlier, later configs would switch them back on.

**`prettier-plugin-tailwindcss`** sorts utility classes into Tailwind's canonical order
automatically, so class order never becomes a code-review topic. Under v4 it needs
`tailwindStylesheet` pointing at `globals.css`, since that file is now the config.

---

## Part 3 — Decision log

Things that were decided, and things that were tried and thrown away. The rejected ones are
often the better interview material.

### Rejected: `LazyMotion` to shrink the bundle

**Hypothesis:** Motion's full feature bundle is large and is not needed during hydration.
Using `LazyMotion` with the lightweight `m` components and an async `domAnimation` import
should code-split it out of the main chunk.

**Result:** JS went **up**, 184 KB → 218 KB.

**Why:** importing `domAnimation` from the same `"motion/react"` entry point that the
components come from defeats tree-shaking — the bundler pulls the whole package into the
main chunk _anyway_, and then the dynamic import adds a second 30 KB copy.

**Outcome:** reverted. The lesson is that bundle "optimisations" have to be measured; this
one was plausible, widely recommended, and wrong here.

### Rejected: making the trace bus a second accessible nav

Would have produced duplicate tab stops and double screen-reader announcements. Marked
decorative instead, with a guaranteed equivalent. See 2.7.

### Changed: trace bus moved from `lg` to `xl`

At 1024px the bus's hover labels overlapped the content. It needs the 240px gutter, so it
now appears at `xl` (1280px) and above. Found by looking at a screenshot, not by reasoning
about it.

### Changed: graph is _replaced_ on mobile, not scaled

An 820-unit diagram squeezed into 375px is illegible, and an illegible diagram is
decoration — precisely what the brief forbids. Below `md` the SVG is hidden and the node
list becomes the primary representation, with connections spelled out in visible text.

### Changed: brand icons inlined

`lucide-react` v1 **removed brand icons**; `Github` and `Linkedin` no longer exist, and
Heroicons never had them. LinkedIn has also been pulled from `simple-icons` over trademark.
The official marks are inlined in `src/components/icons/brand.tsx`, all on a 16px grid and
solid, so they read as one set. Stroked lucide icons are still used for UI affordances
(menu, close, theme) — brand marks and controls are different categories and are drawn
differently on purpose.

### Decided: footer links render inert rather than dead

No URLs exist yet, so they render as dashed non-links removed from the tab order rather
than `href="#"`. A control that promises something it cannot do is the same failure as a
résumé button that 404s.

### Decided: TypeScript 5.9.3, not 7.x

`DESIGN_BRIEF.md` cites TypeScript 7 as latest. `create-next-app` pins `^5`, and that is
the combination Next 16 is tested against. Chasing a version number is not worth an
unsupported toolchain. Worth flagging as a deliberate deviation rather than an oversight.

### Decided: the home page is a design-system specimen

There is no content yet, and the brief forbids shipping placeholder content. Rather than an
empty shell, `page.tsx` renders the tokens, type scale and graph — and everything on it is
**true**: real measured contrast ratios, the real type scale, this repository's real module
graph. No lorem ipsum, no invented project names. It gets deleted at the content stage.

---

## Part 4 — Questions you could be asked

**"How do you prevent a flash of the wrong theme?"**
A parser-blocking inline script in `<head>` that reads `localStorage`, falls back to
`prefers-color-scheme`, and writes a `data-theme` attribute onto `<html>` before the body
is parsed. It has to be inline (no network round trip) and wrapped in `try/catch`
(`localStorage` throws in some privacy modes). The React tree never resolves the theme,
so there is nothing to hydrate. See 2.3.

**"What is a hydration mismatch and how did you avoid one here?"**
React compares the server HTML to what it would render on the client and warns if they
differ. The theme script deliberately mutates `<html>` before React boots, so
`suppressHydrationWarning` is set on that one element. The toggle avoids the issue entirely
by holding no state — it renders both icons and lets CSS pick from the DOM attribute.

**"Why `IntersectionObserver` rather than a scroll listener?"**
Scroll events fire at refresh rate and `getBoundingClientRect()` forces synchronous layout,
so the combination is the classic jank pattern. `IntersectionObserver` is callback-on-threshold,
handled by the browser. Measured zero long tasks during a full-page scroll at 4× throttling.

**"Why can't a light theme just invert the dark one?"**
Because contrast is a function of luminance, not hue. The dark accent `#F0803C` is 7.24:1
on the dark background and 2.43:1 on the light one. Each theme needs its own accent at its
own lightness.

**"What is `@theme inline` and why does it matter?"**
`@theme` freezes the resolved value into the generated utility at build time; `@theme
inline` emits the `var()` reference. Runtime theme switching requires `inline`, otherwise
the class holds the dark hex forever and toggling does nothing.

**"How do you make a decorative interactive element accessible?"**
Either make it fully accessible, or mark it `aria-hidden` plus `tabIndex={-1}` and guarantee
an equivalent path. Both attributes are needed — `aria-hidden` alone leaves it focusable but
unannounced. The second option is right when full exposure would create duplicate navigation.

**"How did you verify any of this?"**
A 22-assertion Playwright suite: theme resolution at `DOMContentLoaded`, `localStorage`
persistence across reload, no horizontal overflow at 375px and 320px, dialog semantics and
focus return, computed `animationName` under reduced motion, tab order, and the computed
outline width on the focused element. Plus CPU-throttled profiling through the DevTools
Protocol. Assertions on computed style, not screenshots.

**"Tell me about something you got wrong."**
The `LazyMotion` bundle optimisation — plausible, commonly recommended, and it made the
bundle 34 KB _larger_. And a profiling run that looked like a huge win turned out to be a
server returning 500 for every JS chunk. Both taught the same thing: measure, and be most
suspicious of results you were hoping for.

---

## Part 2b — Concepts added at the content stage

### 2.10 Deriving data instead of maintaining it twice

The project graph needs to know which projects share a technology. The tempting shape is
two lists: the stack tags you display, and a hand-written list of edges. That is two sources
of truth, and the second one silently rots the first time a stack changes.

`src/data/graph.ts` instead **derives** the edges from the real stack arrays, once, at
module scope:

```ts
const normalise = (tag: string) =>
  tag
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, "")
    .trim();
```

Normalisation matters: `"Python (visualizer)"` and `"Python"` are the same technology for
the purpose of drawing an edge, so the parenthetical is stripped. A tag used by only one
project cannot produce an edge, so those same counts also decide which tags are worth
offering as a filter — one computation answers two questions.

Two properties worth being able to articulate:

- **Deterministic.** Same input, same output, every render, every visit. That is what lets
  the diagram be a schematic rather than a screensaver, and it is the same reason the
  coordinates are committed rather than simulated.
- **Module scope, not render scope.** It runs once when the module is first imported, not
  on every render. No `useMemo` needed, because it never depends on props or state.

A consequence the graph surfaces honestly: **WireFish shares no stack with anything else**
(C, raw sockets, POSIX). It renders as an unconnected node. That is a true statement about
the work, so it stays — and the list version spells it out as "shares no stack with the
others" rather than the meaningless "connects to nothing."

### 2.11 Server Components, in practice

The content stage is where the RSC split earns its keep. Of the seven sections on the page,
**every one is a Server Component.** The only client JavaScript is:

- `project-graph.tsx` — needs hover state,
- `reveal.tsx` — needs an IntersectionObserver,
- the header, mobile sheet, theme toggle and trace bus from the previous stage.

Everything else — six project entries, all their prose, the skills tags, the education
block, the certifications table, the footer — is HTML rendered on the server with **zero**
hydration cost.

The mechanism that makes this possible is the **children-as-slot** pattern:

```tsx
// about.tsx is a Server Component
<Fade className="max-w-prose space-y-4 text-silk-dim">
  {ABOUT.map((para) => (
    <p key={para}>{para}</p>
  ))}
</Fade>
```

`Fade` is a client component, but the `<p>` elements are **not**. They are rendered on the
server and passed into `Fade` as an already-rendered slot. A client component's `children`
do not become client code. Understanding that is the difference between a page with three
interactive islands and a page where `"use client"` at the top of a layout drags the entire
tree into the bundle.

### 2.12 Scrollspy: why `intersectionRatio` is the wrong metric

The first implementation picked the current section by largest `intersectionRatio`. With
four short specimen sections that worked. With real content it broke immediately, and the
reason generalises.

`intersectionRatio` is **the visible fraction of the element's own height**. The Projects
section is about 7,000px tall. Even when it completely fills a 900px viewport, its ratio is
roughly `900 / 7000 ≈ 0.13`. A 500px Skills section half-visible above it scores `0.5` and
wins. The nav highlighted "Skills" while the reader was plainly deep inside Projects.

The fix is a **reading line** — a horizontal line ~30% down the viewport. The current
section is the last one whose top edge has crossed it:

```ts
const line = window.innerHeight * 0.3;
let best: string | null = null;
for (const s of SECTIONS) {
  const el = document.getElementById(s.id);
  if (el && el.getBoundingClientRect().top <= line) best = s.id;
}
```

Size-independent, and it yields `null` while the hero is on screen, which is correct — no
section is current yet.

This still runs inside an `IntersectionObserver` callback rather than a scroll listener.
The observer fires only when a section edge crosses the viewport — a handful of times per
page — and reading six rects at that moment costs nothing. The rule to remember: _an
IntersectionObserver is a cheap way to know **when** to measure; it is not always the right
thing to measure._

#### The last-section problem

One more edge case. Once the page has scrolled as far as it can, the final section sits
below the reading line and can never become current, so clicking "Contact" left Contact
unhighlighted. The fix is a 1px sentinel `<div>` at the very end of the document, watched by
a second observer: if the sentinel is on screen, the reader is at the bottom, so the last
section is the current one. Still no scroll listener.

### 2.13 An animation that hides content is worse than no animation

The brief specified a clip-path mask-wipe on section headings. Implemented with Motion:

```tsx
initial={{ clipPath: "inset(0 100% 0 0)" }}
whileInView={{ clipPath: "inset(0 0% 0 0)" }}
```

**Every section heading on the site was invisible.** Motion did not animate `clipPath` — it
left the server-rendered inline style in place, permanently clipped to zero width.

How it was diagnosed, which is the useful part:

1. Not by looking at a screenshot and guessing, but by reading the computed style of the
   wrapper and comparing it against a `Fade` element in the same section.
2. `Fade` showed `style="opacity: 1;"` — with a space after the colon, meaning **JavaScript
   wrote it**. The wipe showed `style="clip-path:inset(...)"` with no space: the exact
   string React had server-rendered, never touched.
3. That single difference proved `whileInView` was firing correctly and the fault was
   specifically in animating `clipPath`.

The first attempt at a fix was to make the units consistent (`0%` rather than a bare `0`,
since mixing unitless and percentage values defeats interpolation). It did not help.

The real lesson is not about Motion. It is about **failure modes**. An opacity animation
that fails leaves content invisible; so does a clip-path. Anything whose `initial` state
hides content is a load-bearing animation, and if it does not run, the content is gone —
with the server-rendered HTML actively working against you, because the hiding style ships
in the markup.

So headings are now **never hidden**. They render as ordinary server HTML, and the motion
moved to a 1px copper rule beneath them that scales from `scaleX: 0` to `1`:

- A transform, which Motion animates reliably and the compositor handles without repainting.
- The same left-to-right gesture along the trace direction that the brief asked for.
- If it never runs, the worst case is a missing hairline. Nobody loses a word of content.

#### A second, subtler bug in the same component

The rule initially used `viewport={{ amount: 0.5 }}` — fire when 50% visible. On a **1px-tall**
element, a fractional intersection threshold rounds against the element's own height and the
callback intermittently never fires. Some rules animated, some stayed at `scaleX: 0`,
apparently at random. `amount: "some"` (threshold 0) fixed it. Fractional thresholds need an
element tall enough for the fraction to mean something.

### 2.14 Testing content, not just layout

The stage-2 suite checked structure. The content stage added assertions about **truthfulness**,
which is unusual and worth mentioning in an interview:

```js
const banned = [
  "passionate",
  "seamless",
  "cutting-edge",
  "revolutioniz",
  "leverage",
  "lorem ipsum",
  "coming soon",
  "dive into",
];
check(
  "no buzzwords or placeholder copy",
  banned.filter((w) => body.includes(w)).length === 0,
);
```

Plus: no `href="#"` or empty links anywhere; every external link carries
`target="_blank"` and `rel="noopener"`; every `<img>` has non-empty alt text; the TradeWatch
entry visibly shows its in-progress status; and no claim of fraud or manipulation detection
appears outside the sentence that explicitly disclaims it.

These encode editorial rules as tests. The design brief's anti-pattern list stops being a
document somebody has to remember and becomes something CI can fail on.

#### Harness bugs look exactly like product bugs

Two "failures" in this stage were the test's fault, and both were only distinguishable by
checking:

- `aria-current` reported the wrong section — because the page sets
  `scroll-behavior: smooth`, so a 9,000px anchor jump was still in flight when the assertion
  ran. Fixed by injecting `scroll-behavior: auto` **for measurement only**.
- Project screenshots looked blank in a full-page capture — because `next/image` lazy-loads
  and a full-page screenshot does not trigger the intersection observers. Confirmed by
  reading `naturalWidth` off each `<img>`: all three were loaded and 640px wide.

Neither was a real defect. The habit worth keeping: when a test fails, establish whether the
product or the measurement is wrong **before** changing either.

### 2.15 Responsive images: `sizes`, and why upscaling is the thing to avoid

`next/image` generates several widths of every image and lets the browser pick. The
`sizes` attribute is how you tell it **how wide the image will actually be displayed**,
because the browser has to choose a file before it has done layout.

```tsx
sizes={`(min-width: 1024px) ${Math.min(832, image.width)}px, 100vw`}
```

Two rules are encoded there:

1. **Never display an image wider than its source.** The figure column is 832px, but the
   WireFish and robot photos are only 800px wide. Stretching an 800px screenshot to 832px
   makes the UI inside it soft — and a blurry screenshot of real software undercuts the
   exact thing it is there to prove. The cap is enforced in CSS too:
   `style={{ maxWidth: "min(var(--container-figure), 1908px)" }}`.
2. **Do not ask for a candidate you cannot use.** A blanket `sizes="832px"` makes the
   browser fetch the 832-wide variant of an image that will never render above 800 —
   wasted bytes for no visible gain.

Verified rather than assumed, and specifically **on a production build**: `next/image`
behaves differently in dev, and the dev numbers were misleading. Measured by reading
`naturalWidth` against `getBoundingClientRect().width` for every image on the page. The
map screenshot lands at 832 × 355 displayed from an 832 × 355 file — exactly 1:1.

#### The documented-exception pattern

The design brief allows only two container widths, `prose` and `wide`, and says anything
else must be "a deliberate exception that gets a comment saying why." A 1908px-wide map
screenshot at the 68ch prose measure is illegible, so a third token was added —
`--container-figure: 52rem` — with the reason written into the stylesheet next to it.

This is the difference between a system and a set of rules nobody follows. Constraints
that cannot bend get ignored; constraints with a documented escape hatch survive, because
the escape hatch leaves a record of what was traded and why.

---

## Part 5 — Session log

### 2026-09-22 — Stage 1: research and design brief

**Asked for:** research into what makes a site look AI-generated versus senior and
intentional; then a design brief, no code.

**Done:**

- Researched AI-generated design tells and developer-portfolio critique; reviewed
  `rauno.me` and `brittanychiang.com` as reference points.
- Wrote `DESIGN_BRIEF.md`: the user's 13 anti-patterns as a floor, plus ~35 more from
  research (the AI-default font set is wider than Inter; coloured top/left card borders;
  eyebrow labels; animations replaying on scroll re-entry; theme toggles that flash).
- Proposed the visual direction: PCB trace bus as scroll indicator, project graph with
  committed coordinates, packet motion on hover only, monospace reserved for machine facts.
- Derived the palette from circuit-board materials rather than taste, and computed every
  contrast ratio. Two first-pass values failed AA and were corrected before being written
  down.
- Verified stack versions rather than assuming: Next 16.3.5 (not 14), Tailwind 4.3.3
  (CSS-first, no config file), Framer Motion now published as `motion`.
- Recommended `mailto:` + copy-to-clipboard over a contact form, on the grounds that a form
  is five things that can silently break.

**Concepts introduced:** WCAG contrast maths (2.4), the anti-pattern taxonomy.

### 2026-09-22 — Stage 2: scaffold and foundational layer

**Asked for:** the shell only — design system, theme system, signature background, nav,
footer. No content sections.

**Done:**

- Scaffolded Next 16 + TS + Tailwind 4 + `motion` + ESLint/Prettier. (`create-next-app`
  rejected the directory name `Portfolio` because npm forbids capitals in package names, so
  it was scaffolded elsewhere and moved in.)
- Implemented the full token layer in `globals.css`, both themes, and **cleared Tailwind's
  default namespaces** so `rounded-2xl`, `shadow-lg` and `bg-indigo-500` do not compile.
- Built the theme system: blocking script, stateless toggle, transition-only-on-switch.
- Built the trace bus, the project graph, the header, the mobile sheet dialog and the footer.
- Wired the header nav and trace bus to shared context so they behave as one instrument.
- Wrote a 22-assertion Playwright suite; all pass. Profiled under 4× CPU throttling.
- Found and fixed four real defects **by looking at screenshots**: trace-bus labels
  colliding with content, a clipped graph node label, header/content misalignment, and the
  graph shrinking on mobile instead of being replaced.
- Replaced the Next.js logo favicon (its own tell) with a trace-mark `icon.svg`; removed
  unused template SVGs from `public/`.
- Tried and reverted `LazyMotion` (see Part 3).

**Concepts introduced:** Server vs Client Components (2.1), Tailwind v4 CSS-first and
cascade layers (2.2), FOUC and hydration (2.3), SVG `pathLength` and dash animation (2.5),
context memoisation and `IntersectionObserver` (2.6), the full accessibility set (2.7),
CPU-throttled profiling (2.8).

**Status:** shell complete and verified. Blocked on content — real name, two or three
projects with problem/constraint/trade-off, the three contact URLs, and whether there is an
experience section.

### 2026-09-22 — Stage 3: real content

**Asked for:** build the real content sections from supplied material. Invent nothing,
embellish nothing, no buzzwords.

**Done:**

- Added `src/data/projects.ts` and `src/data/profile.ts` as the content layer, so copy lives
  in typed data rather than scattered through JSX.
- Built seven sections — hero, about + education, skills, six projects, experience,
  involvement, contact — all as Server Components.
- The project graph became real: nodes are the six projects, and edges are **derived** from
  the actual stack lists rather than hand-maintained (2.10).
- Each project leads with problem / constraint / trade-off, with the implementation bullets
  behind a native `<details>` so six projects stay scannable without hiding anything.
- Verified every external link before building: five resolve, TradeWatch 404s (private, as
  stated, so it renders labelled "GitHub (private)"), LinkedIn returns 999 which is its bot
  block rather than a dead link.
- Built one abstract visual — the TradeWatch ingestion pipeline — from the project's own
  architecture, in the existing trace language. Declined to invent a "live sparkline",
  because fake market data is fake data.
- Replaced the design-system specimen page; all scaffold copy is gone.
- Expanded the test suite to 26 assertions including buzzword and placeholder checks (2.14).

**Bugs found and fixed, all by measuring rather than assuming:**

1. Every section heading was invisible — Motion silently refuses to animate `clipPath` (2.13).
2. Heading rules fired intermittently — fractional viewport threshold on a 1px element (2.13).
3. The nav highlighted the wrong section — `intersectionRatio` is meaningless for a
   7,000px-tall section (2.12).
4. The last section could never become current — fixed with an end-of-document sentinel (2.12).
5. `max-w-2xl` silently did nothing — the container namespace was cleared in stage 2, so the
   class does not exist. A reminder that clearing Tailwind namespaces makes typos into
   no-ops rather than errors; the audit for this is a grep, and it is worth running.

**Concepts introduced:** derived data at module scope (2.10), the children-as-slot pattern
and what `"use client"` really costs (2.11), scrollspy metrics (2.12), animation failure
modes (2.13), testing editorial rules (2.14).

**Status:** content complete and verified — 26/26 assertions, clean build, clean lint, no
console errors, no horizontal overflow at 375px. Outstanding: the BridgeAid image is a
promotional title card rather than a screenshot, and it names four contributors, which
suggests BridgeAid was also team work — no team note was supplied for it, so none was
written. Worth confirming.

### 2026-09-22 — Stage 4: content corrections

**Asked for:** the BridgeAid image was replaced; write its missing team note; decide the
Projects/Skills order.

**Done:**

- **New BridgeAid image.** The replacement is a real product screenshot — the Live Disaster
  Map, Leaflet over the Hamilton region, captioned "Showing 2 confirmed incident(s)" — in
  place of a promotional title card. It is also a different file entirely: `.png` not
  `.jpg`, and 1908×814 not 1280×720, so the `src`, `width`, `height` and alt text all had
  to change. Stale dimensions on a `next/image` do not error; they silently produce the
  wrong aspect-ratio box and reintroduce layout shift.
- **Team note written.** The four names came from the _previous_ image, which had since
  been replaced — so they were recovered from an earlier screenshot by rendering it
  magnified in a browser and reading it back, rather than reconstructed from memory. Worth
  the two minutes: a misspelled teammate's name on a live portfolio is not a small error.
  Confirmed: Youssef Elshafei, Adib El Dada, Ahmed Elmanufi, Youssef Elsayyad.
- **Projects moved ahead of Skills.** A visitor should meet the work before a list of
  technologies; a tag list on its own says very little, and the brief's own §1d argues
  depth of work is what reads as senior. One edit to `sections.ts` moved the nav, the
  mobile sheet and the trace bus together — the registry paying for itself.
- **Image sizing reworked** after measurement showed two images being upscaled past their
  source resolution (2.15), including a new documented `--container-figure` token.

**Concepts introduced:** responsive image selection and the cost of upscaling (2.15), the
documented-exception pattern for design tokens.

**Status:** 26/26 assertions, clean build, clean lint, all routes static.

### 2026-09-22 — Stage 5: image format and aspect ratio

**Asked for:** fix the format and aspect-ratio problems across all project images.

**Done:**

- **Format.** All three converted to WebP with `sharp`: **1.32 MB to 186 KB**. The BridgeAid
  screenshot alone went 1208 KB to 75 KB, because a photographic map screenshot was being
  stored as a 4-channel PNG. The CAD drawing was encoded at q94 rather than losslessly —
  lossless WebP of an already-JPEG source re-encodes the JPEG's own artifacts and came out
  _larger_ than the original (134 KB vs 58 KB), which is a good reminder that "lossless"
  is not a synonym for "better".
- **Aspect ratio.** The three sources run 1:1, 1.30:1 and 2.34:1, so at natural proportions
  the project entries read as wildly uneven blocks. They now share one 3:2 frame with
  `object-contain` on a `surface` background. `contain`, not `cover`: a CAD drawing and a
  map are evidence, and cropping them to fit a shape discards the part that makes them
  evidence. Letterboxing on the surface token reads as a deliberate plate.
- Verified: all three frames measure 832x555 (1.50), and every image is served at 1.11x to
  1.44x physical pixels per CSS pixel — no upscaling anywhere.

**A measurement trap worth remembering.** The first check reported the CAD drawing as
upscaled. It was not. When an `<img>` uses `srcset` with `w` descriptors plus `sizes`,
Chromium reports `naturalWidth` **divided by the chosen candidate's effective density**,
not in raw pixels:

```
density      = chosenCandidateWidth / sizesWidth = 1080 / 832 = 1.298
naturalWidth = realPixels / density             = 800 / 1.298 = 616
```

Both images reported exactly 0.77x their true width — the same factor — which was the clue.
Querying the image optimizer directly (`/_next/image?url=...&w=1080`) settled it: it
returns the full 800px source and never upscales. The lesson is the one from stage 2's
profiling, in a different costume: **when a measurement is surprising, check the instrument
before changing the thing being measured.**

**Concepts introduced:** source-format selection by content type, `contain` versus `cover`
as an editorial decision, `naturalWidth` under `srcset` density.

**Status:** 26/26 assertions, clean build, clean lint, Prettier clean.

### 2026-09-22 — Stage 6: replacing the generated logo

**Asked for:** build the WireFish terminal block and remove the AI-generated logo.

**Why it mattered.** The WireFish image was generated key art — a glowing neon-blue fish on
a dark circuit background. It was the single thing on the site that looked machine-made, and
it sat on the anti-pattern list twice over: neon-on-dark with glows (§1b) and decoration with
no relationship to the work (§1 item 11). It was also a _logo_, not evidence — it showed
that someone had made a logo, not that the tool existed.

**Done:**

- Built `visuals/terminal.tsx`: the three real CLI invocations with a copper prompt, each
  annotated with one sourced line, under a header strip carrying the three output modes.
- Deleted `public/images/wirefish-1.webp`.

**The important restraint: it is a synopsis, not a simulated session.** Rendering fake scan
results — invented hosts, invented hop latencies, invented bitrates — would have looked far
more impressive and would have been fabricated evidence. That is the exact failure the rest
of the site is organised against, and TradeWatch's own rule ("no performance number appears
unless a benchmark produced it") would have been violated by its neighbour. Real commands,
no invented output.

**Real text beats a screenshot here** for reasons worth being able to list: it is
selectable, searchable, readable by a screen reader, sharp at any zoom and in any theme, it
costs a few hundred bytes instead of ~50 KB, and it recolours correctly in light mode
instead of being a dark rectangle pasted onto a pale page.

#### Two CSS line-breaking details

1. **`whitespace-pre` scrolls; `whitespace-pre-wrap` wraps.** The first version scrolled
   horizontally inside the block, which at 375px clipped `--interval 100` with nothing to
   signal there was more to the right. A real terminal wraps, so the block wraps.
2. **A hyphen is a soft wrap opportunity.** Once wrapping was on, `--interval` broke across
   two lines as `--` and `interval`, which reads like a different flag. There is no clean
   CSS property to forbid that, so each token is wrapped in `whitespace-nowrap` and the
   spaces between them carry the breaks. Flags stay atomic; lines break where a terminal
   would break them.

**Status:** 26/26 assertions, clean build, clean lint, Prettier clean. Two images remain on
the site, both real artefacts: a product screenshot and a CAD drawing.

## Part 2c — Concepts added with the Live Signal

### 2.16 Rolling statistics, and the bias that hides outliers

The Live Signal widget on the TradeWatch entry runs a genuine rolling z-score
detector. `src/lib/signal.ts` is pure, React-free and unit-tested, because the
whole point is that someone who opens it finds real logic.

**The detector.** Keep a window of the last N points, compute their mean and
standard deviation, and score each new point as `z = (x - mean) / sd`. Flag when
`|z| > 2.5`.

**The subtle part: a point must not be in its own baseline.** If the point being
judged is included in the window used to judge it, it drags the mean toward
itself and inflates the standard deviation, which shrinks its own score — the
bigger the outlier, the better it hides. Measured in the test suite: a true
4.00σ spike scores **3.18σ** if it is allowed into its own baseline. So the
baseline is always the window of points _preceding_ the one under test.

**Sample, not population, standard deviation.** The `n-1` denominator (Bessel's
correction) is right here because the window is a sample of an ongoing process,
not the entire population. With n=30 the difference is about 1.7%, which is
enough to move a borderline point across a 2.5 threshold.

**Why recompute the whole window instead of updating incrementally.** There is a
well-known trick for maintaining a running variance by adding the new term and
subtracting the old one. It is faster and it is a trap: repeatedly adding and
subtracting floating-point terms accumulates error, and the running sum of
squares can drift _negative_, at which point `Math.sqrt` returns `NaN` and every
downstream z-score is silently broken. At a window of 30, recomputation is
thirty additions — free — so correctness wins. Knowing why you did not use the
clever version is worth more than using it.

**Guarding the degenerate case.** A perfectly flat window has sd 0, which makes
every z-score infinite. `zScore` returns 0 when the spread is below 1e-9, so a
flat baseline does not flag every subsequent point forever.

**Honesty about the data.** The series is synthetic: a mean-reverting
(Ornstein–Uhlenbeck) random walk with occasional volatility shocks, so the
widget demonstrates something within about twenty seconds rather than twenty
minutes. Real price series have fat tails, so shocks are a fair approximation
rather than a cheat. The important line is that **the detector knows nothing
about where the shocks are** — it sees only the series. It misses shocks that
land inside normal variance and flags ordinary points that sit far from the
local mean. That is what this class of detector actually does, and it is not
corrected for.

### 2.17 Making a live widget behave

Three things separate a ticking widget from a battery drain:

**Determinism and SSR.** The series is seeded (`mulberry32`), so the first 102
points are computed at module scope and are byte-identical on the server and in
the browser. No hydration mismatch, no flash of an empty chart, and every
visitor sees the same opening frame. The running stream is then fast-forwarded
past that prefix so ticking continues seamlessly. This is the same reasoning as
the project graph's committed coordinates (2.10).

**Pausing on `visibilitychange`.** A backgrounded tab should not be running a
timer, recomputing statistics and queueing React renders nobody will see.
Browsers throttle background timers but do not stop them, so this is on the
page to handle. Verified by faking `document.hidden` and asserting the readouts
stop changing.

**Reduced motion slows rather than stops.** Elsewhere on this site
`prefers-reduced-motion` disables animation outright, because the animation is
decoration. Here the numbers _are_ the content, so freezing them would remove
the point of the widget. The tick slows from 1s to 4s and the pulse is dropped.
The distinction worth carrying: reduce motion, not information.

**Timestamps are the series' own clock.** The flag line reads `t+0066`, not a
wall-clock time. A clock would imply this synthetic stream is tied to real
market hours, and it cannot be server-rendered without a hydration mismatch.

One bug found by looking rather than testing: the caption said "Nothing outside
2.5σ yet" while two flagged points were plainly visible on the chart. The flags
were in the primed prefix, before ticking began, so the caption state was still
null. It now initialises from the last flag in the prefix, so the text and the
chart agree from the first paint.

### 2.18 A command palette as a combobox

Cmd/Ctrl+K opens a palette that jumps to any section, or to a project by name
**or by a technology it uses** — typing "kafka" surfaces TradeWatch. That last
part is what makes it more than a second menu: it is the only way to search the
work by stack.

The accessible pattern is a **combobox over a listbox**, and the key detail is
that focus never leaves the input. Arrow keys move `aria-activedescendant`,
which points at the id of the highlighted option, rather than moving DOM focus
into the list. Moving real focus would strand a screen reader on an element the
combobox no longer owns and break the relationship between the input and the
results. The rest is the standard dialog contract already used by the mobile
sheet (2.7): `role="dialog"`, `aria-modal`, a focus trap, Escape to close,
scroll lock, and focus returned to whatever opened it.

After selecting, focus moves to the destination section rather than back to the
trigger, so a keyboard user carries on reading from where they navigated to.

**A lint rule worth knowing.** The first version tracked group headings by
reassigning a variable while mapping during render:

```tsx
let lastGroup = null;
results.map((c) => { const show = c.group !== lastGroup; lastGroup = c.group; ... })
```

`react-hooks/immutability` rejects this: _"Cannot reassign variable after render
completes."_ Reassigning across a render pass assumes the list renders exactly
once, in order, start to finish — which React does not promise. The grouping is
now computed in the `useMemo` that produces the results, as data.

### 2.19 Tests can break each other

The regression suite went from 26/26 to 24/26 after adding a check that every
mention of "fraud" or "manipulation" on the page is a disclaimer. Neither
failure was a bug in the site:

1. The new check was written by stripping two known disclaimer sentences before
   searching — so it broke the moment the copy was reworded. It now looks for a
   negation near each match instead, which survives rephrasing.
2. To read copy inside collapsed `<details>`, the check force-opened every
   disclosure on the page — and left them open, so a later assertion that
   disclosures are _collapsed by default_ failed. Shared page state between
   assertions is the test-suite equivalent of a global variable.

The habit: when a test starts failing right after you add a different test,
suspect the new test before the code.

### 2026-09-22 — Stage 7: Live Signal and command palette

**Asked for:** one memorable feature demonstrating real logic tied to TradeWatch —
explicitly _not_ a terminal boot sequence, since two of the three reference
portfolios already open with one — plus a Cmd/Ctrl+K command palette.

**Done:**

- `src/lib/signal.ts` — seeded PRNG, Box–Muller gaussian, Ornstein–Uhlenbeck
  series with shocks, rolling mean/sd, z-score classification. Pure, no React.
- `src/lib/signal.test.ts` — 16 tests under Node's built-in runner (`npm test`),
  covering the hand-checked dataset, the sample-vs-population denominator, the
  flat-baseline guard, the self-exclusion bias, determinism, and that the flag
  rate stays in a band that reads as a real threshold.
- `visuals/live-signal.tsx` — the chart, the dashed rolling-mean baseline, copper
  flags with a one-shot pulse, mono readouts and a caption linking to TradeWatch.
- `nav/command-palette.tsx` — combobox/listbox, section and project search
  including stack tags, with a `⌘K` trigger in the header for discoverability.
- `allowImportingTsExtensions` in tsconfig so the test file's `./signal.ts`
  import satisfies both Node's ESM resolver and the Next build.

**Verification:** 16/16 unit, 25/25 new-feature browser assertions, 26/26
regression. The feature suite checks the statistics as rendered, not just that
pixels appeared: it reads `value`, `mean`, `σ` and `z` off the DOM and asserts
`z === (value - mean) / σ` to within 0.02. It also fakes `document.hidden` to
prove the stream pauses, and waits up to 60s for a real flag and then asserts
the reported deviation actually exceeds 2.5.

**Concepts introduced:** rolling-statistics correctness and self-exclusion bias
(2.16), determinism/SSR/visibility/reduced-motion for live widgets (2.17), the
combobox pattern and the React Compiler immutability rule (2.18), test
cross-contamination (2.19).

**Status:** clean build, ESLint 0, Prettier clean, all three suites green.

### 2026-09-22 — Stage 8: pre-ship audit

**Asked for:** verify (not assert) responsiveness, accessibility, performance;
remove leftovers; add favicon and meta; document deployment.

**Responsive — measured at 375 / 768 / 1280 / 1920.** No horizontal overflow at
any width, with every `<details>` force-opened so long content was included.
Body copy holds at the 68ch measure. Nav collapses to the sheet below `lg`,
trace bus appears at `xl`.

One real gap: Cmd/Ctrl+K worked at every width but the trigger was hidden below
`lg`, so on a phone the palette was unreachable — there is no Cmd key to press.
The trigger is now a magnifier below `lg` and the `⌘K` hint above it. The
tradeoff considered and rejected was hiding the palette on mobile entirely; it
is the only way to search projects by stack, and the sheet lists sections only.

**Accessibility — axe-core across five states** (page and palette in both
themes, plus the mobile sheet). Found **three critical violations**, all in the
palette, all from the same mistake: `<ul role="listbox">` containing `<li>`
wrappers with `<button role="option">` inside.

- `aria-required-children` — a listbox may only contain `option` and `group`.
- `aria-required-parent` — the options were not direct children of the listbox.
- `listitem` — giving the `<ul>` a non-list role orphaned its `<li>` children.

Fixed by restructuring to a `div[role=listbox]` containing
`div[role=group][aria-label]` containing `div[role=option]`. Two things worth
keeping from this:

1. **Options are divs, not buttons, on purpose.** In a combobox the options are
   never individually focusable — focus stays in the input and
   `aria-activedescendant` points at the active one. A `<button>` there is both
   the wrong role and a tab stop that should not exist. "Always use a button"
   is a good rule with a real exception.
2. **The first attempt at grouping was still wrong** and only caught by reading
   it back: wrapping "the first option of each group" put options 2..n outside
   the group they belonged to. The results are now derived in two shapes — flat
   for keyboard indexing, grouped for rendering — from one source.

Also measured what axe cannot: **SVG text contrast**. axe reports 18 nodes as
"incomplete" because it cannot compute contrast for `<text>` in SVG. Computed
manually against each element's resolved background: everything clears AA in
both themes, lowest being 5.14:1.

Final state: **0 axe violations**, and in the production build **40 tab stops,
every one with an accessible name and a visible focus ring**. The single
unnamed stop seen in development was Next's dev overlay, which does not ship —
worth knowing before "fixing" it.

**Performance — production build at 4× CPU throttling.**

|                             |                                                                     |
| --------------------------- | ------------------------------------------------------------------- |
| Transfer                    | 199.5 KB JS, 7.2 KB CSS, 59.8 KB fonts, 266.5 KB total, 12 requests |
| LCP                         | 792 ms                                                              |
| CLS                         | **0.0000**                                                          |
| 6s with Live Signal ticking | median **16.7 ms (60fps)**, p95 19.2 ms, **0 long tasks**           |
| Full-page scroll            | median 16.9 ms (59fps), 1 frame over 50 ms                          |

**Lazy work below the fold.** The Live Signal previously started ticking on
hydration and ran while the visitor was still reading the hero — statistics and
re-renders for a chart nobody had scrolled to. It is now gated on an
IntersectionObserver as well as `visibilitychange`, so it is idle until it is on
screen. Verified both ways: unchanged after 3.5s at the top of the page, moving
within 2.5s of being scrolled into view.

**Metadata.** Added `metadataBase` — without it Next emits relative `og:image`
URLs and most scrapers silently drop the image. The card itself is generated by
`next/og` at build time from `src/app/opengraph-image.tsx` rather than committed
as a binary, so it cannot go stale and there is no PNG in the repo. The one
compromise: Satori has no access to the stylesheet, so the token hex values are
duplicated literally in that file — the only place in the project where a colour
is written twice, and it is commented as such.

`SITE.url` no longer contains `https://example.com`. It reads
`NEXT_PUBLIC_SITE_URL`, falls back to Vercel's production hostname, then to
localhost.

**Concepts introduced:** ARIA listbox/option/group structure and when not to use
a button (this entry), auditing what axe marks "incomplete" rather than trusting
a green result, intersection-gated background work.

**Status:** 0 axe violations, 26/26 regression, 25/25 features, 16/16 unit,
clean build, ESLint 0, Prettier clean, CLS 0.

---

### 2026-09-23 — Stage 9: feedback round on the live site

Seven changes from a review of the deployed site. The interesting parts are
below; the rest (header contact icons, a compact frame for one image) is
mechanical.

**Two kinds of edge in one graph, drawn differently.** The project graph
derived edges from shared stack tags, which left WireFish (C, raw sockets) with
no edges at all. The tempting fix is to fake a tag overlap. The honest one is to
add a second real relationship, shared teammates, and keep it visibly separate.
The model change is small: `GraphEdge` gained a `kind: "stack" | "people"`, and
the derivation became one generic function run twice over two indexes (tag to
projects, person to projects). A pair can hold both kinds, and then both are
drawn. Stack edges stay solid and straight. Teammate edges are dashed and
curved, like a jumper wire on a circuit board, with a key under the diagram
saying which is which. Interview angle: _encoding different semantics with
different visual channels_. If one line style meant two things, the diagram
would be making a claim the data does not support.

One consequence nobody asked for: Adib El Dada is on both BridgeAid and Catan, so
the rule also produced a BridgeAid–Catan teammate edge. It is true and derived
from existing data, which is exactly the point of deriving edges rather than
drawing them by hand. A derived rule applies everywhere, not just where you
were looking.

**Why the dashed edges fade instead of drawing in.** Motion's `pathLength`
animation works by setting `stroke-dasharray` and animating
`stroke-dashoffset`. A dashed line already uses `stroke-dasharray`, so the
draw-in would overwrite the dashes. Two features competing for the same CSS
property is a common class of animation bug. Here the dashed edges fade in
after the solid ones have drawn.

**Curves that avoid bystanders.** Triage Flow to Catan as a straight line passed
about 10 units from the BridgeAid node, so it looked like BridgeAid was
involved. Each teammate edge is a quadratic Bézier whose control point is offset
perpendicular to the line, _away_ from the nearest other node. Finding that
node takes two formulas: the projection `t = (p−a)·(b−a) / |b−a|²` (is the node
alongside the segment at all?) and the perpendicular distance `(p−a)·n` (which
side is it on, and how close?). It is deterministic, so it gives the same path
on every render.

**Why nobody noticed the heading animation.** A trace rule already drew in
under every heading, but it fired at intersection threshold 0 on a 1px element,
the instant one pixel crossed the _bottom_ of the viewport, and ran for 240ms.
It had finished before anyone looked there. The fix is a shrunken root:
`useInView(ref, { once: true, margin: "0px 0px -15% 0px" })` fires only once the
heading is clearly on screen. The new sequence is a pad lighting, the trace
running out in full copper, the heading sliding 8px along the trace direction,
and then the trace cooling to "spent" copper. It is `once`, so it never replays
(the brief lists replaying entrances as an anti-pattern).

Two robustness details worth knowing:

- `initial={false}` in Motion means "render straight into the `animate`
  state". That is how reduced motion gets a finished frame with no tween.
- Entrance animations server-render their hidden starting styles inline, and
  only JavaScript clears them. A `<noscript><style>[data-reveal]{opacity:1
!important;transform:none!important}</style></noscript>` in the head means
  that with JS off the page shows content instead of blank space.

**A testing trap: headless screenshots lie about scroll-triggered things.** A
1440×13000 headless window, the cheap way to screenshot a whole page, showed
every heading but the first as blank. It looked like a bug. Driving a normal
1440×900 viewport through the Chrome DevTools Protocol (a raw WebSocket from
Node, no Puppeteer), scrolling like a reader and reading `getComputedStyle`,
showed all six at opacity 1, plus a mid-animation frame. The lesson: verify
IntersectionObserver behaviour in a realistic viewport, because an unrealistic
one tests the harness, not the page.

**Why a square image looked twice as big.** Every project image sits in the
same 3:2 `object-contain` frame. A 2.34:1 screenshot fills a strip of that
frame (~355px tall), but a 1.3:1 drawing fills almost all of it (~555px). Same
frame, very different _visible_ size. Equal containers don't give equal visual
weight; what the eye compares is the visible content. The fix gives that image a
narrower frame so its visible height (~340px) matches.

**Copy as data, not template.** The Problem / Constraint / Trade-off `<dl>`
became a plain `description: string[]` of paragraphs. The labelled structure
read as a form being filled in. Facts that lived only in the removed prose
(course code, CommandManager, the untouched classes, raw-socket privileges)
moved into the implementation bullets so nothing claimed was lost.

**Concepts introduced:** edge kinds and visual encoding, dasharray conflicts,
point-to-segment projection, IntersectionObserver `rootMargin`, Motion
`initial={false}`, `<noscript>` fallbacks for animated content, CDP-driven
verification.

### 2026-09-23 — Stage 9b: media before prose

Each project entry now reads title, then the Live demo button, then all media
(image, pipeline diagram, terminal, Live Signal), then the write-up, then the
implementation bullets. The reasoning: show the work first, then explain it. A
reviewer skimming six entries can take in each one visually before deciding
to read it.

The Live demo button stays above the media on purpose. It's an action, not
media, and moving it below three paragraphs would undo the "impossible to
miss" fix from Stage 9.

Verification note: order was checked in the DOM rather than by eye, with
`Node.compareDocumentPosition`. `a.compareDocumentPosition(b) &
Node.DOCUMENT_POSITION_FOLLOWING` (bit 4) is non-zero when `b` comes after `a`
in document order. It's a one-line, layout-independent way to assert ordering
in a test.

---

### 2026-09-23 — Stage 10: a 3D project graph and an ambient circuit backdrop

Both are deliberate exceptions to the brief's "no ambient looping" rule,
recorded as an amendment in DESIGN_BRIEF.md §2.7 so the contract stays true.

**3D without a 3D library.** Six nodes don't justify three.js. The whole
pipeline is three ideas:

1. _Model space._ Each project has a committed `(x, y, z)`. Nodes are centred
   on their centroid so rotation happens in place. The object is rigid; only
   the viewing angle changes.
2. _Rotation matrix._ Orientation is one 3×3 matrix `R`. Each frame, a small
   rotation is multiplied in: `R ← step · R`. `step` comes from **Rodrigues'
   formula** (axis + angle → matrix). Left-multiplying applies the rotation in
   _screen_ space, which is what makes dragging feel right.
3. _Perspective projection._ A point at depth `z` with the camera `D` away
   lands at `(x, y) · D / (D − z)`. That scale factor also drives the depth
   cues: nearer nodes are bigger, brighter and drawn later (the **painter's
   algorithm**).

Worth knowing for interviews:

- **Numerical drift.** Multiplying thousands of tiny rotations accumulates
  floating-point error, and the matrix slowly starts to shear and scale the
  object. The fix is to **re-orthonormalise** periodically with Gram–Schmidt:
  normalise row 1, remove its component from row 2 and normalise, then set
  row 3 = row1 × row2. A unit test runs 36,000 frames (~10 minutes) and
  asserts `det = 1` and preserved lengths.
- **Trackball drag.** A drag of `(dx, dy)` becomes a rotation about the
  screen-plane axis `(−dy, dx, 0)` by an angle proportional to the distance.
  Signs are the classic bug, especially because SVG and canvas y points _down_.
  The tests pin the behaviour: dragging right moves the front of the object
  right.
- **Non-repeating ambient motion without randomness.** The rotation axis
  drifts as two sines with incommensurate periods (~170s and ~270s). Because
  the ratio of the periods is irrational, the combined motion never exactly
  repeats, yet every instant is smooth and deterministic.
- **Sizing a rotating object.** Scale is fitted once from the bounding
  sphere's radius, so the graph never breathes as it turns. With the camera
  4 radii away, a point on that sphere projects at most ≈1.04× the radius from
  centre. That's calculus on `√(R²−z²)·D/(D−z)`, not a guess.

**SVG to canvas: a profiling story.** The first version moved SVG elements
each frame, writing geometry straight to the DOM and bypassing React. Under 4×
CPU throttling it ran at ~30fps with long tasks. The Performance-domain metrics
(`Performance.getMetrics` via DevTools Protocol) showed why: **~6ms of style
recalc and ~3ms of layout per frame** for a few dozen attribute writes. CSS
`contain: strict` changed nothing, which proved the cost was intrinsic to
mutating DOM and not to invalidation leaking outward. A canvas frame is ~30
draw calls with no style, no layout and no DOM. Result: the graph's frames
became indistinguishable from an idle page. What SVG gave for free had to be
rebuilt:

- _Hit-testing:_ find the nearest projected node within 18 units, preferring
  the front one.
- _The hover packet:_ a short span stroked along the edge, sampled from the
  quadratic Bézier `(1−s)²A + 2(1−s)sC + s²B`.
- _The one-time edge draw-in._
- _Theme colours:_ canvas can't read CSS variables live, so a
  MutationObserver re-reads them when `data-theme` changes.
- _Crisp lines:_ the backing store is sized to `cssWidth × devicePixelRatio`.

**Separating ownership.** React owns _interaction state_ (hovered node,
filter). The animation loop owns _orientation and drawing_. They meet through
refs, so hovering re-renders the legend but never the loop, and 60 frames a
second never touch React.

**Ambient backdrop, CSS only.** A 240px SVG tile of traces is used as a
**mask** rather than a background image. An SVG inside a `data:` URL can't
read the page's CSS variables, but the colour _behind_ a mask can, so the
backdrop follows the theme for free. The layer is oversized by one tile and
drifts exactly one tile, so the loop is seamless. The pulses live _inside_ the
masked layer, so the mask trims them to the trace: the trace itself lights up.
Irregular timing without JS: two elements share one 120s keyframe timeline
with pulses at hand-picked offsets (gaps of 20, 25, 20, 29 and 25s).

Paint-order detail: the backdrop is `z-index: -1`, and the body's background
had to go. Negative z-index layers paint _above_ the root background but
_below_ in-flow block backgrounds, so a background on `<body>` would cover
them.

**Measurement caveat worth being honest about.** In headless Chrome, _any_
CSS transform animation (tested with a bare 200px square) caused per-frame
main-thread style recalcs. That's the harness lacking real GPU compositing.
Numbers should always say what environment produced them.

**A self-inflicted build break, and its lesson.** A test-script `sed` used `#`
as its delimiter, and a `#work` selector in the replacement parsed as sed's
`w` flag, _writing a file to disk_ named after the rest of the expression.
Tailwind's source scanner then took that filename's garbage "extension" as a
glob and Turbopack panicked. Worse, the panic survived deleting the file,
because Turbopack's persistent cache remembered it. Lessons: choose sed
delimiters that can't appear in the text, and when a build error references
something that no longer exists, suspect the cache (`.next/`).

**Concepts introduced:** Rodrigues' formula, Gram–Schmidt, trackball
rotation, perspective divide, painter's algorithm, incommensurate
frequencies, canvas vs SVG cost model, DPR-aware canvas, CSS masks for
theme-aware patterns, stacking order of negative z-index layers.

---

### 2026-09-23 — Stage 11: hydration warning, and four project demos

**The hydration error was a browser extension, and the fix is deliberately
narrow.** The diff React printed showed `data-gr-ext-installed` and
`data-new-gr-c-s-check-loaded` on `<body>`, attributes Grammarly adds before
React hydrates. React compares server HTML against its first client render
and reports attribute differences. The fix is `suppressHydrationWarning` on
`<body>`, and it's worth knowing that it's **one level deep**: it silences
attribute mismatches on that element only, not its children, so a real bug
elsewhere still gets reported. Verified by simulating the extension through
the DevTools Protocol (`Page.addScriptToEvaluateOnNewDocument` stamping the
attributes before hydration): the exact error appears without the fix and
disappears with it. A first attempt at the simulation used a MutationObserver
on `document.documentElement` and failed, because that script runs before
`<html>` exists. Injected scripts run _very_ early.

**Live Signal: presentation, not logic.** The series is shown as a price by
adding a constant 100. Standard deviation and z-score are **invariant under a
constant shift**, so the detector and its 16 tests are untouched. The chart
now shades `mean ± 2.5σ`: the exact region the detector considers normal, so
"flagged" and "left the band" are the same event, visible without reading.
The ANOMALY tag is HTML positioned in percentages over the SVG, because the
SVG uses `preserveAspectRatio="none"`, which would stretch SVG text.

**Typing terminal without a hydration mismatch.** The server renders the
finished transcript (full content without JS). The animation needs the client
to render something _different_, a partial transcript, without tripping React.
`useSyncExternalStore(subscribe, () => true, () => false)` returns the server
snapshot (`false`) during hydration and `true` afterwards. It's the sanctioned
"am I hydrated?" check, and it replaced a setState-in-effect that React 19's
lint rule `react-hooks/set-state-in-effect` rejects. Two layout details:

- An invisible copy of the full transcript sits in the same grid cell as the
  animated one, so the block has its final height from the start and
  nothing below shifts (**CLS**).
- Screen readers get an `sr-only` transcript, whole, instead of a
  character-by-character animation.

**Leaflet in Next.js.** Leaflet touches `window` at import, so it can't
render on the server. `next/dynamic(..., { ssr: false })` is only allowed
inside a **Client Component**, and the project entry is a Server Component,
so a thin client wrapper exists just to hold the dynamic import. That wrapper
also defers loading until the map is within a screen's height of the
viewport, keeping ~40KB of Leaflet off the initial load. Three Leaflet
gotchas:

1. The default marker icon is a PNG referenced by a relative URL that
   bundlers break, so the pins are SVG `divIcon`s.
2. Leaflet panes use z-indexes up to 1000, which painted over the sticky
   header. `isolation: isolate` gives the map its own stacking context, so
   its z-indexes only compete with each other.
3. A map in the middle of a page traps scroll gestures, so `scrollWheelZoom`
   is off, and one-finger dragging is off on coarse pointers.

**Concepts introduced:** `suppressHydrationWarning` scope, shift-invariance
of σ and z, `useSyncExternalStore` for hydration-safe client branching,
`next/dynamic` with `ssr: false`, stacking contexts via `isolation`, layout
reservation to avoid CLS.

---

### 2026-09-23 — Stage 12: loops, an idle cue, and a first-visit intro

**Deciding before first paint whether an overlay shows.** The intro must
cover the page on a first visit without the page flashing first, and must
never appear otherwise: returning visits in the same session, reduced motion,
no JavaScript, deep links. React can't decide that in time, because by the
time a component runs the page has painted. The solution is the same trick as
the theme toggle: a tiny **inline script in `<head>`** reads
`sessionStorage` and `matchMedia` synchronously and sets
`html[data-intro="play"]`. The overlay is `display: none` unless that
attribute exists, so CSS alone controls first paint. React only runs the
animation and removes the attribute afterwards. No-JS visitors never see it,
because the script never runs.

**Reusing real logic instead of scripting a demo.** The intro's spike is the
real detector's first flag on a seeded stream. I searched seeds for one whose
first anomaly (with |z| ≥ 3) lands on tick 16–20; seed 182 flags on tick 19 at
z ≈ 6.8. "Searched for a seed" is worth saying out loud: the _timing_ was
chosen, but the flag itself is the detector's own decision, which is exactly
what the Live Signal widget later shows.

**A cheap loop without drift.** Motion's `repeat: Infinity` with `delay` only
on the first iteration means each hex tile's period is
`duration + repeatDelay`. Setting `repeatDelay = CYCLE − duration` for every
tile keeps them all on one period with their stagger intact forever.
Restarting on view entry is done by changing the SVG's `key`. That exposed a
real bug: the in-view observer was bound to the element being remounted, so
after the first remount it watched a detached node. The fix is to observe a
**stable ancestor**. Rule of thumb: never attach an observer to something
you're about to replace via `key`.

**The terminal "erase" is a `clear` command.** Instead of a wipe effect, the
prompt types `clear` and the screen empties: the erase is motivated by the
thing being depicted. The frame list is precomputed; one index in a ref
survives pausing when scrolled away, so the loop resumes mid-session instead
of restarting.

**Two pulses as one element.** "Fire two pulses back to back" is one element
whose gradient has two humps 280px apart. The pair can't drift out of sync,
and it costs the same as one pulse.

**Profiling caught a small regression, and the fix is a classic.** The idle
glow built a `createRadialGradient` and filled it every frame, which trended
frame times up under 4× CPU throttling. The fix is a **sprite**: render the
gradient once into an offscreen canvas and `drawImage` it with
`globalAlpha`, a blit instead of a rasterisation. It's rebuilt only when the
colour changes (theme switch). Worth knowing that the measurements were noisy
(the same state varied 6–12ms at p95); the evidence was the _trend_ across
repeated runs, not one number.

**Not fabricating a data edge.** A request to add a "shared collaborator"
edge for a teammate who, in the source material, appears on only one project
can't produce an edge: an edge needs two projects. The right move is to record
the true fact (he's on Triage Flow) and ask for the missing one, not to
invent it.

**Concepts introduced:** pre-paint inline scripts for overlay gating,
seeded search for deterministic demos, Motion repeat/repeatDelay phase,
observers vs. keyed remounts, sprite caching on canvas, reading noisy
benchmarks.

---

### 2026-09-23 — Stage 13: dark only, an alignment audit, and two redesigns

**The alignment bug had two stacked causes, and only measuring found the
second.** The visible symptom was text not lining up with the media above
it. The first cause was obvious: media used a wider `figure` width (52rem)
while text used `max-w-prose`, two different widths in one column. After
unifying them, a _script_ measuring every block's pixel edges (not
screenshots) still found one block per entry ending 125px short: the team
line, which is in the smaller `text-micro` size.

- **`ch` is relative to the element's own font size.** `68ch` on a 0.8rem
  element is 20% narrower than `68ch` on body text. Any width in `ch` or `em`
  silently shrinks on small-text elements. Widths meant to align across font
  sizes belong in `rem`.
- **Changing the token did nothing, and the compiled CSS said why.**
  `grep`ping the built stylesheet showed `.max-w-prose{max-width:65ch}`:
  **Tailwind v4 has a built-in static `max-w-prose` utility that ignores a
  theme token of the same name.** The site's `--container-prose` had never
  applied, from the first commit. The fix is renaming the token
  (`--container-column: 39rem` → `max-w-column`).

The lesson for interviews: when a fix "does nothing", check what the tool
actually emitted before trying another fix. And measure layout numerically;
eyeballing can't tell 624px from 499px across a page.

**A PCB trace solves the "timeline with some missing dates" problem.** A
straight timeline line forces either a reserved date column (so dateless
entries show an empty gap) or a line that moves. Dated entries are sorted
first, their trace sits at the date column's edge, and a short jog with 45°
chamfers (the same routing idiom as the trace bus) steps the line to the left
edge for the dateless entries. On phones there's no date column, so the date
sits above the title and the line is straight. Implementation note: Tailwind
only generates classes it finds as **literal strings**, so
`` `sm:left-[${DATE_COL}]` `` silently produces nothing. The values have to be
written out in full.

**Skills as a real second index, derived, not mapped.** A skill "is used in" a
project when any `/`-separated part of its name matches one of the project's
stack tags, using the _same normaliser the graph uses for edges_. No
hand-maintained mapping means no drift, and no inferred links: "Continuous
Integration" isn't tied to TradeWatch, because no stack tag says so. A derived
group ("Also in the projects") lists stack technologies the supplied skills
don't cover (Kafka, PostgreSQL, Docker…), otherwise the most concrete part of
the work couldn't be probed.

**Annotation vs. edge.** A teammate who worked on exactly one project can't be
an edge (an edge needs two endpoints). The data model now separates the two:
`collaborators` derives edges, `graphNote` annotates a single node.

**Timers lie in background and unfocused tabs.** The intro chained twenty
~110ms `setTimeout`s. Browsers clamp timers in background/unfocused tabs to
about 1/s, so in testing the four-second intro stretched past twenty seconds,
with the page scroll-locked. Two fixes, both general:

1. **Derive progress from elapsed time** (`performance.now() − start`), so a
   late tick catches up instead of stretching the sequence.
2. **Release locks at the start of the exit, not the end.** The scroll lock
   now applies only while `data-intro="play"`, so a delayed cleanup timer
   can't leave the page unscrollable.

Also: a hidden tab skips the intro entirely, since nobody is watching it.

**Deleting a feature cleanly.** Removing light mode meant deleting the toggle,
the pre-paint theme script, the light palette, the transition and icon-swap
CSS, the canvas's MutationObserver on `data-theme`, and the viewport's
per-scheme `themeColor`, then grepping for anything left. One slip worth
remembering: cutting a CSS block "from marker A to marker B" also deleted two
unrelated blocks that happened to sit between them (packet motion and the
trace-bus fill). They were restored verbatim from `git show HEAD:`. The
lesson: cut the exact range you mean, and diff after structural edits.

**Concepts introduced:** `ch` vs `rem`, framework built-ins shadowing tokens,
numeric layout audits, literal-class requirement for Tailwind's scanner,
derived cross-references, timer clamping and elapsed-time animation.

### 2026-09-23 — Stage 13b: widening the page

The previous stage misread the complaint: text and media were already
aligned; the page as a whole was too narrow. Three limits stacked up: the
content column (39rem), a centred page frame (1120px) and, at xl, a fixed
15rem gutter for the trace bus. The first two were raised (column 50rem,
frame 1360px); the gutter can't shrink because the bus physically lives in
it. At 1440px the content now spans 272–1072px instead of 305–929px, and the
left edge is at its minimum (gutter + page padding).

Because every block reads its width from one token, widening the column
widened every section and kept text and media aligned without touching a
single component. That's the payoff of the single-token fix in Stage 13.

Two knock-on effects of a wider column are worth noticing:

- **Scalable drawings scale their text too.** An SVG with a `viewBox` grows
  its labels along with its width. The pipeline diagram's frame now spans the
  column (so edges still align) while the drawing inside stays at its
  designed size.
- **Layout choices made for a narrow width should be revisited.** The About
  card had been stacked only because the column was narrow, so it went back
  to two columns on large screens.

Trade-off accepted: at 50rem a line of body text is roughly 95 characters,
above the ~75 often cited as ideal for reading comfort.

### 2026-09-23 — Stage 13c: hero copy and an accented About panel

The hero paragraph now states intent (internships, connecting with people)
instead of describing working style. Recruiters skim the hero first, so the
thing you want from them belongs there, not buried in About.

The About panel gained a faint copper outline. It reuses the existing
`copper-spent` token (copper at 30% opacity) rather than an ad-hoc
`border-copper/30`: same colour, but one name for "copper, receded" means the
outline, spent traces and anything else faint-and-copper stay in sync if the
accent ever changes. Only the outer edge changed; the internal dividers stay
hairline so the accent frames the panel instead of turning it into a grid.

The degree line now reads B.Eng.Mgt: McMaster's Engineering and Management
program is one combined degree, and saying so is more accurate than listing
two.

**Concepts introduced:** put the call to action where readers look first;
semantic tokens over one-off opacity modifiers.

### 2026-09-23 — Stage 13d: the graph that "vanished" on phones

Report: the 3D project graph was invisible on a real phone but fine on a
laptop. Checked in a real mobile emulation (412px viewport, touch, DPR 2.6),
not a narrowed desktop window.

**Root cause:** not a bug in the touch code or the sizing maths. The wrapper
had `hidden md:block`, so below 768px it was `display: none`. The canvas was
in the DOM with a 0×0 box and a 0×0 backing store and painted nothing. It
was deliberate: DESIGN_BRIEF §2.2 said "below md, replace the graph with the
list". Eliminated along the way: no touch or `navigator` branching (pointer
events handle mouse and touch in one path), and the ResizeObserver sizing
was fine. It just had nothing visible to measure.

**Why the brief said that:** the canvas draws in a fixed 820-unit coordinate
space scaled to fit. On a 372px canvas that's a 0.45× scale, so 12.5-unit
labels would render at ~5.6px and the 18-unit tap radius at ~8px. Removing
`hidden` alone would have "fixed" visibility and shipped an unreadable,
untappable diagram.

**Fix:** show it at every width, and floor the things that must not scale
in _screen_ pixels: labels ≥11px, tap radius ≥22px. Geometry still scales;
text and touch targets don't shrink below usable. A label that would then
run off the right edge flips to the left of its node.

**Verified:** before, `display: none` and 0 painted pixels. After, a
372×236 canvas with 31k painted pixels; a synthetic touch drag rotates it
without scrolling the page; a tap on a node follows its link.

**Concepts introduced:** "invisible" has three distinct causes (not in the
DOM, zero-size, present but unpainted), so measure which one before
touching code; a design rule that looks arbitrary often encodes a real
constraint, so find it before deleting the rule; scale geometry, floor
text and hit targets in CSS pixels.

### 2026-09-23 — Stage 14: security review, scoped to a static site

A static portfolio has no database, sessions or auth, so most of OWASP
doesn't apply. What does: secrets in git, dependency CVEs, raw-HTML
injection, reverse tabnabbing, client storage, response headers, third-party
requests, accidental server endpoints, and personal data.

Findings worth remembering:

- **"Secret" greps are noisy.** Every hit for `token` was a design token.
  Checking the full history (`git log -p`), not just the working tree, is
  the part people skip: a key deleted in a later commit is still public.
- **Leaflet renders some strings as HTML** (attribution, `divIcon.html`).
  Safe here because both are hardcoded constants, but a library taking HTML
  strings is exactly where user input must never be routed.
- **A CSP on a static Next.js site needs `'unsafe-inline'` for scripts.**
  Next inlines hydration data, and the only strict alternative (per-request
  nonces) forces dynamic rendering. `default-src 'self'`, one allowed image
  origin, `object-src 'none'`, `base-uri 'self'` and `frame-ancestors 'none'`
  still close off most of what a CSP is for.
- **Headers interact with third parties.** `Referrer-Policy: no-referrer`
  looks strictest, but OpenStreetMap's tile policy requires a Referer, so
  it would have broken the map. `strict-origin-when-cross-origin` sends only
  the origin cross-site.
- **Test the failure path of storage.** A synthetic run with `sessionStorage`
  throwing (blocked site data) showed the intro script's `try/catch` holds.
- **Verify the header set on a production build**, not in dev: dev adds
  `'unsafe-eval'` and `ws:` for React's debugging and hot reload.

**Concepts introduced:** threat-model before checklist; CSP trade-offs
under static generation; reverse tabnabbing and `rel="noopener"`;
`X-Powered-By` as free reconnaissance for an attacker.

### 2026-10-07 — Stage 14b: contact email

The contact email changed to a career-specific address. A one-line edit in
`src/config/site.ts`, because every mailto link and the visible address in
Contact read from `CONTACT.email`. That's the payoff of one config file for
identity: a change in one place can't leave a stale copy elsewhere.

### 2026-10-21 — Stage 15: recruiter pass

Contact form, an offline "Ask about me" assistant, a playable backtest, macOS
terminal frames, 44px touch targets, and a TradeWatch content correction.

- **A demo should run the project's real logic.** Live Signal now uses
  TradeWatch's actual detector (median and MAD over the last 60 moves,
  threshold 3.5) instead of a mean and standard deviation the repo never
  used. The backtest demo is a line-for-line port of `sma_crossover.py` and
  the backtest engine, and its tests mirror the repo's: no lookahead, fills
  at the next bar's open, open trades never force-closed.
- **Retrieval, not generation, for a portfolio chatbot.** BM25 over a
  knowledge base written from the site's own data can't invent a fact, can't
  be rate-limited and costs nothing. The hard part is refusing: a question
  that matches only generic words ("does he know Rust?") must say "I don't
  know", not answer with the skills list.
- **The server can't know `prefers-reduced-motion`.** Two components chose
  text or an element from `useReducedMotion()` during render, which differs
  between server and client and caused hydration errors only for visitors
  with reduced motion on. Render both and choose in CSS instead.
- **Focus can't move to a hidden element.** Returning focus to the launcher
  had to wait for the re-render that made it visible again.
- **A form that can fail must not lose what was typed.** Every failure ends
  in a mailto link prefilled with the message.

**Concepts introduced:** BM25 and refusal thresholds; robust statistics
(median, MAD); lookahead bias in backtests; hydration mismatches.

### 2026-10-21 — Stage 16: playable demos and motion

Every project got a demo you drive rather than watch, the layout went full
width, and the site gained a light layer of pointer-driven motion.

- **Port the rule, simulate the world.** Each demo's logic is a small pure
  module with tests (triage levels and queue order, BridgeAid's report
  verification, WireFish's argument parser, the Catan AI's turn, TradeWatch's
  consumer groups). Only the inputs are made up, and each caption says which
  part is which.
- **Show a different angle from a teammate's site.** Adib already demos three
  of the same projects, so these show other sides: playing the patient,
  trying to break the verification rule, typing real CLI flags.
- **Write CSS variables, not React state, for pointer effects.** One
  listener sets `--gx/--gy` on the hovered panel; the browser does the rest.
  Nothing re-renders as the mouse moves.
- **`setState` inside an effect is a smell.** The lint rule caught an
  auto-play loop stopping itself from an effect; the fix was to stop it in
  the same handler that computes the final step.
- **A 1px effect is invisible in a 1x screenshot.** The edge glow worked all
  along; checking it needed a 4x capture. A faint inner wash makes it read at
  normal size too.

**Concepts introduced:** Kafka consumer groups and offsets; the Template
Method and Visitor patterns as runnable steps; CSS mask compositing.
