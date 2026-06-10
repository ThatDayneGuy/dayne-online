/* ==========================================================================
   dayne.online — motion engine
   Built on GSAP + ScrollTrigger + Lenis (loaded from CDN).
   Everything degrades gracefully: if JS or the CDN fails, the site is a
   plain, fully readable static page.
   ========================================================================== */

(function () {
  "use strict";

  var docEl = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  /* ------------------------------------------------------------------
     Text splitting helpers
  ------------------------------------------------------------------ */
  function splitChars(el) {
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

  function splitWords(el) {
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

  function runPreloader() {
    var pre = document.querySelector(".preloader");
    var isFirstVisit = false;
    try {
      isFirstVisit = !sessionStorage.getItem("visited");
    } catch (e) { /* storage unavailable */ }

    if (!pre || !isFirstVisit || reduceMotion || !hasGsap) {
      if (pre) pre.remove();
      docEl.classList.remove("preload");
      if (hasGsap && !reduceMotion) heroIntro(0.1);
      return;
    }

    try { sessionStorage.setItem("visited", "1"); } catch (e) {}
    if (lenis) lenis.stop();

    var countEl = pre.querySelector(".preloader-count");
    var counter = { v: 0 };
    var tl = gsap.timeline({
      onComplete: function () {
        pre.remove();
        docEl.classList.remove("preload");
        if (lenis) lenis.start();
      }
    });

    tl.to(counter, {
      v: 100,
      duration: 1.6,
      ease: "power2.inOut",
      onUpdate: function () {
        if (countEl) countEl.textContent = String(Math.round(counter.v)).padStart(3, "0");
      }
    });
    tl.to(pre, {
      clipPath: "inset(0 0 100% 0)",
      duration: 1,
      ease: "expo.inOut",
      onStart: function () {
        heroIntro(0.55);
      }
    });
  }

  /* ------------------------------------------------------------------
     Page transitions (wipe out on internal links, wipe in on arrival)
  ------------------------------------------------------------------ */
  function initTransitions() {
    var overlay = document.querySelector(".transition");
    if (!overlay || !hasGsap || reduceMotion) {
      docEl.classList.remove("pt-in");
      return;
    }
    var panels = overlay.querySelectorAll("span");

    // Arriving mid-transition: sweep the cover away
    if (docEl.classList.contains("pt-in")) {
      gsap.to(panels, {
        scaleY: 0,
        transformOrigin: "top",
        duration: 0.85,
        ease: "expo.inOut",
        stagger: 0.06,
        delay: 0.1,
        onComplete: function () {
          docEl.classList.remove("pt-in");
        }
      });
    }

    document.addEventListener("click", function (e) {
      var link = e.target.closest("a");
      if (!link) return;
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) === "#" || link.target === "_blank") return;
      if (/^(mailto:|tel:|https?:\/\/)/.test(href) && link.hostname !== location.hostname) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      e.preventDefault();
      try { sessionStorage.setItem("pt", "1"); } catch (err) {}
      gsap.to(panels, {
        scaleY: 1,
        transformOrigin: "bottom",
        duration: 0.7,
        ease: "expo.inOut",
        stagger: 0.06,
        onComplete: function () {
          location.href = href;
        }
      });
    });

    // Restore state when coming back via bfcache
    window.addEventListener("pageshow", function (e) {
      if (e.persisted) {
        gsap.set(panels, { scaleY: 0 });
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

    // Image curtain reveal
    document.querySelectorAll("[data-reveal-img]").forEach(function (frame) {
      var img = frame.querySelector("img");
      var tl = gsap.timeline({
        scrollTrigger: { trigger: frame, start: "top 85%", once: true }
      });
      tl.fromTo(frame,
        { clipPath: "inset(100% 0% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "expo.inOut" }
      );
      // parallax owns the img transform on those frames — don't fight it
      if (img && !frame.hasAttribute("data-parallax")) {
        tl.from(img, { scale: 1.25, duration: 1.3, ease: "expo.inOut" }, 0);
      }
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
    runPreloader();
    initTransitions();
    initScrollAnimations();
    initListPreview();
    initCursor();
    initMenu();
    initToTop();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
