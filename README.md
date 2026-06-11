# dayne.online

Photography portfolio & journal. A static site — no build step, no framework. Open `index.html` or serve the folder and it works.

## Structure

```
index.html              Home — hero, statement, selected work (shuffles per visit), journal preview
work.html               Portfolio index — editorial grid <-> contact-sheet toggle
work/*.html             Series pages — cover, pinned horizontal film strip, frames, journal cross-link
archive.html            Infinite drag canvas of every frame (plain grid without JS)
journal.html            Journal index — category filter, hover previews
journal/*.html          Entries — full-bleed cover, breakout figures, progress, series cross-link
about.html              Bio, services, contact
assets/css/main.css     The entire design system
assets/css/fonts.css    Self-hosted font faces
assets/fonts/           WOFF2 files (latin subsets, ~120KB total)
assets/js/main.js       The entire motion engine
```

## Tech

- **GSAP 3.13 + ScrollTrigger + SplitText + Flip** — all free since 2025, loaded from CDN; the code falls back to manual splitting / instant toggles if a plugin fails to load
- **Lenis** — smooth scrolling (CDN)
- **View Transitions API** — cross-document image morphs (progressive; frame-advance overlay is the fallback)
- **Archivo + Instrument Serif + Fragment Mono** — self-hosted WOFF2, two faces preloaded

Everything degrades gracefully: with JavaScript disabled (or a CDN blocked) the site is a plain, fully readable static page.

## Replacing the placeholder images

All images are currently grayscale placeholders from `picsum.photos`. To use real photographs, drop files into an `images/` folder and replace the `src` URLs. The CSS applies `filter: grayscale(1)` to every image inside a `.frame` — remove that rule in `main.css` (search for `grayscale`) if you want your own toning to come through untouched.

Recommended sizes: ~2400px wide for full-bleed/cover images, ~1600px for grid images. Keep the `alt` text meaningful.

Every image carries explicit `width`/`height` (prevents layout shift), `decoding="async"`, and — for large frames — `srcset`/`sizes` variants. When you swap in real photographs, export each at 800/1600/2400px wide and mirror the existing attribute pattern; ideally as AVIF or WebP with a JPEG fallback via `<picture>`.

## Adding a journal entry

1. Copy any file in `journal/` (e.g. `on-waiting.html`) and rename it.
2. Update the `<title>`, meta description, canonical URL, category label, heading, date and body.
   - The cover image at the top is the `.post-hero` figure; swap its `src`.
   - `<figure class="full-bleed">` makes an image break out of the reading column to full viewport width.
   - `<h2>` headings are numbered automatically (01, 02…) — just write them.
   - The `.related` card at the bottom cross-links a work series; update its `href`, thumbnail and title.
3. Add a row linking to it in `journal.html` **and** in the journal preview on `index.html`:

```html
<a class="row" href="journal/your-post.html" data-img="(preview image url)">
    <span class="date">01 Jul 2026</span>
    <span class="title">Your title</span>
    <span class="tag">Essay</span>
</a>
```

`data-img` is the image that floats next to the row on hover.

The `tag` doubles as the entry's category: the journal index builds its filter chips from the distinct tags present (the bar stays hidden until there are at least two different categories).

## Adding a work series

1. Copy any file in `work/` and rename it.
2. Update title, meta, the `project-meta` facts, the images, and the `next-project` link at the bottom (keep the chain circular).
   - The `.h-scroll` section is the horizontal film strip: on desktop it pins and the scroll axis flips horizontal; on mobile it's a native swipe strip. Add or remove `.h-item`s freely — frame numbers stamp themselves.
   - The `.related` card cross-links a journal entry.
3. Add a card to the grid in `work.html` (the grid cycles every four cards) and, if you like, a frame in `archive.html`.
4. Work-card links carry `data-vt`: in Chromium/Safari the clicked thumbnail morphs into the series cover (View Transitions); elsewhere the frame-advance plays instead.

## Animation notes — "the darkroom language"

The motion system borrows its metaphors from analog photography:

- **First visit**: the homepage develops out of a paper-white sheet (no blocking preloader; runs once per browser session via `sessionStorage`).
- **Page transitions**: a frame-advance — one dark frame winds vertically through the viewport, with a mono frame counter (`FR 02`, `FR 03`…) ticking up per navigation.
- **Image reveals**: photographs surface from blank paper with exposure settling in (filter/opacity animation), like a print in the developing tray.
- **Labels**: all metadata is set in Fragment Mono, like film-rebate markings; work-grid cards and series-page images are stamped with automatic `FR 01`-style frame numbers (CSS counters — no markup needed).
- **Scroll velocity**: scrolling fast softens the page like motion blur; it settles crisp when you stop.
- **Idle screensaver** (home): after 45 seconds of stillness the site slow-plays the work full-screen; any input wakes it.
- **Background toggle** (the ◐ in the header): paper-white ↔ near-black, persisted per visitor.
- **Accent color**: `--accent` has exactly one job — the availability dot in the hero.
- **Per-visit shuffle**: the featured series on the home page reorder on every load and renumber themselves.
- Page transitions intercept internal link clicks; external/mailto links are left alone.
- All motion respects `prefers-reduced-motion` (scroll choreography lives in `gsap.matchMedia`, so flipping the OS setting reverts it live) and the site is fully readable without JavaScript.
