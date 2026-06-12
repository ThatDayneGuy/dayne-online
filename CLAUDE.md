# Claude Code guidance for dayne.online

**Read README.md before doing anything** — it is the full operating manual
(architecture, how-tos, design rules, and the "For AI assistants" section with
the hard-won constraints).

Quick facts:
- Astro static site; `npm run build` outputs `dist/`. Run it before every commit —
  it validates the content schemas and is the only test suite.
- Content lives in `src/content/` (journal = Markdown, work series = YAML);
  the schemas are in `src/content.config.ts`.
- All styling is `public/assets/css/main.css`; all animation is
  `public/assets/js/main.js`. Plain CSS/JS, no build processing — templates only
  carry structure and `data-*` hooks.
- URLs end in `.html` and must not change; content filenames are slugs.
- All visible copy is intentionally "test text" placeholder until Dayne writes
  the real words. Don't author editorial copy unless asked.
- Deploys: Cloudflare auto-builds `main` (`npm run build` → `dist`).
