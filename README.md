# dayne.online

Photography portfolio & journal. A static site — no build step, no framework. Open `index.html` or serve the folder and it works.

## Structure

```
index.html              Home — hero, statement, selected work, journal preview
work.html               Portfolio index (grid of series)
work/*.html             Individual series pages
journal.html            Journal index (list of entries)
journal/*.html          Individual entries
about.html              Bio, services, contact
assets/css/main.css     The entire design system
assets/js/main.js       The entire motion engine
```

## Tech

- **GSAP + ScrollTrigger** — scroll reveals, parallax, preloader, page transitions (CDN)
- **Lenis** — smooth scrolling (CDN)
- **Archivo + Instrument Serif** — typography (Google Fonts)

Everything degrades gracefully: with JavaScript disabled (or a CDN blocked) the site is a plain, fully readable static page.

## Replacing the placeholder images

All images are currently grayscale placeholders from `picsum.photos`. To use real photographs, drop files into an `images/` folder and replace the `src` URLs. The CSS applies `filter: grayscale(1)` to every image inside a `.frame` — remove that rule in `main.css` (search for `grayscale`) if you want your own toning to come through untouched.

Recommended sizes: ~2400px wide for full-bleed/cover images, ~1600px for grid images. Keep the `alt` text meaningful.

## Adding a journal entry

1. Copy any file in `journal/` (e.g. `on-waiting.html`) and rename it.
2. Update the `<title>`, meta description, canonical URL, category label, heading, date and body.
3. Add a row linking to it in `journal.html` **and** in the journal preview on `index.html`:

```html
<a class="row" href="journal/your-post.html" data-img="(preview image url)">
    <span class="date">01 Jul 2026</span>
    <span class="title">Your title</span>
    <span class="tag">Essay</span>
</a>
```

`data-img` is the image that floats next to the row on hover.

## Adding a work series

1. Copy any file in `work/` and rename it.
2. Update title, meta, the `project-meta` facts, the images, and the `next-project` link at the bottom (keep the chain circular).
3. Add a card to the grid in `work.html`. The grid layout cycles every four cards, so just append — sizing is automatic.

## Animation notes

- The preloader runs once per browser session (tracked in `sessionStorage`).
- Page transitions intercept internal link clicks; external/mailto links are left alone.
- All motion respects `prefers-reduced-motion`.
