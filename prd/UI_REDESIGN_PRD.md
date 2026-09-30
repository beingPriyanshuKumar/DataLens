# DataLens: Frontend Redesign PRD

**Scope:** replace the current glassmorphism dark UI with an editorial, grid-based light UI derived from the supplied reference (the "Devlab" landing page).
**Stack constraint:** keep React 18 + Vite + TypeScript (strict) + TanStack Query. Keep **vanilla CSS**. Do not migrate to Tailwind now; it would burn a day for zero visible gain.
**Deadline:** online round **3 Oct 2026**. Target finish for this work: **1 Oct**.
**Backend changes:** one small endpoint (section 12). Everything else is frontend-only.

---

## 1. Goal

Make DataLens look like a confident, designed product instead of a default dark-mode dashboard, and make the anti-hallucination story visible at a glance. Judges see the UI for 3 minutes. The UI must communicate three things without explanation:

1. Plain English goes in, structured data comes out.
2. Every record is provable (source quote and link).
3. The system is controlled and ethical (blocked sources, dropped records are shown, not hidden).

Non-goal: a marketing website. This is a working tool with a landing-style first screen.

---

## 2. Reference analysis

### 2.1 What to take (style, not assets)

| Reference trait | What it is | How DataLens uses it |
|---|---|---|
| Outer page background | Muted grey-green, approx `#B9C4C1` | App backdrop around the main frame |
| White frame | One large white surface | The whole app lives inside it |
| Hairline grid | 1px black lines dividing header / hero / stats, and left / right panels | The core layout device on every page |
| Header row | Mono logo left, uppercase letter-spaced nav, black pill button right | Same structure, DataLens content |
| Hero split | ~60% text, ~40% abstract art | Home hero: headline + prompt box left, illustration right |
| Headline | Large geometric grotesque, tight leading, 3 lines, with an outline sparkle icon | Same treatment |
| Buttons | Black pill, small bold uppercase text; secondary is a circular thumb plus uppercase label | Same |
| Small note | Red asterisk plus short grey line | Trust statement under the CTA |
| Bottom stats strip | 4 cells split by hairlines: big number, small label | Reused for the live funnel and platform stats |
| Illustration | Black rounded squares joined by lines, red triangle, blue pill with white hole, black cursor arrow, pale-blue gear shapes, stipple grain | Custom original SVG in the same visual language |
| Palette | Black, white, red-orange, steel blue, pale blue | Exactly this, nothing else |

### 2.2 What NOT to take

- **No images or shapes traced from the reference.** Draw an original illustration (section 8). It is someone else's design.
- **No brand names or logos.** No "Devlab", no Airbnb/Asana/eBay marks, no stock avatars.
- **No invented statistics.** The reference shows "34k+ students". You will not display any number you did not measure. Stats come from the database (section 12). If the endpoint is not built, the stats strip shows policy badges only.
- **No copied copy.** Write your own text.

---

## 3. Design principles

1. **The grid is the design.** Structure comes from 1px lines and whitespace, not shadows, blurs, or gradients.
2. **Three colors do the work.** Black for structure and primary actions, red for attention (warnings, dropped records, focus), blue for "in progress / selected".
3. **Type carries hierarchy.** One display face, one body face, one mono face. No decorative fonts beyond that.
4. **Flat and square.** Zero border radius on cells, tables, and drawers. Only buttons and status pills are fully rounded.
5. **Show the machinery.** Dropped, blocked, and flagged items are first-class UI, not footnotes.
6. **Every screen has loading, empty, and error states.**

---

## 4. Design tokens

Define once in `styles/tokens.css` as CSS custom properties. Nothing else in the codebase may contain a raw hex value.

### 4.1 Color

| Token | Value | Use |
|---|---|---|
| `--color-backdrop` | `#B9C4C1` | Page background outside the frame |
| `--color-surface` | `#FFFFFF` | All panels and cells |
| `--color-ink` | `#0B0B0B` | Text, borders, primary buttons |
| `--color-ink-muted` | `#5C5C5C` | Secondary text, labels |
| `--color-line` | `#0B0B0B` | Structural hairlines |
| `--color-line-soft` | `rgba(11, 11, 11, 0.15)` | Table row dividers |
| `--color-red` | `#EF3E32` | Accent, warnings, errors, focus ring |
| `--color-blue` | `#5B97B4` | Running state, selection |
| `--color-blue-pale` | `#D0E1E9` | Highlight cells, hover, badges |
| `--color-hover` | `#EEF3F5` | Row and cell hover |

Colors above are approximated from the screenshot. Confirm with a color picker on the reference and adjust once, in the tokens file only.

**Contrast rule:** body text is always `--color-ink` on `--color-surface`. `--color-ink-muted` is for text 14px and above only. White text only on `--color-ink` or `--color-red` backgrounds.

### 4.2 Typography

| Role | Font | Fallback | Weight |
|---|---|---|---|
| Display / headings | **Space Grotesk** (closest free match to the reference face) | system sans-serif | 500 to 600 |
| Body / UI | **Inter** | system sans-serif | 400, 500, 600 |
| Mono (logo, labels, log, numbers in tables) | **IBM Plex Mono** | ui-monospace | 400, 500 |

**Self-host all fonts** with `@fontsource` packages (`@fontsource-variable/space-grotesk`, `@fontsource-variable/inter`, `@fontsource/ibm-plex-mono` with only weights 400 and 500). The offline round on 11 Oct may have poor or no internet. No Google Fonts links.

| Style | Size / line-height | Notes |
|---|---|---|
| `display` | `clamp(48px, 6vw, 80px)` / 0.95 | Hero headline only, letter-spacing -0.02em |
| `h1` | 40px / 1.1 | Page titles (task title) |
| `h2` | 24px / 1.2 | Panel titles |
| `stat` | 40px / 1 | Numbers in stat cells, mono or display face |
| `body` | 16px / 1.5 | Default |
| `small` | 14px / 1.5 | Table cells, helper text |
| `label` | 12px / 1.2, uppercase, letter-spacing 0.08em, weight 600 | Nav, tabs, table headers, buttons, stat labels |

### 4.3 Spacing, borders, radius, motion

- Spacing scale (8px base): `--space-1: 4px`, `--space-2: 8px`, `--space-3: 16px`, `--space-4: 24px`, `--space-5: 32px`, `--space-6: 48px`, `--space-7: 64px`.
- Cell padding: `--space-4` (24px) vertical and horizontal on desktop, `--space-3` on mobile.
- Border: `--border: 1px solid var(--color-line)`. Soft: `--border-soft: 1px solid var(--color-line-soft)`.
- Radius: `--radius-pill: 999px` only. Everything else 0.
- Shadows: none. Gradients: none. `backdrop-filter`: none.
- Motion: `--motion-fast: 120ms ease`. Only hover and state transitions. Wrap any non-essential animation in `@media (prefers-reduced-motion: no-preference)`.

---

## 5. Layout system

### 5.1 App frame

```
┌─────────────────────────────────────────────────────────────┐  ← backdrop (--color-backdrop), 24px padding
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ HEADER  logo · nav · NEW TASK ↗                         │ │  ← row 1, bottom hairline
│ ├─────────────────────────────────────────────────────────┤ │
│ │ PAGE CONTENT (rows separated by hairlines)              │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- Frame: `max-width: 1440px`, centered, `background: var(--color-surface)`, 1px ink border.
- Every major section is a **row**; rows are separated by a 1px hairline. Rows may be split into **cells** by vertical hairlines.
- Use CSS Grid for rows and cells. Cell borders are drawn once (use `border-right` on all but the last cell, `border-bottom` on rows); no doubled lines.
- Mobile (<720px): backdrop padding drops to 0, frame border removed.

### 5.2 Header

- Left: logo `// DataLens` in mono 500, 18px.
- Center-right: nav links as `label` style: `TASKS`, `HOW IT WORKS`, `POLICY`. These are in-page anchors on Home (no new routes). On the task detail page they link back to Home sections.
- Right: primary pill button `NEW TASK ↗` (scrolls to and focuses the prompt box).
- Height 64px, bottom hairline.
- Mobile: nav collapses; only logo and `NEW TASK` remain.

---

## 6. Component specification

Refactor existing components in place. **Do not create a second copy** of a component that exists. Map the names below to the current file names.

### 6.1 Button

| Variant | Look | Use |
|---|---|---|
| `primary` | Black pill, white `label` text, padding 14px 24px, trailing `↗` | Preview Plan, Run Task, New Task |
| `secondary` | Transparent pill with 1px ink border, ink text | Re-run, Export |
| `ghost` | `label` text with trailing arrow, no border | View past runs, Close |
| `danger` | Pill with 1px red border and red text; fills red with white text on hover | Cancel run, Delete task |
| `circle` | 44px circle, ink fill, white icon | Secondary hero action (scroll to past runs) |

States: hover on `primary` inverts to white fill with ink border (`--motion-fast`); arrow shifts 2px right. Disabled: 40% opacity, `cursor: not-allowed`. Focus-visible: 2px red outline, 2px offset, on every interactive element (defined once in `base.css`).

### 6.2 Status pill

Fully rounded, `label` style, 6px 12px padding.

| Status | Style |
|---|---|
| `queued` | 1px muted border, muted text |
| `running` | Pale-blue fill, blue dot that pulses (reduced-motion: static) |
| `completed` | Ink fill, white text |
| `failed` | Red fill, white text |
| `cancelling` | Pale-blue fill, text "CANCELLING…" |
| `cancelled` | 1px ink border, ink text |

### 6.3 Stat strip

A row of equal cells split by hairlines.

- Cell: number (`stat` style) above a `label`-style caption, 24px padding.
- Variants: `highlight` (pale-blue background) and `alert` (number in red, caption prefixed by a red `*`).
- Desktop: 4 or 5 cells in a single row. Tablet: 2 columns. Mobile: 2 columns.
- Used for: platform stats (Home), funnel (Task > Progress), and policy badges.

### 6.4 Tabs

- Row of `label`-style buttons on a hairline baseline. Active tab: 3px ink underline overlapping the baseline. Inactive: muted.
- `role="tablist"`, `role="tab"`, `aria-selected`, arrow-key navigation.

### 6.5 Data table

- Header cells: `label` style, ink bottom border, sticky at top of the scroll container.
- Body cells: `small` style, `--border-soft` row separators, row hover `--color-hover`, whole row clickable (opens drawer) with `tabindex="0"` and Enter to activate.
- Numeric and confidence cells use the mono face.
- Horizontal overflow: the table sits in a container with `overflow-x: auto`; the page body never scrolls sideways.
- Sorting: header click toggles asc / desc, shows `↑` / `↓`.

### 6.6 Confidence indicator

Mono value (`0.82`) plus a 48px x 4px bar: track `--color-line-soft`, fill ink. Below 0.5, fill red. Never color alone: the number is always visible.

### 6.7 Drawer (record detail)

- Slides in from the right, 480px wide (full width on mobile), 1px ink left border, white background, page overlay `rgba(11, 11, 11, 0.25)`.
- Header: record title (first key field), `CLOSE ✕` ghost button. Escape closes. Focus is trapped while open and returns to the originating row on close.
- Sections, each separated by a hairline:
  1. **Fields**: definition list, label on top (`label` style), value below (body).
  2. **Confidence**: value, bar, and flags list (each flag with a red `*`).
  3. **Evidence**: one block per evidence row: quote in body text with a 2px red left rule, then the domain in mono and a full URL link (`target="_blank"`, `rel="noopener noreferrer"`).

### 6.8 Event log

- White surface, 1px ink border, mono 13px, max-height 360px, scrollable, auto-scrolls to newest unless the user has scrolled up.
- Row: muted timestamp, `label`-style level tag (`INFO` ink, `WARN` and `ERROR` red), message.
- Connection state shown above the log: `● LIVE` (blue) or `○ RECONNECTING` (red).

### 6.9 Empty / loading / error states

Centered in the cell, with the sparkle icon (`✦` SVG component):

- **Loading:** sparkle plus mono text `LOADING…`.
- **Empty:** sparkle plus one sentence and one action (e.g. "No tasks yet. Describe the data you need above.").
- **Error:** red sparkle plus the error message plus a `Retry` secondary button.

### 6.10 Sparkle icon

Four-point star, outline only, 2px stroke, ink. Sizes: 48px in hero, 24px in states. One small SVG component.

---

## 7. Page specifications

### 7.1 Home (`/`)

**Row 1: Header** (section 5.2).

**Row 2: Hero**, split into two cells (60 / 40) by a vertical hairline. Minimum height 560px on desktop.

*Left cell (padding 48px):*
- Sparkle icon (48px) left of the headline, vertically aligned to the first line.
- Headline (`display`), 3 lines:
  > Turn a sentence
  > into a verified
  > dataset.
- Sub-copy (body, muted, max-width 520px):
  > Describe the data you need. DataLens plans the collection, gathers it from permitted public sources, and proves every record with a quote from the page.
- **Prompt box:** 1px ink border rectangle, textarea (min 3 rows, `body` size, no resize handle), placeholder "Find remote machine learning engineer openings posted in the last 2 weeks". Character count in `label` style bottom-right. Below it, left to right: primary pill `PREVIEW PLAN ↗`, and a circle button with a down-arrow plus the label `VIEW PAST RUNS` (scrolls to the task list).
- **Example prompts:** 3 outlined pill chips beneath, `small` size. Click fills the textarea. (Reuse the current three examples.)
- **Note:** red `*` followed by muted `small` text: "Records that can't be traced to a source quote are dropped, never guessed."

*Right cell:* `HeroArt` illustration (section 8), `aria-hidden`, fills the cell, no padding, clipped to the cell.

**Row 3: Stat strip (platform stats).** 4 cells with real numbers from `GET /api/stats`:
1. `Records verified`
2. `Sources checked`
3. `Tasks run`
4. `Unsupported records blocked` (the `alert` variant, red number)

If a value is 0, show `0`. Do not hide the strip on a fresh install. Do not fabricate numbers.

**Row 4: How it works** (id `how-it-works`, P1). 5 equal cells, each: mono step number `01`, `label` title, one short `small` sentence:
`01 UNDERSTAND` (prompt becomes a schema), `02 COLLECT` (search and fetch permitted pages), `03 VERIFY` (quote must appear on the page), `04 CLEAN` (normalize and deduplicate), `05 EXPORT` (CSV, JSON, XLSX).

**Row 5: Source policy** (id `policy`). One row, 4 cells with `✓` badges: `robots.txt respected`, `No login-walled sites`, `Private networks blocked`, `Rate limited per domain`. Text only, mono.

**Row 6: Tasks** (id `tasks`). Section title `h2` "Your tasks" left, count right. Table columns: `TASK`, `STATUS`, `RECORDS`, `LAST RUN`, and an actions cell (`OPEN ↗` ghost, `RE-RUN` secondary, `DELETE` danger). Row click opens the task. Empty and loading states per 6.9. Delete requires a confirm step (inline "Confirm delete?" swap of the button, no modal library).

**Plan review panel** (appears after Preview, replaces the Row 6 position or opens directly under the hero; pick one and keep it):
- 3 cells: `SCHEMA` (fields table: name, type, required), `PLAN` (numbered steps and search queries in mono), `ASSUMPTIONS AND FILTERS` (list, each with a red `*`).
- If `clarification` is set: show it in a red-bordered cell and disable `RUN TASK`.
- Actions: primary `RUN TASK ↗`, ghost `EDIT PROMPT`.
- Loading state while previewing: sparkle plus `PLANNING…`. Button disabled during the request.

### 7.2 Task detail (`/tasks/:id`)

**Row 1: Header.**
**Row 2: Title row.** `h1` task title left. Right: status pill and the relevant action (`CANCEL RUN` danger while running or queued; `RE-RUN` secondary otherwise). Under the title: muted `small` line with the original prompt (clamped to 2 lines, expandable).
**Row 3: Tabs** (`PROGRESS`, `RESULTS`, `SOURCES`, `HISTORY`). Selected tab stored in the URL (`?tab=results`) so refresh and links work.

**Progress tab**
- Stat strip (funnel), 5 cells: `Raw` → `Verified` → `Valid` → `Deduped` (highlight variant) and `Blocked as unsupported` (alert variant). While running, numbers update live.
- 4px progress bar row under the strip (ink fill on soft track).
- Event log (6.8), full width.
- If `cancelling`: show "Cancelling after the current page finishes…". Cancellation is cooperative, not instant; the UI must not imply otherwise.
- If `failed`: red cell with the error text.

**Results tab**
- Toolbar row: search input (square, hairline border, `label` placeholder style), confidence slider labeled `MIN CONFIDENCE`, export menu (`EXPORT ↓` secondary pill opening three items: CSV, JSON, XLSX), record count.
- Table (6.5). Columns are generated from `spec.fields` plus `CONFIDENCE`. Long text truncates with ellipsis and full value in `title`.
- Server-side pagination footer: `PREV` / `NEXT` ghost buttons and `PAGE 2 OF 7` in `label` style.
- Row click opens the drawer (6.7).
- Empty state (run finished with 0 records): explain the likely reasons (filters too strict, sources blocked) and link to the Sources tab.

**Sources tab**
- Toolbar: status filter (`ALL`, `FETCHED`, `BLOCKED`, `FAILED`) as tab-like buttons.
- Table: `DOMAIN`, `URL` (truncated, opens in new tab), `STATUS` (pill: fetched = ink, blocked = red outline, failed = red fill), `HTTP`, `REASON`, `RECORDS`.

**History tab**
- Table: `RUN`, `STARTED`, `DURATION`, `STATUS`, `RAW → DEDUPED` (mono, e.g. `120 → 63`), and an `OPEN` ghost action that switches the Results tab to that run.
- `RE-RUN` primary pill above the table.
- Run compare view (new / removed / changed) is **out of scope** here unless the backend diff endpoint exists.

---

## 8. Illustration spec (`HeroArt`)

An original, static, decorative SVG in the reference's language. Target: **under 90 lines, under 4 KB**, one file, no external assets, `aria-hidden="true"`, `preserveAspectRatio="xMidYMid slice"`, `viewBox="0 0 560 640"`.

Composition (pipeline metaphor):

| Element | Shape | Color | Meaning |
|---|---|---|---|
| Node graph | 4 rounded squares (56 x 56, `rx` 14, rotated about 20 to 30 deg) at the corners of a tilted quadrilateral, joined by 1.5px ink lines; one thin ink arc crossing behind | Ink | Pipeline stages |
| Filter | Triangle pointing down, upper middle, with stipple texture | Red | Filtering and verification |
| Toggle | Large pill (approx. 320 x 120, `rx` 60), rotated about 18 deg, white circle (r 44) cut into its right end | Blue with white circle | "Verified" switch |
| Cursor | Solid triangle with a thick stem, bottom right, pointing up-left | Ink | The user's prompt |
| Backdrop shapes | Large soft blob bottom-left; one scalloped circle (a circle with a thick dashed stroke, giving gear teeth) top-right; two small ones bottom-right | Red blob, `--color-blue-pale` gears | Depth |
| Grain | `<pattern>` of tiny dots (1px, 25% opacity) applied over the triangle and the pill | White or ink dots | Stipple texture from the reference |

Rules: use CSS variables for fills (`fill="var(--color-red)"`), no gradients, no filters, no animation (P2: nodes pulse while a run is active). Do not trace the reference. Hand-author simple primitives.

---

## 9. Responsive behavior

| Breakpoint | Change |
|---|---|
| ≥ 1024px | As designed |
| 720 to 1023px | Hero stacks: text cell first, illustration cell below at 320px height. Stat strips become 2 columns. Nav links hidden behind the `NEW TASK` button only |
| < 720px | Backdrop padding 0, frame border removed. Headline `clamp` floor 44px. Tables scroll horizontally. Drawer full width. Tabs scroll horizontally |

Test widths: 1440, 1024, 768, 390.

---

## 10. Accessibility requirements

- Every interactive element keyboard reachable; visible focus ring (red, 2px).
- Tabs, drawer, and tables use correct roles and ARIA attributes (section 6).
- Drawer traps focus and closes on Escape.
- Run progress announced via `aria-live="polite"` on the funnel strip (throttled to once per 2 seconds).
- Status is never conveyed by color alone (text label always present).
- Illustration is `aria-hidden`; all icon-only buttons have `aria-label`.
- `prefers-reduced-motion` respected.
- Lighthouse accessibility score ≥ 90 on Home and Task detail.

---

## 11. Implementation plan

### 11.1 File and CSS strategy

```
frontend/src/
├── styles/
│   ├── tokens.css        # all custom properties (colors, type, spacing)
│   ├── base.css          # reset, body, typography classes, focus ring
│   └── layout.css        # frame, row, cell, responsive rules
├── components/
│   ├── Header.tsx
│   ├── Button.tsx
│   ├── StatusPill.tsx
│   ├── StatStrip.tsx
│   ├── Tabs.tsx
│   ├── DataTable.tsx
│   ├── ConfidenceBar.tsx
│   ├── Drawer.tsx
│   ├── EventLog.tsx
│   ├── SparkleIcon.tsx
│   ├── HeroArt.tsx
│   └── StateBlock.tsx    # loading, empty, error
└── pages/
    ├── Home.tsx
    └── TaskDetail.tsx
```

- Each component has one co-located CSS file (`Button.css`) imported by the component. Class names are prefixed by component (`button--primary`, `stat-strip__cell`).
- No inline `style` except for dynamic values (progress width), and those use a CSS variable (`style={{ "--progress": "42%" }}`).
- If a component named above already exists, edit it. Do not duplicate.

### 11.2 Build order

| Step | Work | Done when |
|---|---|---|
| 0 | Screenshot the current UI (before). Inventory existing CSS and components | Screenshots saved |
| 1 | Install fontsource packages; write `tokens.css`, `base.css`, `layout.css` | Blank frame with backdrop, correct fonts and focus ring |
| 2 | `Header`, `Button`, `SparkleIcon`, `StatusPill` | All variants visible on a temporary sandbox route (delete the route afterward) |
| 3 | Home hero, `HeroArt`, prompt box, example chips | Hero matches section 7.1 at 1440 and 390 |
| 4 | `StatStrip`, `/api/stats` wiring, How it works, Policy rows | Real numbers displayed |
| 5 | Task list table, Plan review panel | Full prompt → preview → run flow works in the new UI |
| 6 | Task detail: title row, tabs, Progress tab (strip, bar, log) | Live run displays correctly, cancel state correct |
| 7 | Results tab: toolbar, `DataTable`, pagination, `Drawer` | Filter, sort, open evidence, export |
| 8 | Sources and History tabs | Filters and re-run work |
| 9 | Loading / empty / error states everywhere | Each state reachable and checked manually |
| 10 | Responsive pass, accessibility pass, delete old CSS, lint | Section 14 checklist all green |
| 11 | Capture final screenshots for the submission | Saved |

Estimated effort: 1.5 to 2 working days for one person.

### 11.3 Delete list (the old UI must leave no residue)

- Every purple / indigo gradient, `backdrop-filter`, `box-shadow` glow, and glass card style.
- Old dark theme variables and any dark-mode toggle code.
- Unused CSS files, classes, images, and font imports.
- Old components replaced by the new ones.

Verification: `grep -rE "backdrop-filter|linear-gradient|radial-gradient|box-shadow" frontend/src` returns nothing (except the intentional pill hover if you choose a shadow, which you should not).

---

## 12. Backend change required

**`GET /api/stats`** returns:
```json
{
  "tasks": 12,
  "runs": 31,
  "records_verified": 1840,
  "sources_checked": 966,
  "unsupported_records_blocked": 214
}
```
- `tasks` and `runs`: row counts.
- `records_verified`: count of `records` rows.
- `sources_checked`: count of `sources` rows.
- `unsupported_records_blocked`: sum of the hallucination counter stored in each run's `stats` JSON. Use the exact key the runner already writes; do not add a new column.
- Aggregate in one query per table. No caching.
- Add one test for it.

Also confirm the runs API already returns the hallucination count, `raw`, `verified`, `valid`, and `deduped` counters for the funnel strip. If any is missing, add it to the run response; do not compute it in the frontend.

---

## 13. Clean-code rules for this work

These are the same rules as the project plan, applied to UI work.

- No dead CSS: every class in a stylesheet is used in a component.
- No raw hex, `px` font sizes, or magic spacing values outside `tokens.css` (use tokens; layout-specific one-off dimensions such as the 480px drawer width are named constants at the top of the component's CSS).
- No `any`, no `@ts-ignore`, no `console.log`, no commented-out code.
- One component per file, under ~150 lines. Extract when longer.
- No new dependency except the three fontsource packages. No UI library, no CSS framework, no animation library.
- Server data only through TanStack Query; no manual `useEffect` fetching.
- Presentational components take props and render. Data fetching stays in pages or hooks.
- Delete the sandbox route and any placeholder text after step 2.
- `tsc --noEmit` and ESLint pass with zero warnings before every commit.

---

## 14. Acceptance checklist

**Visual**
- [ ] Home, Task detail (all four tabs), Plan review, and Drawer match this document at 1440px
- [ ] No gradients, shadows, blur, or purple anywhere
- [ ] Only tokenized colors and fonts are used (grep for `#` in CSS outside `tokens.css` returns nothing)
- [ ] Hairlines are exactly 1px with no doubled borders at cell joins

**Functional**
- [ ] Prompt → Preview → Run → live progress → Results → Evidence → Export works end to end in the new UI
- [ ] Cancel shows the "cancelling" state, then "cancelled"
- [ ] Sorting, search, confidence filter, pagination work
- [ ] Every list has working loading, empty, and error states
- [ ] Tab selection survives a page refresh
- [ ] Stats strip shows real numbers and 0 on a fresh database

**Quality**
- [ ] Works at 1440, 1024, 768, 390 with no horizontal page scroll
- [ ] Keyboard-only run-through of the full flow succeeds
- [ ] Lighthouse accessibility ≥ 90 on Home and Task detail
- [ ] Fonts load with the network disabled
- [ ] `tsc --noEmit`, ESLint, and the delete-list grep are clean
- [ ] Before and after screenshots saved

---

## 15. Priorities

| Priority | Items |
|---|---|
| **P0** | Tokens, frame, header, buttons, Home hero and prompt flow, task list, Task detail Progress and Results tabs, drawer with evidence, states, self-hosted fonts |
| **P1** | `HeroArt` full detail, stats strip with `/api/stats`, How it works row, Policy row, Sources and History tabs, responsive polish |
| **P2** | Illustration animation while a run is active, log pause-on-scroll, dark variant (do not build it) |

If time runs short, cut P1 from the bottom up. A clean P0 in the new style beats a half-finished P1.

---

## 16. Out of scope

Dark mode, authentication screens, a marketing site, a settings page, run comparison UI (until the backend diff exists), internationalization, and any animation library.
