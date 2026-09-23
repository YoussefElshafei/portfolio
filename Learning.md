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

| Layer | Choice | Version installed |
|---|---|---|
| Framework | Next.js, App Router | 16.3.5 |
| UI runtime | React | 19.2.8 |
| Language | TypeScript, strict | 5.9.3 |
| Styling | Tailwind CSS v4, CSS-first | 4.x |
| Animation | `motion` (formerly Framer Motion) | 13.4.0 |
| Icons | `lucide-react` + inlined brand marks | 1.47.0 |
| Host | Vercel | — |

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
wrong: it does not mean "this one component is a client component." It means *this module
and everything it imports* gets bundled and shipped to the browser.

In this codebase that distinction is doing real work:

- `site-footer.tsx` has no `"use client"`. It is a Server Component. Its icon SVGs and
  links are rendered to HTML on the server and the browser downloads **zero JavaScript**
  for it.
- `trace-bus.tsx`, `site-header.tsx`, `mobile-nav.tsx`, `project-graph.tsx` and
  `theme-toggle.tsx` all need interactivity, so they are client components.
- `layout.tsx` stays a Server Component even though it *renders* client components. A
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

| Namespace | Generates |
|---|---|
| `--color-copper` | `text-copper`, `bg-copper`, `border-copper`, … |
| `--text-h1` | `text-h1` |
| `--radius-trace` | `rounded-trace` |
| `--font-mono` | `font-mono` |
| `--spacing-gutter` | `pl-gutter`, `mt-gutter`, … |
| `--container-wide` | `max-w-wide` |

#### `@theme` vs `@theme inline` — the important distinction

This trips people up and is a good thing to be able to explain.

With plain `@theme`, Tailwind resolves the value at build time and emits the *literal
value* into the utility class. With `@theme inline`, it emits the `var()` reference itself.

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
stylesheet and a genuinely good interview anecdote: *"I encoded the design constraints into
the type system of the CSS so they couldn't be violated by accident."*

A caveat worth knowing: clearing `--color-*` also removes `transparent` and `current`, so
they are re-added explicitly.

#### Cascade layers, and why the theme icon swap works

Tailwind v4 wraps its output in `@layer theme, base, components, utilities`. CSS cascade
layers have a rule that surprises people:

> **Unlayered styles beat layered styles**, regardless of specificity.

So this, written outside any layer in `globals.css`:

```css
:root[data-theme="dark"] [data-theme-icon="light"] { display: none; }
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

1. Server sends HTML with *some* default theme — say dark.
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
  is *parser-blocking*: the browser stops building the DOM and executes it immediately.
  Because it runs before `<body>` exists, it runs before anything has been painted.
- **It sets an attribute on `<html>`**, which already exists at that moment. It cannot
  touch `<body>` — that has not been parsed yet.
- **It is wrapped in `try/catch`.** `localStorage` *throws* in some privacy modes rather
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

**The general lesson**, which is worth stating in an interview: *if state already lives in
the DOM and CSS can read it, duplicating it into React state creates a synchronisation
problem you did not need to have.*

#### Smooth transition without a flash on load

Requirements that pull against each other: switching themes should animate, but the initial
load must not.

If you put `transition: background-color 280ms` on elements permanently, the initial paint
can animate from the browser default, which is the flash you were avoiding.

The fix is to make transitions exist only *during* a deliberate switch:

```css
:root[data-theme-transition] * { transition: background-color 280ms …; }
```

The toggle adds `data-theme-transition`, flips the theme, and removes the attribute 320ms
later. On first load the attribute is absent, so no transition can fire. It is also skipped
entirely when `prefers-reduced-motion: reduce` is set.

The `*` selector is normally a performance smell, but here it is scoped to a 320ms window
rather than being always-on, so there is no steady-state cost.

#### `color-scheme`

```css
:root[data-theme="dark"] { color-scheme: dark; }
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

| Requirement | Ratio |
|---|---|
| Body text, AA | **4.5:1** |
| Large text (≥18.66px bold or ≥24px), AA | 3:1 |
| UI component boundaries and focus indicators | 3:1 |
| Body text, AAA | 7:1 |

#### Why a light theme cannot be an inverted dark theme

This is the concrete example to remember. The dark theme's copper accent is `#F0803C`.

- On the dark background `#0B0E11`: **7.24:1** — comfortably AA.
- On the light background `#F6F4F1`: **2.43:1** — fails badly. Not even close.

The reason is that `#F0803C` is a *light* colour. It has high luminance. Against a dark
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

`pathLength` tells the renderer to *pretend* the path is that long. All dash arithmetic
then happens in those units. Setting it to `100` means dash values become **percentages**.

This is what lets one CSS keyframe drive the packet animation on every path in the app,
regardless of each path's real geometry:

```css
@keyframes packet-travel {
  from { stroke-dashoffset: 100; }
  to   { stroke-dashoffset: 0; }
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

| Requirement | Implementation |
|---|---|
| Announced as a dialog | `role="dialog"` |
| Content behind is inert | `aria-modal="true"` |
| Has an accessible name | `aria-labelledby` → the "Sections" heading |
| Trigger state is exposed | `aria-expanded` on the button |
| Escape closes it | `keydown` listener |
| Focus moves in | `requestAnimationFrame` then focus first link |
| Focus cannot escape | Tab/Shift-Tab wrap at the boundaries |
| Focus returns on close | `triggerRef.current?.focus()` |
| Background does not scroll | `body.style.overflow = "hidden"`, restored on close |

The `requestAnimationFrame` before focusing matters: the panel is animating in, and
focusing an element that is not yet laid out can fail or cause a scroll jump.

#### `:focus-visible` vs `:focus`

```css
:focus-visible { outline: 2px solid var(--copper); outline-offset: 2px; }
:focus:not(:focus-visible) { outline: none; }
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

| Metric | What it is | Measured |
|---|---|---|
| **FCP** | First Contentful Paint — first pixel of content | ~1.6–1.9s @4× |
| **LCP** | Largest Contentful Paint — main content visible | ~1.8–2.7s @4× |
| **CLS** | Cumulative Layout Shift — how much content jumps | **0.0000** |
| **Long Task** | Any main-thread task > 50ms; blocks input | 0 during scroll |
| Frame time | Time between rendered frames; 16.7ms = 60fps | median **17ms** |

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
were hoping for.** A result that confirms what you wanted deserves *more* scrutiny than one
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
main chunk *anyway*, and then the dynamic import adds a second 30 KB copy.

**Outcome:** reverted. The lesson is that bundle "optimisations" have to be measured; this
one was plausible, widely recommended, and wrong here.

### Rejected: making the trace bus a second accessible nav

Would have produced duplicate tab stops and double screen-reader announcements. Marked
decorative instead, with a guaranteed equivalent. See 2.7.

### Changed: trace bus moved from `lg` to `xl`

At 1024px the bus's hover labels overlapped the content. It needs the 240px gutter, so it
now appears at `xl` (1280px) and above. Found by looking at a screenshot, not by reasoning
about it.

### Changed: graph is *replaced* on mobile, not scaled

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
bundle 34 KB *larger*. And a profiling run that looked like a huge win turned out to be a
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
  tag.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
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
  {ABOUT.map((para) => <p key={para}>{para}</p>)}
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
page — and reading six rects at that moment costs nothing. The rule to remember: *an
IntersectionObserver is a cheap way to know **when** to measure; it is not always the right
thing to measure.*

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
const banned = ["passionate", "seamless", "cutting-edge", "revolutioniz",
                "leverage", "lorem ipsum", "coming soon", "dive into"];
check("no buzzwords or placeholder copy", banned.filter(w => body.includes(w)).length === 0);
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
- **Team note written.** The four names came from the *previous* image, which had since
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
  *larger* than the original (134 KB vs 58 KB), which is a good reminder that "lossless"
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
no relationship to the work (§1 item 11). It was also a *logo*, not evidence — it showed
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
baseline is always the window of points *preceding* the one under test.

**Sample, not population, standard deviation.** The `n-1` denominator (Bessel's
correction) is right here because the window is a sample of an ongoing process,
not the entire population. With n=30 the difference is about 1.7%, which is
enough to move a borderline point across a 2.5 threshold.

**Why recompute the whole window instead of updating incrementally.** There is a
well-known trick for maintaining a running variance by adding the new term and
subtracting the old one. It is faster and it is a trap: repeatedly adding and
subtracting floating-point terms accumulates error, and the running sum of
squares can drift *negative*, at which point `Math.sqrt` returns `NaN` and every
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
decoration. Here the numbers *are* the content, so freezing them would remove
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

`react-hooks/immutability` rejects this: *"Cannot reassign variable after render
completes."* Reassigning across a render pass assumes the list renders exactly
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
   disclosures are *collapsed by default* failed. Shared page state between
   assertions is the test-suite equivalent of a global variable.

The habit: when a test starts failing right after you add a different test,
suspect the new test before the code.

### 2026-09-22 — Stage 7: Live Signal and command palette

**Asked for:** one memorable feature demonstrating real logic tied to TradeWatch —
explicitly *not* a terminal boot sequence, since two of the three reference
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
