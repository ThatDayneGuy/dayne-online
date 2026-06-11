# dayne.online — Improvement Plan
### Based on overnight research: 75 award-recognized photography sites assessed individually

**Date:** 11 June 2026
**Method:** 6 parallel research passes. Primary source awwwards.com (SOTD / Developer Award / Honorable Mention / Nominee entries, 2015–2026, weighted to 2024–2026), supplemented by FWA, CSSDA, Siteinspire, Httpster, Minimal Gallery, Godly, builder case studies (Exo Ape, Obys, Garden Eight, OH NORD, DD.NYC, Lundqvist & Dallyn…) and pattern/feasibility research (Codrops, Chrome dev blog, NN/g, GSAP/Webflow announcements).
**Honesty note:** this environment's network proxy blocks direct page fetches (403 on awwwards and most live sites), so assessments are built from search-extracted award entries, case studies and press rather than hands-on browsing. Counts below are minimums — patterns confirmed per site, graded by confidence. 4 of 75 sites yielded insufficient data and were flagged, not guessed.

---

## 1. What the best photography sites are doing (evidence summary)

**a. Monochrome chrome is the winning default — we're on the right track.**
~37 of 75 sites run strict black/white/neutral UI so the photographs supply all color (Ottografie, Clmt., Matteo Zanga, Jack Davison, Paul & Henriette, Darker Lights, Dasupply, Studio Ignatov, IGNANT, Magnum…). Where color appears, it's a single hard accent (Daria Izbash's rust, Spencer Lowell's green, Black Mango's yellow). **Implication: keep the monochrome system; optionally reserve one accent color for one job only.**

**b. The signature move at SOTD level is a bespoke, photography-native motion language.**
The most-awarded sites borrow their motion metaphors from the medium itself: SAVMEDIA's full camera concept (sensor-cleaning loader, shutter-blade page transitions), Peak'n Film's frame-advance transitions, Takamitsu Motoyoshi's viewfinder hover + scroll-speed film distortion, Siena Film's velocity-driven saturation/blur, Studio Ignatov's camera-log monospace labels, Arnaud Ele's film-roll annotations. Generic fades win nothing; a coherent metaphor wins awards.

**c. Dual viewing modes / index views recur constantly.**
Mathijs Hanenkamp's "Overview" contact-sheet page, Madeleine Dalla's double nav (text index ↔ visual carousel), Danielle Levitt's slideshow-vs-editorial per project, Motoyoshi's index/expanded modes, Marcus Eriksson's client index, Framer's S/M/L grid toggle pattern. The funnel: dense thumbnail index for browsers, editorial flow for readers.

**d. Horizontal scroll inside projects; axis-flip as a signal.**
Ruben Wyttenbach (vertical infinite home → horizontal inside projects), Madeleine Dalla, Mathieu Lévesque, Clmt., Peak'n Film. The axis change tells you "you've entered a body of work."

**e. Continuity transitions between pages.**
Darker Lights' clicked image persists and becomes the next page's hero; Exo Ape's case studies auto-flow into the next project; FX Manceau's multi-page site disguised as a one-pager. The View Transitions API now does the thumbnail-morph natively (Chromium + Safari, graceful fallback in Firefox).

**f. Writing is rare among portfolios — which makes it Dayne's differentiator.**
Only ~8 of 75 integrate substantive writing. The strong models: IGNANT (magazine structure: essay intro, interleaved full-bleed images, categories), The Sochi Project (chaptered photo-essays where text and image carry equal weight), Northlandscapes (journal as commercial flywheel feeding prints/library), OBSESD ("Stories" so the blog reads as portfolio), Carl Kleiner (diary layer over a searchable archive). Most photographer sites have *zero* editorial — a journal done at IGNANT quality is genuinely uncommon.

**g. Idle states and ambient behavior.**
Jack Davison and Marcus Eriksson both ship an idle "screensaver" that starts playing work when the visitor stops interacting. Eriksson also reshuffles his layout on every reload. The portfolio performs even when you don't.

**h. What's fading (avoid):**
Long blocking preloaders/percentage counters (criticized as generic; the praised direction is loading integrated into the hero), scrolljacking (NN/g: disorienting; "users want speed and control"), excessive cursor followers, autoplay background video, parallax overload. Lenis survives criticism because it wraps *native* scroll.

**i. Tooling shift that changes our cost calculus:**
As of April 2025, **all GSAP club plugins are free** (SplitText with built-in aria + masking, Flip, Draggable + InertiaPlugin, ScrollSmoother) and CDN-distributable since GSAP 3.13 — several previously-impractical patterns are now zero-cost for our no-build stack. Cross-document **View Transitions API** is usable as progressive enhancement. Codrops published GSAP-only (no WebGL) recipes for infinite drag grids (June 2025, Jan 2026).

**j. Performance table stakes for image-heavy sites (2026):**
LCP < 2.5s; AVIF/WebP via `<picture>` (~50%/30% smaller than JPEG); `srcset/sizes` everywhere; never lazy-load the LCP image + `fetchpriority="high"` (already done on our heroes); explicit width/height to kill CLS (**we're missing this**); WOFF2 self-hosted fonts, preload 1–2 critical files (we currently load render-blocking Google Fonts CSS).

---

## 2. The plan — proposed improvements

Each item: evidence → what we'd do → effort (S/M/L). Approve by number.

### Tier 1 — Foundations (low risk, should do regardless)

**1. Image delivery overhaul** — Evidence: j; every modern award site. Add explicit `width`/`height` (CLS), `decoding="async"`, `srcset/sizes` on all gallery images, `<picture>` AVIF→WebP→JPEG once real photos land, and a documented export pipeline in the README (sizes per slot). Placeholder picsum URLs get width/height now. *Effort: S–M*

**2. Font self-hosting** — Evidence: j (only 12% of sites preload fonts — easy differentiator). Self-host Archivo + Instrument Serif as WOFF2 in `/assets/fonts/`, preload the two critical files, `font-display: swap`. Kills the Google Fonts render-blocking round-trip and the GDPR wart. *Effort: S*

**3. Motion accessibility upgrade** — Evidence: trend research (gsap.matchMedia is the recommended pattern; SplitText 2025 rewrite has built-in screen-reader handling). Migrate reduced-motion handling to `gsap.matchMedia()`, adopt free SplitText for text reveals (replaces our hand-rolled splitter, gets aria for free), keep full graceful no-JS degradation. *Effort: S–M*

### Tier 2 — Signature moves (the award-level upgrades)

**4. A photography-native motion identity ("the darkroom language")** — Evidence: b (SAVMEDIA, Peak'n Film, Motoyoshi, Studio Ignatov, Arnaud Ele). Replace generic motifs with one coherent metaphor drawn from analog photography, applied site-wide: frame-advance page transitions (hard vertical cut like a film winder, replacing the current generic 3-panel wipe), contact-sheet frame numbers on work items ("FR 01–14"), film-edge markings/monospace metadata labels (we'd add one monospace face for labels, à la Studio Ignatov), develop-style image reveals (image fades up from paper-white like a print developing, replacing one-size-fits-all curtain wipes). The preloader counter (fading pattern, see h) becomes a brief "developing" beat integrated into the hero rather than a blocking counter. **This is the single highest-leverage item — it converts polish into identity.** *Effort: M–L*

**5. Work index view toggle (editorial ↔ contact sheet)** — Evidence: c (Hanenkamp, Dalla, Levitt, Motoyoshi, Framer S/M/L). Add a grid/list toggle on `work.html`: current editorial grid ↔ dense "contact sheet" thumbnail index (and a third list-only text mode if we're feeling Dalla). Animated with the now-free GSAP Flip plugin. *Effort: M*

**6. Horizontal scroll galleries inside series pages** — Evidence: d (Wyttenbach's axis flip, Dalla, Lévesque, Clmt.). One pinned ScrollTrigger horizontal section per series page (canonical GSAP pattern), so entering a project changes the scroll axis. Falls back to a normal vertical stack on mobile/reduced-motion. *Effort: M*

**7. Continuity transitions (image persists into the next page)** — Evidence: e (Darker Lights, Exo Ape, FX Manceau). Progressive enhancement via cross-document View Transitions API: clicking a work card morphs that image into the series-page cover; "next series" footer flows into the next project. Firefox/no-support falls back to our existing wipe. *Effort: M*

**8. Scroll-velocity image response** — Evidence: b (Siena Film — your own reference — and Motoyoshi). Subtle: scrolling fast slightly blurs/desaturates or skews the images, settling crisp when you stop — Lenis exposes velocity, GSAP quickTo maps it. Cheap, tactile, very "film." *Effort: S–M*

**9. Journal → photo-essay engine (the differentiator)** — Evidence: f (IGNANT, Sochi Project, Northlandscapes, OBSESD). Upgrade the journal from "blog with one image" to a magazine: full-bleed interleaved images with captions, optional chaptered long-reads (Sochi model), category taxonomy (Field Notes / Essays / Process), entries cross-linked from related work series, and journal cards that can carry a cover image on the index. Since writing is the rarest feature among the 75 sites, this is where dayne.online can be genuinely uncommon rather than merely fashionable. *Effort: M*

### Tier 3 — Delight (optional, pick favorites)

**10. Idle screensaver mode** — Evidence: g (Jack Davison, Marcus Eriksson). After ~45s idle on the home page, the site starts slow-playing full-screen work; any input dismisses it. *Effort: S–M*

**11. Infinite drag archive canvas** — Evidence: trend research (Unseen Studio SOTM; Codrops GSAP-only recipes June 2025/Jan 2026). A separate `archive.html`: every photo ever, as an infinite draggable grid (GSAP Draggable + Inertia, no WebGL). The 2024–26 marquee pattern; biggest wow per effort, but also the trendiest item here (highest risk of dating). *Effort: L*

**12. Background contrast control** — Evidence: a/b (Ottografie lets visitors adjust background to judge photos; photography sites commit to one theme rather than full dark mode). A small paper-white ↔ near-black toggle affecting only gallery backgrounds. *Effort: S*

**13. One accent color, one job** — Evidence: a (Izbash rust, Lowell green). Optional: a single accent used solely for, e.g., the availability dot + active states. *Effort: S*

**14. Reload variation** — Evidence: g (Eriksson reshuffles per reload). Featured-work order/crops vary per visit. *Effort: S*

### Explicitly not recommended
- **WebGL displacement/distortion hovers** — the one pattern requiring shaders (Aikawa, Arahama, Spatzek, Paul & Henriette). Clip-path + transform gets ~80% of the perceived polish at 0% of the complexity; revisit only if a flagship moment demands it.
- **Scrolljacking / pinned full-page snap journeys** — fading, NN/g-condemned (h). Persepolis earns it by being a narrative; a portfolio doesn't.
- **Longer preloader** — counters are dated; item 4 absorbs loading into the hero instead.
- **Autoplay background video, parallax-on-everything** — flagged as 2025's overused trio.

---

## 3. Suggested sequencing (if everything is approved)

1. Foundations: items 1–3 (one PR — invisible but load-bearing)
2. Identity: item 4 + 8 (one PR — the motion language)
3. Structure: items 5, 6, 7 (one PR per item)
4. Journal: item 9 (one PR, lands with your first real entries)
5. Delight: any of 10–14 as dessert

Everything stays no-build vanilla HTML/CSS/JS + CDN, fully degradable without JS, reduced-motion-safe.

---

## Appendix A — Sites assessed (75)

**SOTD class:** Ottografie (Exo Ape) · Daria Izbash · Tanya Timal · Clmt. Paris · Matteo Zanga · Mercure Studio · Axel Vanhessche · Takamitsu Motoyoshi (Garden Eight) · David William Baum · Peak'n Film · Olga Prudka (Obys) · Ethan & Tom · Studio Naam · Wildy Riftian · Photographers' Virtual Gallery (Okey) · Paul & Henriette · Ruben Wyttenbach · Madeleine Dalla · Darker Lights · Dima Kutsenko · Marcus Eriksson · Gunnar Freyr · Mathieu Lévesque

**Honorable Mention class:** Ildar Husnetdinov · Urban Photographe · Avagyan Wedding · PaulKram · OBSESD · Taras Yareha · Félix Péault · Kaat DM · Jack Davison · Mathijs Hanenkamp · Jonathan Alpeyrie · Spencer Lowell · Matt Quinn · Northlandscapes · Naaro · Stillstars · Emma Job · Kenichi Aikawa · Kaz Arahama · Büro Jantzen · Arnaud Ele · Walter Spatzek · Dasupply · Sasha Satchi · SAVMEDIA · Cross Production · Trigger Shoots · FX Manceau · Black Mango · Studio Ignatov

**Nominee class:** Jan Kasl · Anthony Tuccitto · Samuel Docker · Christina Hohner · Florian Spring · Nikos Pandazaras · Photography that Moves

**Curated/adjacent + references:** IGNANT · Foam Talent · The Sochi Project · Sean Fennessy · Agnes Lloyd-Platt · Danielle Levitt · Graydon Herriott · Carl Kleiner · Cecile Bortoletti · Jose Villa · Mikkel Vang · Rosie Harriet Ellis · **Magnum Photos** · **Persepolis Reimagined (Getty)** · **Siena Film** (the last three = your stated references)

*Flagged insufficient data: Emma Job, Ethan & Tom (visuals), Ildar Husnetdinov, Nikos Pandazaras (visuals).*

## Appendix B — Load-bearing sources

- GSAP free + CDN: webflow.com/blog/gsap-becomes-free · gsap.com/blog/3-13
- View Transitions: developer.chrome.com/blog/view-transitions-in-2025
- Infinite grids without WebGL: tympanus.net/codrops (2025-06-11, 2026-01-07)
- Scrolljacking critique: nngroup.com/articles/scrolljacking-101
- SplitText rewrite/aria: webflow.com/blog/gsap-splittext-rewrite
- Image/LCP/font table stakes: requestmetrics.com, web.dev/articles/font-best-practices, 2025 Web Almanac
- Reference case studies: awwwards.com Persepolis & Siena Film case studies, Exo Ape/Ottografie, Garden Eight/Motoyoshi (Codrops), Ashley Menezes/SAVMEDIA, Build in Amsterdam/Foam, Kummer & Herrman/Sochi
