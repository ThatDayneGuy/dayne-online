# dayne.online

Photography portfolio & journal for Dayne. Black-and-white, editorial, animation-driven.
Built with [Astro](https://astro.build) — pages are generated at build time from content
files, and the browser receives plain HTML/CSS/JS (no framework runtime).

This README is the operating manual. It is written for two readers: **Dayne**, updating
the site by hand, and **an AI assistant** (Claude or similar) picking up maintenance work.
Everything either of you needs is here or linked from here.

---

## The 60-second mental model

```
src/content/journal/*.md     ← WRITE HERE: one Markdown file per journal entry
src/content/work/*.yaml      ← one YAML file per photo series
src/pages/*.astro            ← page templates (pull from content, rarely change)
src/layouts/Base.astro       ← the shared shell: head, header, menu, footer, scripts
src/components/*.astro       ← Header, Footer, Pic (images), Related (cross-link card)
public/assets/css/main.css   ← THE design system (all styling, plain CSS)
public/assets/js/main.js     ← THE motion engine (all animation, plain JS)
public/                      ← everything else served verbatim (fonts, robots, _headers)
```

Adding content = adding a file in `src/content/`. The indexes, previews, filters,
cross-links and meta tags all regenerate themselves on build. You never edit a list
in two places.

URLs are stable and end in `.html` (`build.format: "file"` in `astro.config.mjs`):
`my-entry.md` → `https://dayne.online/journal/my-entry.html`. **Never rename a content
file casually — that changes its URL.**

## Running it

```bash
npm install      # once
npm run dev      # live-reload preview at http://localhost:4321
npm run build    # outputs the deployable site to dist/
```

No local setup? Edit Markdown directly on github.com — Cloudflare builds on merge to
`main`. You just won't see a preview first.

**Deployment:** Cloudflare (git-connected, auto-deploys `main`).
Build command `npm run build`, output directory `dist`. A build failure blocks the
deploy (the live site stays on the last good version) — the error log in Cloudflare
says which file is at fault, and it's almost always a typo in frontmatter.

---

## How to: add a journal entry

Create `src/content/journal/your-slug.md` (the filename becomes the URL):

```markdown
---
title: "On waiting"
category: "Field notes"        # filter chips group by this — reuse existing names
date: 2026-07-01
readMinutes: 4
description: "One sentence for search engines and link previews."
cover: "https://picsum.photos/seed/anything/2400/1030?grayscale"   # wide, ~21:9
preview: "https://picsum.photos/seed/anything/600/750?grayscale"   # portrait hover image
series: "threshold"            # optional: slug of a related work series
---

Plain paragraphs of writing. Blank line between paragraphs.

> A pull quote looks like this.

## A numbered section heading

More writing. For a full-width photograph, drop in this HTML block:

<figure class="full-bleed">
  <div class="frame">
    <img src="IMAGE_URL" alt="Describe the photo" loading="lazy" width="1400" height="1000" decoding="async">
  </div>
  <figcaption>Optional caption.</figcaption>
</figure>
```

That's the whole job. The journal index, homepage preview, category filter, reading
progress bar, cover hero and cross-link card all assemble themselves. Wrong or missing
frontmatter fails the build with a message naming the field.

## How to: add a work series

1. Copy any file in `src/content/work/` (e.g. `threshold.yaml`) to `your-slug.yaml`.
2. Fill in the fields — they're commented in `src/content.config.ts`. Notable ones:
   - `order` controls grid position; `featured: true` puts it on the home page
   - `images` is the editorial stack; each image picks a layout `slot`
     (`left`, `small-right`, `full`, `small-left`, `right` — cycle in that order)
   - `strip` is the horizontal film strip (mark portrait images `tall: true`)
   - `next` is the next series slug — **keep the chain circular** (A→B→C→A)
   - `journal` links a related journal entry by slug
3. Done. The work grid, home page, archive and next-series chain update themselves.

## How to: replace the placeholder images with real photographs

Everything currently uses grayscale picsum.photos placeholders. When real photographs
are ready:

1. Put originals in `src/assets/photos/` (full resolution, ~2400px+ on the long edge).
2. Switch `src/components/Pic.astro` to use Astro's `<Image>` from `astro:assets`
   (it generates all responsive sizes at build time), then delete `src/lib/images.ts`.
3. Update `cover`/`preview`/`src` fields in content files to local paths.
4. The CSS forces `filter: grayscale(1)` on every framed image — remove that line in
   `main.css` (search `grayscale`) if your own toning should come through.

This is a one-time job an AI assistant can do in a single pass — point it at this section.

## The placeholder text ("test text")

All visible copy is deliberately `test text` — Dayne writes the real words. Two paths:
- Write directly into the content files and page templates, or
- The original AI-drafted copy still exists in git history: commit `65d834d`
  ("Replace editorial copy with placeholder test text") — revert or cherry-pick it
  for a starting point. Note it predates the Astro migration, so treat it as source
  material to paste into content files, not a clean revert.

Pages with hard-coded placeholder copy to write: `index.astro` (hero meta, statement,
marquee words), `about.astro` (statement, bios, services list), `Footer.astro` (CTA),
plus `sub`/intro lines on `work.astro` and `journal.astro`.

---

## Design system & motion (for anyone changing the look)

Identity: monochrome, warm off-white `#f5f4f1` / near-black `#0c0c0c`, film-grain
overlay, **Archivo** (display/body) + **Instrument Serif italic** (accents) +
**Fragment Mono** (all metadata, like film-rebate markings). One accent color
(`--accent`) whose only job is the availability dot. Fonts are self-hosted WOFF2
in `public/assets/fonts/`.

The motion language ("the darkroom"):
- **First visit**: darkroom-timer loading dial (once per session, `sessionStorage`)
- **Page transitions**: a liquid-glass pane (`backdrop-filter`) sweeps vertically;
  the swap happens behind the frost. Chromium prerenders pages on hover
  (Speculation Rules) so navigation is seamless; other browsers hover-prefetch
- **Images**: "develop" reveals (exposure settles in), parallax drift, auto frame
  numbers (`FR 01`) via CSS counters
- **Series pages**: pinned horizontal film strip on desktop, native swipe on mobile
- **Extras**: scroll-velocity softening, idle screensaver (home), background toggle
  (◐ in header), per-visit shuffle of featured work, work-grid view toggle,
  journal hover previews, custom cursor

Everything degrades: no JS → fully readable static page; `prefers-reduced-motion`
→ animations off (live, via `gsap.matchMedia`). Keep it that way.

Rules that prevent known bugs (learned the hard way — don't relearn them):
1. **Never put `filter` or `transform` on an ancestor of pinned/fixed content**
   (it re-anchors `position: fixed` and blanks the screen). The scroll-velocity blur
   lives on images via `--vblur` for exactly this reason.
2. **No CSS `transition` on transforms that GSAP scrubs** (parallax images opt out
   of the hover-zoom transition).
3. CSS/JS are served `Cache-Control: no-cache` (see `public/_headers`) because they
   have no hashed filenames — don't "optimize" this back to long caching or HTML
   and JS can deploy mismatched.
4. GSAP + plugins load from CDN (`Base.astro`); all code guards for their absence.

## For AI assistants: working on this repo

- Read this file first; `src/content.config.ts` defines the content contracts.
- Content tasks (new entries, series, copy edits) → touch only `src/content/` and
  the placeholder copy in `src/pages/` / `src/components/`.
- Design/motion tasks → `public/assets/css/main.css` and `public/assets/js/main.js`
  are the whole system; templates only carry structure and `data-*` hooks
  (`data-reveal`, `data-reveal-img`, `data-parallax`, `data-split-words`,
  `data-cursor`, `data-vt`, `data-shuffle`, `data-filter`, `data-archive`).
- Always run `npm run build` before committing — it validates content schemas and
  catches broken templates. There are no other tests.
- Preserve URLs. If a slug must change, add a redirect in `public/_headers`
  (Cloudflare `_redirects` syntax also works in a `public/_redirects` file).
- Don't add frameworks, hydrated components, or analytics without being asked.
- History context: the design follows a 75-site research study
  (`docs/IMPROVEMENT-PLAN.md`); the pre-Astro static implementation is in git
  history before the "Migrate to Astro" commit.
