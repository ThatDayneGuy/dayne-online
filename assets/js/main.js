/* ==========================================================================
   dayne.online — motion engine
   Built on GSAP + ScrollTrigger + Lenis (loaded from CDN).
   Everything degrades gracefully: if JS or the CDN fails, the site is a
   plain, fully readable static page.
   ========================================================================== */

(function () {
  "use strict";

  var docEl = document.documentElement;
  var reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduceMotion = reduceMQ.matches;
  // Keep the flag live: gsap.matchMedia re-runs setups when the OS
  // preference changes, and they must not read a stale value. This
  // listener registers first, so it updates before mm callbacks fire.
  if (reduceMQ.addEventListener) {
    reduceMQ.addEventListener("change", function (e) { reduceMotion = e.matches; });
  }
  var hasGsap = typeof window.gsap !== "undefined";
  var EASE = "expo.out";

  /* ------------------------------------------------------------------
     Smooth scroll (Lenis), driven by the GSAP ticker
  ------------------------------------------------------------------ */
  var lenis = null;
  if (!reduceMotion && hasGsap && typeof window.Lenis !== "undefined") {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", function () {
      if (window.ScrollTrigger) window.ScrollTrigger.update();
    });
    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  }

  if (hasGsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }
  if (hasGsap && window.SplitText) gsap.registerPlugin(SplitText);
  if (hasGsap && window.Flip) gsap.registerPlugin(Flip);

  /* ------------------------------------------------------------------
     Text splitting helpers
     Prefer GSAP SplitText (free since 3.13: built-in masking + aria);
     fall back to the manual splitter if the plugin didn't load.
  ------------------------------------------------------------------ */
  // Results are cached per element so a matchMedia re-run (e.g. the user
  // toggling reduced motion off and on) never double-splits the DOM.
  function splitChars(el) {
    if (el._splitChars) return el._splitChars;
    if (window.SplitText) {
      try {
        el._splitChars = new SplitText(el, { type: "chars", mask: "chars" }).chars;
        return el._splitChars;
      } catch (e) { /* fall through to manual */ }
    }
    el._splitChars = manualSplitChars(el);
    return el._splitChars;
  }

  function splitWords(el) {
    if (el._splitWords) return el._splitWords;
    if (window.SplitText) {
      try {
        el._splitWords = new SplitText(el, { type: "words", mask: "words" }).words;
        return el._splitWords;
      } catch (e) { /* fall through to manual */ }
    }
    el._splitWords = manualSplitWords(el);
    return el._splitWords;
  }

  function manualSplitChars(el) {
    // Splits each .line inside el (or el itself) into per-char spans.
    var lines = el.querySelectorAll(".line");
    if (!lines.length) lines = [el];
    var chars = [];
    lines.forEach(function (line) {
      var nodes = Array.prototype.slice.call(line.childNodes);
      line.textContent = "";
      nodes.forEach(function (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent.split("").forEach(function (ch) {
            var span = document.createElement("span");
            span.className = "char";
            span.textContent = ch === " " ? " " : ch;
            line.appendChild(span);
            chars.push(span);
          });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Keep styled fragments (e.g. .serif-i) intact as a single "char"
          node.classList.add("char");
          line.appendChild(node);
          chars.push(node);
        }
      });
    });
    return chars;
  }

  function manualSplitWords(el) {
    var nodes = Array.prototype.slice.call(el.childNodes);
    el.textContent = "";
    var inners = [];

    function addWord(text, cls) {
      var outer = document.createElement("span");
      outer.className = "word";
      var inner = document.createElement("span");
      if (cls) inner.className = cls;
      inner.textContent = text;
      outer.appendChild(inner);
      el.appendChild(outer);
      el.appendChild(document.createTextNode(" "));
      inners.push(inner);
    }

    nodes.forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent.split(/\s+/).forEach(function (w) {
          if (w) addWord(w);
        });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        var cls = node.className;
        node.textContent.split(/\s+/).forEach(function (w) {
          if (w) addWord(w, cls);
        });
      }
    });
    return inners;
  }

  /* ------------------------------------------------------------------
     Preloader (first visit only) + hero intro
  ------------------------------------------------------------------ */
  function heroIntro(delay) {
    var title = document.querySelector("[data-hero-title]");
    var meta = document.querySelector(".hero-meta");
    var scrollHint = document.querySelector(".hero-scroll");
    if (!title) return;

    var chars = splitChars(title);
    var tl = gsap.timeline({ delay: delay || 0 });
    tl.from(chars, {
      yPercent: 110,
      duration: 1.2,
      ease: EASE,
      stagger: 0.035
    });
    if (meta) tl.fromTo(meta, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, ease: EASE }, "-=0.7");
    if (scrollHint) tl.fromTo(scrollHint, { opacity: 0 }, { opacity: 1, duration: 0.8 }, "-=0.5");
  }

  function runIntro() {
    // First visit: a darkroom-timer dial sweeps while the page develops.
    var loader = document.querySelector(".loader");
    var isFirstVisit = false;
    try {
      isFirstVisit = !sessionStorage.getItem("visited");
    } catch (e) { /* storage unavailable */ }

    if (!loader || !isFirstVisit || reduceMotion || !hasGsap) {
      if (loader) loader.remove();
      docEl.classList.remove("preload");
      if (hasGsap && !reduceMotion) heroIntro(0.1);
      return;
    }

    try { sessionStorage.setItem("visited", "1"); } catch (e) {}
    if (lenis) lenis.stop();

    var core = loader.querySelector(".loader-core");
    var ring = loader.querySelector(".ring");
    var pct = loader.querySelector(".loader-pct");
    var CIRC = 339.292; // matches the stroke-dasharray in CSS
    var progress = { v: 0 };

    var tl = gsap.timeline({
      onComplete: function () {
        loader.remove();
        docEl.classList.remove("preload");
        if (lenis) lenis.start();
      }
    });

    tl.to(progress, {
      v: 100,
      duration: 1.9,
      ease: "power2.inOut",
      onUpdate: function () {
        if (pct) pct.textContent = String(Math.round(progress.v));
        if (ring) ring.style.strokeDashoffset = String(CIRC * (1 - progress.v / 100));
      }
    });
    // dial winds down, then the room lights come up on the hero
    tl.to(core, { scale: 0.92, opacity: 0, duration: 0.45, ease: "power2.in" }, "+=0.15");
    tl.to(loader, {
      opacity: 0,
      duration: 0.7,
      ease: "power2.inOut",
      onStart: function () {
        heroIntro(0.25);
      }
    }, "<0.2");
  }

  /* ------------------------------------------------------------------
     Page transitions (wipe out on internal links, wipe in on arrival)
  ------------------------------------------------------------------ */
  function initTransitions() {
    // Liquid glass: a frosted pane sweeps vertically through the gate.
    // Leaving, the page dissolves into frost; the swap happens behind
    // the glass; arriving, the pane continues through and the new page
    // sharpens out of it. Grain swells while the pane is in motion.
    var overlay = document.querySelector(".transition");
    if (!overlay || !hasGsap || reduceMotion) {
      docEl.classList.remove("pt-in");
      return;
    }
    var strip = overlay.querySelector(".strip");
    if (!strip) return;

    function grain(to, duration) {
      gsap.to(docEl, { "--grain": to, duration: duration, ease: "power1.inOut", overwrite: "auto" });
    }

    // Pane geometry in pixels. The glass pane is 140vh tall: a 100vh
    // frosted core with 20vh feathered edges. Covered position is
    // -20vh so the feathers sit outside the gate.
    function vh(n) { return window.innerHeight * (n / 100); }

    // Arriving: the pane slides on through, and the new page sharpens
    // out of the frost behind it
    function playArrival() {
      gsap.set(docEl, { "--grain": 0.12 });
      grain(0.035, 1.2);
      gsap.fromTo(strip, { y: -vh(20) }, {
        y: function () { return -vh(140); },
        duration: 0.8,
        ease: "expo.inOut",
        onComplete: function () {
          docEl.classList.remove("pt-in");
          gsap.set(strip, { y: vh(100) });
        }
      });
    }

    if (docEl.classList.contains("pt-in")) {
      playArrival();
    } else if (document.prerendering) {
      // This document was prerendered before the click, so the inline
      // head script ran before the departing page set its flag. Check
      // again at activation and play the arrival from there.
      document.addEventListener("prerenderingchange", function () {
        var flagged = false;
        try {
          flagged = !!sessionStorage.getItem("pt");
          if (flagged) sessionStorage.removeItem("pt");
        } catch (e) {}
        if (flagged) {
          docEl.classList.add("pt-in");
          playArrival();
        }
      }, { once: true });
    }

    var navigating = false;

    document.addEventListener("click", function (e) {
      var link = e.target.closest("a");
      if (!link) return;
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) === "#" || link.target === "_blank") return;
      if (/^(mailto:|tel:|https?:\/\/)/.test(href) && link.hostname !== location.hostname) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Already mid-transition: swallow further clicks
      if (navigating) { e.preventDefault(); return; }

      // Links to the page we're already on: do nothing instead of
      // playing a full wipe into an identical reload
      var dest = new URL(link.href, location.href);
      if (dest.pathname === location.pathname && dest.search === location.search) {
        e.preventDefault();
        return;
      }

      // Tagged thumbnails morph into the next page's cover via the
      // View Transitions API where supported — skip the overlay and
      // let the browser carry the image across.
      if (link.hasAttribute("data-vt") && document.startViewTransition) {
        navigating = true;
        var vtImg = link.querySelector("img");
        if (vtImg) vtImg.style.viewTransitionName = "cover";
        try { sessionStorage.setItem("vt", "1"); } catch (err) {}
        return;
      }

      e.preventDefault();
      navigating = true;
      try { sessionStorage.setItem("pt", "1"); } catch (err) {}
      grain(0.12, 0.5);
      gsap.fromTo(strip, { y: vh(100) }, {
        y: function () { return -vh(20); },
        duration: 0.55,
        ease: "expo.inOut",
        onComplete: function () {
          location.href = href;
          // The old page keeps painting while the next one is fetched —
          // let the glass drift instead of freezing. The solid core
          // still covers the viewport at -22vh.
          gsap.to(strip, { y: "-=" + vh(2), duration: 2, ease: "none" });
        }
      });
    });

    // Restore state when coming back via bfcache
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) {
        navigating = false;
        gsap.set(strip, { y: vh(100) });
        gsap.set(docEl, { "--grain": 0.035 });
        docEl.classList.remove("pt-in");
      }
    });
  }

  /* ------------------------------------------------------------------
     Scroll-driven reveals
  ------------------------------------------------------------------ */
  function initScrollAnimations() {
    if (!hasGsap || !window.ScrollTrigger || reduceMotion) return;

    // Generic fade-up
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      gsap.from(el, {
        opacity: 0,
        y: 40,
        duration: 1.1,
        ease: EASE,
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });

    // Develop reveal: images surface from blank paper, exposure settling in,
    // like a print in the tray. Filter/opacity only, so it coexists with
    // parallax (transforms) and the CSS hover zoom.
    document.querySelectorAll("[data-reveal-img]").forEach(function (frame) {
      var img = frame.querySelector("img");
      if (!img) return;
      var hasParallax = frame.hasAttribute("data-parallax");
      var fromVars = { opacity: 0, filter: "grayscale(1) brightness(1.55) contrast(0.45)" };
      var toVars = {
        opacity: 1,
        filter: "grayscale(1) brightness(1) contrast(1.04)",
        duration: 1.5,
        ease: "power2.inOut",
        onComplete: function () {
          // hand filter/opacity back to the stylesheet (same end values)
          gsap.set(img, { clearProps: hasParallax ? "filter,opacity" : "filter,opacity,scale" });
        },
        scrollTrigger: { trigger: frame, start: "top 85%", once: true }
      };
      if (!hasParallax) {
        fromVars.scale = 1.08;
        toVars.scale = 1;
      }
      gsap.fromTo(img, fromVars, toVars);
    });

    // Parallax drift inside frames
    document.querySelectorAll("[data-parallax]").forEach(function (frame) {
      var img = frame.querySelector("img");
      if (!img) return;
      gsap.fromTo(img,
        { yPercent: -8, scale: 1.16 },
        {
          yPercent: 8,
          scale: 1.16,
          ease: "none",
          scrollTrigger: { trigger: frame, start: "top bottom", end: "bottom top", scrub: true }
        }
      );
    });

    // Word-by-word statement reveal
    document.querySelectorAll("[data-split-words]").forEach(function (el) {
      var words = splitWords(el);
      gsap.from(words, {
        yPercent: 110,
        duration: 0.9,
        ease: EASE,
        stagger: 0.02,
        scrollTrigger: { trigger: el, start: "top 85%", once: true }
      });
    });

    // Page titles on subpages (no preloader, just a clean rise)
    document.querySelectorAll("[data-title-reveal]").forEach(function (el) {
      var chars = splitChars(el);
      gsap.from(chars, {
        yPercent: 110,
        duration: 1.1,
        ease: EASE,
        stagger: 0.03,
        delay: 0.35
      });
    });

    // Hero figure scales open as you scroll into it
    var heroFigure = document.querySelector("[data-scale-in]");
    if (heroFigure) {
      gsap.fromTo(heroFigure,
        { scale: 0.92 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: heroFigure, start: "top bottom", end: "top 20%", scrub: true }
        }
      );
    }
  }

  /* ------------------------------------------------------------------
     Journal list hover preview
  ------------------------------------------------------------------ */
  function initListPreview() {
    var preview = document.querySelector(".list-preview");
    var rows = document.querySelectorAll(".row[data-img]");
    if (!preview || !rows.length || !hasGsap || reduceMotion) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    var img = preview.querySelector("img");
    var xTo = gsap.quickTo(preview, "x", { duration: 0.5, ease: "power3" });
    var yTo = gsap.quickTo(preview, "y", { duration: 0.5, ease: "power3" });

    rows.forEach(function (row) {
      row.addEventListener("mouseenter", function () {
        img.src = row.getAttribute("data-img");
        gsap.to(preview, { opacity: 1, scale: 1, duration: 0.45, ease: EASE });
      });
      row.addEventListener("mouseleave", function () {
        gsap.to(preview, { opacity: 0, scale: 0.9, duration: 0.35, ease: "power2.out" });
      });
    });

    window.addEventListener("mousemove", function (e) {
      xTo(e.clientX + 28);
      yTo(e.clientY - preview.offsetHeight / 2);
    });
  }

  /* ------------------------------------------------------------------
     Custom cursor
  ------------------------------------------------------------------ */
  function initCursor() {
    var cursor = document.querySelector(".cursor");
    if (!cursor || !hasGsap || reduceMotion) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    gsap.set(cursor, { xPercent: -50, yPercent: -50 });
    var xTo = gsap.quickTo(cursor, "x", { duration: 0.35, ease: "power3" });
    var yTo = gsap.quickTo(cursor, "y", { duration: 0.35, ease: "power3" });

    window.addEventListener("mousemove", function (e) {
      cursor.style.opacity = "1";
      xTo(e.clientX);
      yTo(e.clientY);
    });

    document.addEventListener("mouseover", function (e) {
      var target = e.target.closest("[data-cursor]");
      if (target) {
        cursor.querySelector(".cursor-label").textContent = target.getAttribute("data-cursor");
        cursor.classList.add("is-view");
      }
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest("[data-cursor]")) cursor.classList.remove("is-view");
    });
  }

  /* ------------------------------------------------------------------
     Mobile menu
  ------------------------------------------------------------------ */
  function initMenu() {
    var toggle = document.querySelector(".menu-toggle");
    var menu = document.querySelector(".menu");
    if (!toggle || !menu) return;

    var links = menu.querySelectorAll("ol a > span");
    var foot = menu.querySelector(".menu-foot");
    var open = false;
    var tl = null;

    if (hasGsap && !reduceMotion) {
      tl = gsap.timeline({
        paused: true,
        // keep the overlay visible while the close animation reverses
        onReverseComplete: function () {
          menu.style.visibility = "";
        }
      });
      tl.fromTo(menu, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.8, ease: "expo.inOut" });
      tl.from(links, { yPercent: 110, duration: 0.8, ease: EASE, stagger: 0.07 }, "-=0.35");
      if (foot) tl.from(foot, { opacity: 0, duration: 0.5 }, "-=0.4");
    }

    toggle.addEventListener("click", function () {
      open = !open;
      docEl.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (lenis) open ? lenis.stop() : lenis.start();
      if (tl) {
        if (open) {
          menu.style.visibility = "visible";
          tl.timeScale(1).play();
        } else {
          menu.style.visibility = "visible";
          tl.timeScale(1.6).reverse();
        }
      } else {
        menu.style.visibility = open ? "visible" : "";
        menu.style.clipPath = open ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)";
      }
    });
  }

  /* ------------------------------------------------------------------
     Journal category filter
     Chips are built from the tags present in the list, so adding a new
     category to a row is all it takes. With fewer than two distinct
     categories the bar removes itself.
  ------------------------------------------------------------------ */
  function initJournalFilter() {
    var bar = document.querySelector("[data-filter]");
    if (!bar) return;
    var rows = Array.prototype.slice.call(document.querySelectorAll(".row-list .row"));
    var cats = [];

    rows.forEach(function (row) {
      var tagEl = row.querySelector(".tag");
      var cat = tagEl ? tagEl.textContent.trim() : "";
      row.setAttribute("data-cat", cat);
      if (cat && cats.indexOf(cat) === -1) cats.push(cat);
    });

    if (cats.length < 2) {
      bar.remove();
      return;
    }

    function makeChip(label, cat) {
      var chip = document.createElement("button");
      chip.className = "chip";
      chip.type = "button";
      chip.textContent = label;
      chip.setAttribute("aria-pressed", cat === "" ? "true" : "false");
      chip.addEventListener("click", function () {
        bar.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        rows.forEach(function (row) {
          var show = !cat || row.getAttribute("data-cat") === cat;
          row.classList.toggle("is-hidden", !show);
        });
        if (hasGsap && !reduceMotion) {
          gsap.fromTo(rows.filter(function (r) { return !r.classList.contains("is-hidden"); }),
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.5, ease: EASE, stagger: 0.05 });
        }
        if (window.ScrollTrigger) ScrollTrigger.refresh();
      });
      bar.appendChild(chip);
    }

    makeChip("All", "");
    cats.forEach(function (cat) { makeChip(cat, cat); });
  }

  /* ------------------------------------------------------------------
     Reading progress hairline (journal entries)
  ------------------------------------------------------------------ */
  function initProgress() {
    var bar = document.querySelector(".progress");
    if (!bar || !hasGsap || !window.ScrollTrigger || reduceMotion) return;
    gsap.to(bar, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3
      }
    });
  }

  /* ------------------------------------------------------------------
     Scroll-velocity response: scrolling fast softens the page like
     film motion blur; it settles crisp when you stop. (Siena Film,
     Takamitsu Motoyoshi.)
  ------------------------------------------------------------------ */
  function initVelocity() {
    if (!lenis || !hasGsap) return;
    if (document.querySelector("[data-archive]")) return;
    // The blur is applied to the images via a CSS variable — never to an
    // ancestor element. A filter on an ancestor (e.g. <main>) makes it
    // the containing block for position:fixed, which detaches
    // ScrollTrigger's pinned sections mid-scroll (blank-screen bug).
    var state = { b: 0 };
    var ease = gsap.quickTo(state, "b", {
      duration: 0.3,
      ease: "power1.out",
      onUpdate: function () {
        docEl.style.setProperty("--vblur", state.b > 0.04 ? state.b.toFixed(2) + "px" : "0px");
      }
    });
    lenis.on("scroll", function (e) {
      ease(Math.min(Math.abs(e.velocity || 0) / 40, 1) * 1.6);
    });
  }

  /* ------------------------------------------------------------------
     Horizontal film strip inside series pages: scroll axis flips to
     horizontal while the strip is pinned (Wyttenbach, Dalla, Lévesque).
     On mobile / reduced motion / no JS it's a native swipe strip.
  ------------------------------------------------------------------ */
  function initHScroll() {
    if (!hasGsap || !window.ScrollTrigger || !gsap.matchMedia) return;
    var secs = document.querySelectorAll(".h-scroll");
    if (!secs.length) return;

    // Own matchMedia context: crossing the 760px breakpoint (resize,
    // device rotation) or toggling reduced motion re-evaluates the pin
    // live — animations and pin-spacing are reverted automatically.
    gsap.matchMedia().add(
      "(min-width: 761px) and (prefers-reduced-motion: no-preference)",
      function () {
        secs.forEach(function (sec) {
          var track = sec.querySelector(".h-track");
          if (!track) return;
          sec.classList.add("is-pinned");
          gsap.to(track, {
            x: function () { return -(track.scrollWidth - sec.clientWidth); },
            ease: "none",
            scrollTrigger: {
              trigger: sec,
              start: "top top",
              end: function () { return "+=" + (track.scrollWidth - sec.clientWidth); },
              pin: true,
              anticipatePin: 1,
              scrub: 1,
              invalidateOnRefresh: true
            }
          });
        });
        return function () {
          secs.forEach(function (sec) {
            sec.classList.remove("is-pinned");
            var track = sec.querySelector(".h-track");
            if (track) gsap.set(track, { clearProps: "x" });
          });
        };
      }
    );
  }

  /* ------------------------------------------------------------------
     Cinema reel (work page): full-viewport vertical reel with snap
     physics. Wheel, drag or fling past the tension threshold to
     advance — anything short springs back. Outgoing text leads its
     image, incoming frames sit behind a glass veil until half in.
  ------------------------------------------------------------------ */
  function initReel() {
    var reel = document.querySelector("[data-reel]");
    if (!reel || !hasGsap || reduceMotion) return null;
    var slides = Array.prototype.slice.call(reel.querySelectorAll(".reel-slide"));
    if (slides.length < 2) return null;

    var parts = slides.map(function (slide) {
      var img = slide.querySelector(".reel-media img");
      if (img) gsap.set(img, { scale: 1.18 }); // parallax headroom
      return {
        el: slide,
        img: img,
        info: slide.querySelector(".reel-info"),
        veil: slide.querySelector(".reel-veil")
      };
    });

    var count = slides.length;
    var index = 0;
    var current = -0.0001; // force first render
    var tension = 0;
    var acc = 0;
    var active = false;
    var locked = false;
    var hinted = false;
    var springTween = null;

    // Feel constants — tune here
    var LERP = 0.11;            // glide smoothing
    var MAX_TENSION = 0.34;     // rubber-band cap (fraction of a slide)
    var COMMIT_PX = 0.17;       // input distance to commit (fraction of vh)
    var FLING_V = 0.9;          // px/ms pointer velocity that commits
    var RANGE = 0.6;            // input range mapped into tension

    var cursor = document.querySelector(".cursor");
    var hint = reel.querySelector(".reel-hint");
    var rail = reel.querySelector(".reel-rail");
    var numCol = reel.querySelector(".reel-num-col");
    var total = reel.querySelector(".reel-total");
    var ticks = [];

    // Build counter column and rail ticks from the slide count
    if (numCol) {
      for (var n = 1; n <= count; n++) {
        var s = document.createElement("span");
        s.textContent = String(n).padStart(2, "0");
        numCol.appendChild(s);
      }
    }
    if (total) total.textContent = String(count).padStart(2, "0");
    if (rail) {
      for (var t = 0; t < count; t++) {
        var tick = document.createElement("span");
        if (t === 0) tick.classList.add("is-on");
        rail.appendChild(tick);
        ticks.push(tick);
      }
    }

    function rubber(x) { return x / (1 + Math.abs(x) * 1.6); }
    function clampT(x) { return Math.max(-MAX_TENSION, Math.min(MAX_TENSION, x)); }

    function render(p) {
      for (var i = 0; i < count; i++) {
        var off = i - p;
        var part = parts[i];
        var away = Math.abs(off) > 1.1;
        part.el.style.visibility = away ? "hidden" : "visible";
        if (away) continue;
        gsap.set(part.el, { yPercent: off * 100 });
        if (part.info) gsap.set(part.info, { yPercent: off * 38 }); // text leads the image
        if (part.img) gsap.set(part.img, { yPercent: off * -10 }); // image counter-drifts
        if (part.veil) gsap.set(part.veil, { opacity: Math.min(Math.abs(off) * 2, 1) });
        part.el.classList.toggle("is-active", Math.abs(off) < 0.5);
      }
    }

    function tickFn() {
      if (!active) return;
      var target = index + tension;
      var d = target - current;
      if (Math.abs(d) < 0.0002) return;
      current += d * LERP;
      render(current);
    }

    function killSpring() {
      if (springTween) { springTween.kill(); springTween = null; }
    }

    function springBack() {
      killSpring();
      acc = 0;
      var proxy = { v: tension };
      springTween = gsap.to(proxy, {
        v: 0,
        duration: 0.9,
        ease: "elastic.out(1, 0.45)",
        onUpdate: function () { tension = proxy.v; }
      });
    }

    function syncUI() {
      if (numCol) gsap.to(numCol, { yPercent: -(index * 100) / count, duration: 0.6, ease: "expo.out" });
      ticks.forEach(function (tk, i) { tk.classList.toggle("is-on", i === index); });
    }

    function commit(dir) {
      var next = Math.max(0, Math.min(count - 1, index + dir));
      killSpring();
      acc = 0;
      if (next === index) { springBack(); return; } // hit an end: bounce
      index = next;
      tension = 0;
      locked = true;
      setTimeout(function () { locked = false; }, 450);
      grain(0.1, 0.3);
      grain(0.035, 0.9);
      syncUI();
      if (!hinted && hint) {
        hinted = true;
        gsap.to(hint, { opacity: 0, duration: 0.4 });
      }
    }

    // grain helper local to the reel (the transition module has its own)
    function grain(to, duration) {
      gsap.to(docEl, { "--grain": to, duration: duration, ease: "power1.inOut", delay: to < 0.05 ? 0.3 : 0 });
    }

    function blocked() {
      return !active || locked || docEl.classList.contains("menu-open");
    }

    // Wheel: accumulate tension, commit past threshold, spring back on idle
    var wheelTimer = null;
    window.addEventListener("wheel", function (e) {
      if (!active) return;
      e.preventDefault();
      if (locked || docEl.classList.contains("menu-open")) return;
      killSpring();
      acc += e.deltaY;
      tension = clampT(rubber(acc / (window.innerHeight * RANGE)));
      clearTimeout(wheelTimer);
      if (Math.abs(acc) > window.innerHeight * COMMIT_PX) {
        commit(acc > 0 ? 1 : -1);
      } else {
        wheelTimer = setTimeout(springBack, 150);
      }
    }, { passive: false });

    // Drag / fling
    var dragging = false, startY = 0, lastY = 0, lastT = 0, vel = 0, movedY = 0;
    reel.addEventListener("pointerdown", function (e) {
      if (blocked()) return;
      dragging = true;
      movedY = 0;
      startY = lastY = e.clientY;
      lastT = performance.now();
      vel = 0;
      killSpring();
      if (cursor) cursor.classList.add("is-grab");
    });
    window.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var now = performance.now();
      vel = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY;
      lastT = now;
      var dy = e.clientY - startY;
      movedY = Math.max(movedY, Math.abs(dy));
      acc = -dy * 1.4; // drag up advances
      tension = clampT(rubber(acc / (window.innerHeight * RANGE)));
      if (cursor) {
        cursor.classList.toggle("lean-up", dy < -2);
        cursor.classList.toggle("lean-down", dy > 2);
      }
    });
    window.addEventListener("pointerup", function () {
      if (!dragging) return;
      dragging = false;
      if (cursor) cursor.classList.remove("is-grab", "lean-up", "lean-down");
      if (blocked()) { springBack(); return; }
      var flung = Math.abs(vel) > FLING_V;
      if (flung) {
        commit(vel < 0 ? 1 : -1);
      } else if (Math.abs(acc) > window.innerHeight * COMMIT_PX) {
        commit(acc > 0 ? 1 : -1);
      } else {
        springBack();
      }
    });
    // A drag must never count as a click on a slide link
    reel.addEventListener("click", function (e) {
      if (movedY > 8) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // Keyboard
    window.addEventListener("keydown", function (e) {
      if (blocked()) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault(); commit(1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault(); commit(-1);
      } else if (e.key === "Home") {
        e.preventDefault(); index = 0; tension = 0; syncUI();
      } else if (e.key === "End") {
        e.preventDefault(); index = count - 1; tension = 0; syncUI();
      }
    });

    gsap.ticker.add(tickFn);

    return {
      activate: function () {
        active = true;
        render(index);
        syncUI();
      },
      deactivate: function () {
        active = false;
        killSpring();
        tension = 0;
        acc = 0;
      }
    };
  }

  /* ------------------------------------------------------------------
     Work index: cinema reel <-> contact sheet
  ------------------------------------------------------------------ */
  function initWorkToggle(reelApi) {
    var bar = document.querySelector(".view-toggle");
    var grid = document.querySelector(".work-grid");
    if (!bar || !grid) return;
    var chips = bar.querySelectorAll(".chip");

    // Without the reel (no JS-physics path) only the grid exists
    if (!reelApi) {
      var reelChip = bar.querySelector('[data-view="reel"]');
      if (reelChip) reelChip.style.display = "none";
    }

    function setView(view, persist) {
      if (view !== "sheet" && !reelApi) view = "sheet";
      chips.forEach(function (c) {
        c.setAttribute("aria-pressed", String(c.getAttribute("data-view") === view));
      });
      if (view === "reel") {
        docEl.classList.add("reel-mode");
        if (lenis) lenis.stop();
        reelApi.activate();
      } else {
        docEl.classList.remove("reel-mode");
        if (lenis) lenis.start();
        if (reelApi) reelApi.deactivate();
        grid.classList.add("is-sheet");
        if (window.ScrollTrigger) ScrollTrigger.refresh();
      }
      if (persist) {
        try { localStorage.setItem("workview", view); } catch (e) {}
      }
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        setView(chip.getAttribute("data-view"), true);
      });
    });

    var saved = null;
    try { saved = localStorage.getItem("workview"); } catch (e) {}
    if (saved === "editorial") saved = "reel"; // legacy value
    setView(saved === "sheet" ? "sheet" : "reel", false);
  }

  /* ------------------------------------------------------------------
     Idle screensaver (Jack Davison, Marcus Eriksson): after 45s of
     stillness the work starts performing by itself; any input wakes.
  ------------------------------------------------------------------ */
  function initScreensaver() {
    var ss = document.querySelector(".screensaver");
    if (!ss) return;
    if (!hasGsap || reduceMotion) { ss.remove(); return; }
    var img = ss.querySelector("img");
    var srcs = Array.prototype.map.call(
      document.querySelectorAll("main .frame img"),
      function (i) { return i.currentSrc || i.src; }
    ).filter(Boolean);
    if (!img || srcs.length < 2) { ss.remove(); return; }

    var IDLE_MS = 45000;
    var timer = null, cycle = null, idx = 0, on = false;

    function step() {
      idx = (idx + 1) % srcs.length;
      img.src = srcs[idx];
      gsap.fromTo(img,
        { opacity: 0, filter: "grayscale(1) brightness(1.5) contrast(0.5)" },
        { opacity: 1, filter: "grayscale(1) brightness(1) contrast(1.04)", duration: 1.4, ease: "power2.inOut" });
    }

    function wake() {
      if (!on) return;
      on = false;
      ss.classList.remove("is-on");
      clearInterval(cycle);
      if (lenis) lenis.start();
    }

    function sleep() {
      if (on || docEl.classList.contains("menu-open")) return;
      on = true;
      ss.classList.add("is-on");
      if (lenis) lenis.stop();
      step();
      cycle = setInterval(step, 4000);
    }

    function reset() {
      wake();
      clearTimeout(timer);
      timer = setTimeout(sleep, IDLE_MS);
    }

    ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"].forEach(function (ev) {
      window.addEventListener(ev, reset, { passive: true });
    });
    reset();
  }

  /* ------------------------------------------------------------------
     Archive: infinite drag canvas (Unseen Studio pattern, DOM-only).
     The grid is cloned into a 3x3 tile field; dragging/wheeling moves
     a virtual offset that wraps seamlessly. Without JS (or with
     reduced motion) the page stays a plain scrollable grid.
  ------------------------------------------------------------------ */
  function initArchive() {
    var root = document.querySelector("[data-archive]");
    if (!root) return;
    var canvas = root.querySelector(".archive-canvas");
    var grid = root.querySelector(".archive-grid");
    if (!canvas || !grid || !hasGsap || reduceMotion) return;
    if (window.matchMedia("(max-width: 600px)").matches) return; // small screens keep the scroll grid

    docEl.classList.add("archive-mode");
    if (lenis) lenis.stop();

    var tiles = [grid];
    for (var i = 0; i < 8; i++) {
      var clone = grid.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll("a").forEach(function (a) { a.tabIndex = -1; });
      canvas.appendChild(clone);
      tiles.push(clone);
    }

    var gw = 0, gh = 0;
    var pos = { x: 0, y: 0 }, target = { x: 0, y: 0 };

    function mod(n, m) { return ((n % m) + m) % m; }

    function render() {
      if (!gw || !gh) return;
      var bx = mod(pos.x, gw) - gw;
      var by = mod(pos.y, gh) - gh;
      for (var r = 0; r < 3; r++) {
        for (var c = 0; c < 3; c++) {
          tiles[r * 3 + c].style.transform =
            "translate3d(" + (bx + c * gw) + "px," + (by + r * gh) + "px,0)";
        }
      }
    }

    function measure() {
      gw = grid.offsetWidth;
      gh = grid.offsetHeight;
      render();
    }

    gsap.ticker.add(function () {
      pos.x += (target.x - pos.x) * 0.085;
      pos.y += (target.y - pos.y) * 0.085;
      render();
    });

    var dragging = false, sx = 0, sy = 0, tx0 = 0, ty0 = 0, moved = 0;
    root.addEventListener("pointerdown", function (e) {
      dragging = true; moved = 0;
      sx = e.clientX; sy = e.clientY;
      tx0 = target.x; ty0 = target.y;
    });
    window.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      target.x = tx0 + dx * 1.25;
      target.y = ty0 + dy * 1.25;
    });
    window.addEventListener("pointerup", function () { dragging = false; });
    // a drag should never count as a click on a tile link
    root.addEventListener("click", function (e) {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    window.addEventListener("wheel", function (e) {
      target.x -= e.deltaX;
      target.y -= e.deltaY;
    }, { passive: true });

    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    measure();
  }

  /* ------------------------------------------------------------------
     Per-visit variation (Marcus Eriksson): featured work reshuffles
     on every load, then frame indices renumber to match.
  ------------------------------------------------------------------ */
  function initShuffle() {
    var wrap = document.querySelector("[data-shuffle]");
    if (!wrap) return;
    var items = Array.prototype.slice.call(wrap.querySelectorAll(":scope > .feature"));
    if (items.length < 2) return;
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = items[i]; items[i] = items[j]; items[j] = t;
    }
    items.forEach(function (el, n) {
      wrap.appendChild(el);
      var idx = el.querySelector(".index");
      if (idx) idx.textContent = idx.textContent.replace(/№\s*\d+/, "№ " + String(n + 1).padStart(2, "0"));
    });
  }

  /* ------------------------------------------------------------------
     Background toggle (Ottografie): paper-white <-> near-black, so
     photographs can be judged on either ground. Persisted.
  ------------------------------------------------------------------ */
  function initBgToggle() {
    var btn = document.querySelector(".bg-toggle");
    if (!btn) return;
    function sync() {
      btn.setAttribute("aria-pressed", String(docEl.classList.contains("theme-dark")));
    }
    btn.addEventListener("click", function () {
      docEl.classList.toggle("theme-dark");
      try {
        localStorage.setItem("bg", docEl.classList.contains("theme-dark") ? "dark" : "light");
      } catch (e) {}
      sync();
    });
    sync();
  }

  /* ------------------------------------------------------------------
     Speculative loading: the next page is ready before it's needed.
     Chromium prerenders same-site pages on hover (Speculation Rules);
     other browsers get a hover prefetch so the post-animation fetch
     costs nothing. Either way the transition hand-off has no dead time.
  ------------------------------------------------------------------ */
  function initSpeculation() {
    if (window.HTMLScriptElement && HTMLScriptElement.supports &&
        HTMLScriptElement.supports("speculationrules")) {
      var rules = document.createElement("script");
      rules.type = "speculationrules";
      rules.textContent = JSON.stringify({
        prerender: [{ where: { href_matches: "/*" }, eagerness: "moderate" }]
      });
      document.head.appendChild(rules);
      return;
    }

    // Fallback: warm the HTTP cache on first hover of each link
    var seen = {};
    document.addEventListener("mouseover", function (e) {
      var link = e.target.closest("a[href]");
      if (!link || link.hostname !== location.hostname) return;
      var href = link.href.split("#")[0];
      if (seen[href] || href === location.href.split("#")[0]) return;
      seen[href] = true;
      var hint = document.createElement("link");
      hint.rel = "prefetch";
      hint.href = href;
      document.head.appendChild(hint);
    });
  }

  /* ------------------------------------------------------------------
     Back to top
  ------------------------------------------------------------------ */
  function initToTop() {
    document.querySelectorAll(".to-top").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (lenis) lenis.scrollTo(0);
        else window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  }

  /* ------------------------------------------------------------------
     Boot
  ------------------------------------------------------------------ */
  function init() {
    initShuffle();      // reorder before any animation reads the DOM
    var reelApi = initReel();
    initWorkToggle(reelApi); // restore saved view before triggers measure
    runIntro();
    initTransitions();

    // Scroll-driven motion lives inside gsap.matchMedia so flipping the
    // OS reduced-motion preference reverts it live, not just on reload.
    initHScroll(); // manages its own matchMedia (breakpoint + motion)

    if (hasGsap && gsap.matchMedia) {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", function () {
        initScrollAnimations();
        initProgress();
        initVelocity();
      });
    } else {
      initScrollAnimations();
      initProgress();
      initVelocity();
    }

    initListPreview();
    initJournalFilter();
    initScreensaver();
    initArchive();
    initBgToggle();
    initCursor();
    initMenu();
    initToTop();
    initSpeculation();

    // Pin/trigger distances are measured before images and fonts settle;
    // re-measure once everything has actually loaded.
    window.addEventListener("load", function () {
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
