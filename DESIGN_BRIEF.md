# Design Brief — Personal Portfolio

**Status:** proposal, pre-build. Nothing is implemented yet.
**Date:** 2026-09-22

---

## 0. Stance

The goal is not "looks nice." The goal is that a senior engineer who has seen two hundred
portfolios this year cannot tell whether it was hand-built or generated, and comes away
with a specific impression of how you think.

Two governing rules everything below derives from:

1. **Every decorative element must do a job.** If a visual can be deleted without losing
   information, navigation, or state, it gets deleted. This is the single rule that
   separates a "cyber" portfolio from a starfield.
2. **Nothing ships that isn't true.** No placeholder, no rounded-up metric, no section
   scaffolded for content that doesn't exist. An honest three-item site beats a padded
   eight-item one.

---

## 1. Anti-patterns

### 1a. Your list (accepted as the floor)

| #   | Anti-pattern                                                                                   |
| --- | ---------------------------------------------------------------------------------------------- |
| 1   | Gradient text on your own name or the hero headline                                            |
| 2   | Radial "glow blob" behind the hero                                                             |
| 3   | Animated stat-counter cards with vague round numbers ("2+ Years", "10+ Projects")              |
| 4   | Floating pill-shaped icon dock as primary navigation                                           |
| 5   | Placeholder content live: "Coming Soon" cards, lorem ipsum, fake testimonials                  |
| 6   | Skill bars / percentage meters ("React 90%")                                                   |
| 7   | Uniform Framer-Motion fade-up applied identically to every element                             |
| 8   | Default Tailwind look: `rounded-2xl` + `shadow-lg` + Inter, no typographic point of view       |
| 9   | Buzzword copy: passionate, leverage, seamless, cutting-edge, revolutionize, journey, dive into |
| 10  | Low-contrast gray-on-gray text that fails WCAG                                                 |
| 11  | particles.js / tsparticles starfield with no relationship to the work                          |
| 12  | Emoji in headings or section titles                                                            |
| 13  | Desktop-only design that breaks on a real mobile viewport                                      |

### 1b. Additions from research

**Typography tells**

- Inter, Poppins, Space Grotesk, Instrument Serif, and Geist are the AI-default set. Inter
  in particular is the default in nearly every AI design tool and component library.
- Oversized italic serif for one accent word in an otherwise-sans page.
- All-caps letter-spaced "eyebrow" label sitting directly above an oversized H1.
- All-caps section labels everywhere as the only hierarchy device.

**Color tells**

- "VibeCode purple": the specific lavender-violet that leaks out of text-to-landing-page tools.
- Purple-to-blue gradient as background, CTA fill, or accent wash.
- Neon-on-dark (cyan/violet) with glowing card borders and an ambient accent glow.
- Large colored glows and colored `box-shadow`.
- Colored border on the top or left edge of a card. Cited as one of the single most
  reliable tells.

**Layout tells**

- Centered everything. Hero, headings, body, CTA, all on one axis, every section.
- "Cardocalypse": every block boxed, cards nested inside cards, six identical cards with
  the same fill and the same icon chip on top.
- Numbered `01 / 02 / 03` step sequences over content that is already sequential.
- Stat banner rows.
- Glassmorphism / frosted `backdrop-blur` panels.
- Untouched shadcn defaults; unmodified Lucide or Heroicons used at uniform size everywhere.
- Perfectly even rhythm: identical section padding, identical max-width, identical alignment,
  top to bottom.

**Copy tells**

- Em dash scattered through headlines, buttons, and captions. (Applies to site copy. This
  document is not site copy.)
- Writing about yourself in the third person.
- Numbers with no source; people with no face.
- "Let's build something amazing together" as the closing CTA.

### 1c. Additions from the developer-portfolio genre specifically

- Typewriter effect cycling job titles (`Full-Stack Developer | Problem Solver | ...`).
- Infinite marquee strip of technology logos.
- "My Tech Stack" listing thirty logos including HTML, CSS, and Git.
- Logo that is your initials in a rounded square.
- Custom cursor, cursor-following blob, `cursor: none`, or disabled text selection.
- Scroll-jacking or Locomotive/Lenis smooth-scroll that fights the native scrollbar.
- Spinning Three.js globe or floating 3D object unrelated to anything you built.
- Filler widgets: fake GitHub contribution graph, "currently listening to" embed.
- Blog section with zero posts, or one post called "Hello World".
- Project cards that link only to a repo, with no live demo and no write-up.
- Contact form that silently posts nowhere.
- Resume button that 404s or serves a stale PDF.
- `100vh` hero with nothing below the fold but a bouncing scroll chevron.
- Theme toggle that flashes white on load because theme resolution isn't in a blocking script.
- Entrance animations that replay every time an element re-enters the viewport.
- Default Next.js metadata ("Create Next App"), default favicon, no OG image.
- Unoptimized multi-megabyte hero image, no `next/image`.
- No `:focus-visible` styling; keyboard navigation invisible or trapped.
- Text over imagery with no contrast scrim.

### 1d. What reads as senior instead

The inverse of the list is not "minimal." It is **specific**.

- Projects lead with the problem and the constraint, not the stack.
- Numbers carry provenance: "cut p95 from 840ms to 210ms" beats "improved performance."
- At least one visible decision with a tradeoff and a reason you chose it.
- Real screenshots of real running software, not mockups in a floating browser chrome frame.
- Three projects with depth beat ten with none.
- Prose in your own voice, with an opinion in it.
- Restraint reads as confidence. Generous whitespace, one strong layout primitive repeated,
  strong type hierarchy, one accent color.

---

## 2. Visual direction — "instrumented, not decorated"

Dark-mode-first, minimalist, with a circuit/network language that is **load-bearing**.
The test for every element below: _what does it tell you that text alone wouldn't?_

### 2.1 The trace bus (navigation + scroll state)

A single hairline SVG trace runs down the left gutter on desktop, routed with 90° and 45°
elbows only, in the idiom of PCB routing. It terminates in a small square pad at each
section anchor.

- The pad for the section currently in view fills with the accent. Everything above it is
  drawn in accent at reduced opacity; everything below stays neutral.
- **Job:** it is the scroll-position indicator and the section nav. Click a pad to jump.
- On mobile the gutter collapses and the trace is dropped entirely, replaced by a plain
  sticky section label. It is not shrunk to fit.
- Geometry is authored by hand or generated once and committed. No runtime randomness.

### 2.2 The project graph (projects index)

Nodes are your projects. Edges connect projects that share a technology or a problem domain.

- **Job:** it is the projects navigation, and it makes the shape of your work legible at a
  glance in a way a vertical card list cannot. Hover or focus a stack label in the legend
  and non-matching nodes dim.
- Coordinates are **precomputed and committed as static data**. No force simulation, no
  physics loop, no per-load jitter. The graph looks identical on every visit, which is what
  makes it feel like a diagram rather than a screensaver.
- Full keyboard traversal: nodes are real links in a real list; the SVG is an enhancement
  layered over a semantic `<ul>`.
- Below `md`, the graph is replaced by the underlying list. Not scaled down, replaced.

### 2.3 Packet motion (the only continuous animation — see §2.7 for the two amended exceptions)

A single small dot traverses a trace segment on hover or focus of a link, once, ~500ms,
then stops. No ambient looping anywhere on the site.

Rationale: the network metaphor earns its place precisely because motion is _triggered by
your action_. It reads as signal, not as wallpaper.

### 2.4 Motion vocabulary

The uniform-fade-up problem is solved by giving each section a different, meaningful entrance:

| Region                | Entrance                                                               |
| --------------------- | ---------------------------------------------------------------------- |
| Hero                  | **None.** Present at first paint. No animation, no stagger.            |
| Section headings      | Mask-wipe along the trace direction, 240ms                             |
| Body prose            | Opacity only, 180ms, no translate                                      |
| Project graph         | Edges draw in via `stroke-dashoffset`, 400ms, once, on first view only |
| Metrics / mono values | Snap in with no transition                                             |

Rules: entrances fire **once**, never on scroll re-entry. Durations 150–400ms. Easing is a
single custom cubic-bezier token, not `ease-in-out` on everything.
`prefers-reduced-motion: reduce` disables all of it including packet motion, and the site
must be fully legible and navigable in that state.

### 2.5 Surface rules

- **No cards.** One layout primitive: the hairline-ruled row. Border-radius token capped at
  **4px**, applied only to genuinely inset elements.
- **No `box-shadow` in dark mode at all.** Elevation is communicated by background lightness
  only. No colored glows, ever, in either theme.
- No backdrop-blur, no glassmorphism.
- Alignment is left-aligned by default. Centering is reserved for exactly one moment on the
  page, so that it means something.
- Sections deliberately differ in max-width and vertical padding. Even rhythm is a tell.

### 2.6 Monospace contract

Monospace is reserved for **machine facts** and nothing else:

> dates, versions, commit SHAs, file paths, measured values with units, keyboard hints,
> status strings, and inline code.

Never headings. Never prose. Never a section label. This single rule does most of the work
of making the site feel technical rather than costumed, and it is mechanically checkable in
review.

### 2.7 Amendment (2026-09-23): deliberate ambient motion

Requested by the site owner after using the live site. This **overrides** the "no ambient
looping anywhere" line in §2.3, the "diagram rather than a screensaver" line in §2.2, the
"no coloured glows" line in §2.5 (for the graph's idle cue only), and the "Hero: no
animation" line in §2.4 (for the first-visit intro only), for exactly the elements below
and nowhere else. Packet motion on links stays hover/focus-only.

- **Project graph (3D).** Nodes gain a committed `z`. The object is still rigid and
  precomputed, with no physics or per-load jitter. What changes is the viewing angle: a
  slow ambient rotation (about 90s a turn, on a drifting axis) and trackball
  drag-to-rotate. Hand-rolled rotation matrix and perspective projection; no WebGL
  library. Reduced motion: fixed orientation, drag still available (user-initiated).
- **Graph idle cue.** While nobody is interacting, one node carries a soft copper glow,
  moving to a different node every 6s, as a hint that the graph responds. Any hover,
  focus, filter or drag stops it; it returns 2.5s after interaction ends. Reduced motion:
  no glow, a static text hint instead.
- **Circuit backdrop.** A faint (3.5–4.5% of silk) field of PCB traces behind the page,
  drifting one tile per four minutes, with a pair of copper pulses along a long trace
  every 7–9s. CSS only. Reduced motion: static field.
- **WireFish terminal.** Types the documented commands with labelled sample output, types
  `clear`, and loops while on screen. Reduced motion: one static transcript.
- **Catan hex board.** Redraws itself every ~4s while on screen. Reduced motion: static.
- **First-visit intro.** A few seconds of the Live Signal chart finding one anomaly, then
  the site. Once per browser session, skippable by any input, never under reduced motion,
  never without JavaScript, never on a deep link.

Guard rails that still apply: all of these stay below the trace bus in contrast, all are
`aria-hidden` and never the only route to content, everything off screen stops running,
and everything is static under `prefers-reduced-motion` except user-initiated dragging.

---

## 3. Type and color

### 3.1 Typefaces (two, exactly)

**Headings + UI: IBM Plex Sans**
**Code, labels, metrics: IBM Plex Mono**

Rationale: a single superfamily drawn by one team, with genuine engineering provenance, so
the sans and mono share skeleton and rhythm rather than merely coexisting. Neither is in the
AI-default set (Inter / Poppins / Space Grotesk / Instrument Serif / Geist). Both are on
Google Fonts, so `next/font/google` self-hosts them with zero layout shift and no
third-party request.

Tuning, so it doesn't read as stock Plex:

- Display sizes (≥40px): tracking `-0.02em`, weight 600, `line-height: 1.05`.
- Body: weight 400, `line-height: 1.6`, measure capped at **68ch**.
- Mono: weight 450 where available, tracking `0`, never all-caps, never letter-spaced.
- Weights loaded: 400/500/600 sans, 400/500 mono. Nothing else, to keep the font payload small.

**Alternate** if you want to avoid the IBM association: **Archivo** (headings/UI) +
**Commit Mono** (mono). More distinctive, slightly more setup since Commit Mono is
self-hosted from a file rather than fetched from Google Fonts.

### 3.2 Color

Derived from printed-circuit materials rather than picked for vibes: dark substrate, copper
trace, silkscreen text. That derivation is why it holds together, and why it avoids
neon-cyan-on-black.

**One accent. One status color. Everything else neutral.**

#### Palette (dark only)

| Token                | Hex       | Contrast on bg | Use                                                          |
| -------------------- | --------- | -------------- | ------------------------------------------------------------ |
| `bg`                 | `#0B0E11` | —              | Page. Not pure black: lets elevation read, avoids OLED smear |
| `surface`            | `#12161A` | —              | Raised regions                                               |
| `hairline`           | `#1E252B` | 1.25:1         | Decorative rules only                                        |
| `border-interactive` | `#5A646E` | 3.21:1         | Any border that is the _only_ boundary of a control          |
| `text-primary`       | `#E6EAEE` | **16.01:1**    | Headings, body. Not pure white                               |
| `text-secondary`     | `#9AA6B2` | **7.81:1**     | Supporting prose                                             |
| `text-tertiary`      | `#818E9B` | **5.78:1**     | Mono labels, captions                                        |
| `accent`             | `#F0803C` | **7.24:1**     | Copper. Links, active trace, focus ring                      |
| `signal`             | `#4FB6A8` | **7.92:1**     | Status only: live, passing, shipped                          |

All ratios above were computed against the WCAG 2.1 relative-luminance formula. Every text
token clears **4.5:1**, and the accent clears 4.5:1, so it is safe on body-size links and as
a `:focus-visible` ring (which needs only 3:1).

**Dark only (amended 2026-09-23).** The site originally shipped a separately-tuned light
palette, a toggle, and a blocking theme script with a `localStorage` override and a
`prefers-color-scheme` fallback. All of it was removed at the owner's request; the site is
dark only, and the code for switching was deleted rather than left unreachable.

### 3.3 Spacing and scale

4px base unit. Type scale `1.25` ratio, capped at six steps. Two container widths only:
`column` (50rem, about 95 characters of body text) and `wide` (1360px). Anything outside those is a deliberate exception and
gets a comment saying why.

---

## 4. Stack (confirmed, versions verified 2026-09-22)

| Layer     | Choice                                          | Latest stable |
| --------- | ----------------------------------------------- | ------------- |
| Framework | Next.js, App Router                             | **16.3.5**    |
| Language  | TypeScript, `strict: true`                      | **7.0.2**     |
| Styling   | Tailwind CSS                                    | **4.3.3**     |
| Animation | `motion` (Framer Motion's current package name) | **13.4.0**    |
| Host      | Vercel                                          | —             |
| Content   | Static, in-repo TypeScript modules. No CMS      | —             |
| Backend   | None                                            | —             |

Four notes where reality differs from the brief as written:

1. **Next.js is on 16.x, not 14.** Your "14+" is satisfied. App Router is the default and
   only recommended router now. No reason to pin backwards.
2. **Tailwind 4 is CSS-first.** There is no `tailwind.config.js`; the theme is declared with
   `@theme` inside CSS. The palette above becomes CSS custom properties directly, which
   suits a two-theme token system well. Worth knowing before we start.
3. **Framer Motion now publishes as `motion`.** Same library, same team, same API surface for
   our purposes; we import from `motion/react`. `framer-motion` still publishes in lockstep,
   but `motion` is the current name.
4. **Contact: `mailto:` with a copy-to-clipboard fallback. No form.** A form needs an email
   provider, an API key, spam handling, a success state, an error state, and a rate limit,
   and every one of those is a thing that can silently break and leave you looking like the
   "contact form that posts nowhere" anti-pattern. A `mailto:` link with a visible address
   and a copy button cannot break. Revisit only if real inbound volume shows up.

**Rendering:** static by default. Not `output: 'export'`. Staying on the standard Vercel
target costs nothing and keeps a Route Handler available if the contact decision is ever
revisited.

---

## 5. Definition of done

Testable gates, so "does it look vibe-coded" becomes a check rather than an opinion:

- [ ] Every anti-pattern in §1 verified absent by a manual pass.
- [ ] Axe reports zero violations; every text token's contrast verified against §3.2.
- [ ] Full keyboard traversal with a visible `:focus-visible` ring on every interactive element.
- [ ] Renders correctly at 360px width with no horizontal overflow, on a real device.
- [ ] `prefers-reduced-motion: reduce` yields a fully legible, fully navigable site.
- [ ] No theme flash on first paint in either theme.
- [ ] Lighthouse ≥95 across all four categories on mobile throttling.
- [ ] Zero placeholder strings. Zero "Coming Soon". Zero unsourced numbers.
- [ ] Custom favicon, per-page metadata, working OG image.
- [ ] Copy read aloud once, with every word from the §1 buzzword list removed.

---

## 6. Open, and blocking the build

The "no placeholder content" rule means content is the critical path, not a follow-up.
Before building starts I need:

1. **Your name**, and the one-line description of what you do that you'd actually say out loud.
2. **Two or three real projects.** For each: what problem, what constraint made it
   non-obvious, what you chose and what you traded away, one real number if one exists, and
   whether there is a live URL and a repo.
3. **Do you want an experience/work section**, or is this projects-only?
4. **Is there writing** to link to, now or soon? If not, the site has no blog section at all.
5. **Screenshots** of the real running software, or permission to capture them.

Items 2 and 5 are what make it look senior. Everything in §2 and §3 is packaging around them.

---

### Sources

- [AI Design Slop: 16 Patterns That Out Your App as Vibe-Coded — Developers Digest](https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it)
- [AI slop: 8 signs a website was generated by AI — TeneX Studio](https://tenex.studio/en/blog/ai-slop-ui-8-signes/)
- [AI Slop Web Design: Spotting and Fixing Generic Websites — 925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide)
- [What I learned after reviewing over 40 developer portfolios — DEV](https://dev.to/kethmars/what-i-learned-after-reviewing-over-40-developer-portfolios-9-tips-for-a-better-portfolio-4me7)
- [Developer Portfolio Checklist: 20 Things Hiring Managers Look For — DEV](https://dev.to/_d7eb1c1703182e3ce1782/developer-portfolio-checklist-20-things-hiring-managers-look-for-388p)
- [Software Engineer Portfolios: Well-Designed Examples — SiteBuilderReport](https://www.sitebuilderreport.com/inspiration/software-engineer-portfolios)
- Reference sites reviewed: [rauno.me](https://rauno.me), [brittanychiang.com](https://brittanychiang.com)
