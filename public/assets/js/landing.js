/* ==========================================================================
   dayne.online — temporary landing page motion (brutalist / striped type)
   1. Counter: 000 -> 100 in the middle of the page
   2. Reveal: one giant line of heavy type ("dayne.online — coming soon —")
      cut into horizontal bars, like the IBM 8-bar logo. The bars wipe in
      one at a time, alternating from the left and the right.
   3. Live: the line loops forever, drifting left. Scrolling (wheel, drag,
      arrow keys) pushes it sideways with momentum. Each bar has its own
      lag, so at speed the letters shear apart along the bars, then close
      up again as the line slows.
   The type is rendered once into an offscreen strip; each frame draws that
   strip bar by bar, so every bar edge lands on a whole device pixel.
   No dependencies. Reduced motion: no counter, a still line, no loop.
   ========================================================================== */

(function () {
  "use strict";

  window.__landing = true;
  var docEl = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var canvas = document.querySelector("[data-screen]");
  if (!canvas || !canvas.getContext) { docEl.classList.remove("js"); return; }
  var ctx = canvas.getContext("2d");
  var strip = document.createElement("canvas");
  var sctx = strip.getContext("2d");

  var css = getComputedStyle(docEl);
  var INK = (css.getPropertyValue("--ink") || "#0d0d0d").trim();
  var FAMILY = (css.getPropertyValue("--display") || "Archivo, sans-serif").trim();
  var WEIGHT = 900;
  var TRACKING = -0.03; // em

  var NAME = "dayne.online";
  var TEXT = NAME + " — coming soon — ";
  var BAR = 0.62; // bar thickness as a share of the bar pitch (rest is gap)

  /* ------------------------------------------------------------------
     Layout: size the type, render one period of the line into the strip,
     and work out the bars
  ------------------------------------------------------------------ */
  var w = 0, h = 0, dpr = 1;
  var fontPx = 100, period = 0; // css px
  var scale = 1; // strip px per css px
  var bars = []; // {top, height} in css px, relative to the strip's top
  var stripTop = 0; // css px from the top of the screen
  var offset = 0; // css px; the line's whole motion lives here
  var lags = [], weights = [];

  function setFont(c, px) {
    c.font = WEIGHT + " " + px + "px " + FAMILY;
    if ("letterSpacing" in c) c.letterSpacing = (TRACKING * px) + "px";
  }

  function layout() {
    var prevFont = fontPx;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    // Big, but never so big that "dayne.online" can't fit the opening frame
    setFont(sctx, 100);
    var name100 = sctx.measureText(NAME).width;
    fontPx = Math.floor(Math.min(h * 0.26, (w * 0.9 * 100) / name100));
    offset *= fontPx / prevFont;

    setFont(sctx, fontPx);
    period = sctx.measureText(TEXT).width;
    var ascent = sctx.measureText("dl").actualBoundingBoxAscent;
    var descent = sctx.measureText("y").actualBoundingBoxDescent;
    var xh = sctx.measureText("x").actualBoundingBoxAscent;
    var pad = Math.ceil(fontPx * 0.05);
    var stripH = ascent + descent + pad * 2;
    var baseline = pad + ascent;

    // Bars are anchored so the baseline and the x-height both land on bar
    // edges; ascenders and descenders carry on at the same pitch.
    var nx = Math.max(3, Math.min(7, Math.floor(xh / 4.5)));
    var pitch = xh / (nx - 1 + BAR);
    var thick = pitch * BAR;
    bars = [];
    var jMin = -Math.ceil(descent / pitch), jMax = nx - 1 + Math.ceil((ascent - xh) / pitch);
    for (var j = jMax; j >= jMin; j--) {
      var top = baseline - j * pitch - thick;
      var bottom = top + thick;
      top = Math.max(0, top);
      bottom = Math.min(stripH, bottom);
      if (bottom - top > 0.5) bars.push({ top: top, height: bottom - top, j: j });
    }

    // Each bar's share of the shear: top bars lead, bottom bars trail, and
    // neighbours alternate a little so the split reads as stripes
    lags = bars.map(function (b, i) { return lags[i] || 0; });
    weights = bars.map(function (b, i) {
      var u = bars.length > 1 ? i / (bars.length - 1) : 0.5;
      return (0.5 - u) * 2 + (i % 2 ? 0.3 : -0.3);
    });

    // Render one period of the line, plus a little extra so copies overlap
    scale = Math.min(dpr, 16000 / (period + fontPx));
    strip.width = Math.ceil((period + fontPx) * scale);
    strip.height = Math.ceil(stripH * scale);
    sctx.setTransform(scale, 0, 0, scale, 0, 0);
    setFont(sctx, fontPx);
    sctx.fillStyle = INK;
    sctx.textBaseline = "alphabetic";
    sctx.fillText(TEXT, 0, baseline);
    sctx.fillText(TEXT, period, baseline);
    trimSlivers();

    // Centre the x-height band on the screen
    stripTop = Math.round(h / 2 - (baseline - xh / 2));
  }

  // Trim slivers: where a letter edge falls just inside a bar (the top of a
  // full stop, the overshoot of an "o"), that bar would keep a strip only a
  // few pixels tall, which reads as a stray hairline. Any column covering
  // less than half of its bar is cleared; everything else keeps the
  // letter's real shape.
  function trimSlivers() {
    var W = strip.width, img = sctx.getImageData(0, 0, W, strip.height), d = img.data;
    for (var i = 0; i < bars.length; i++) {
      var y0 = Math.round(bars[i].top * scale);
      var y1 = Math.min(strip.height, Math.round((bars[i].top + bars[i].height) * scale));
      var rows = y1 - y0;
      if (rows <= 0) continue;
      for (var x = 0; x < W; x++) {
        var ink = 0;
        for (var y = y0; y < y1; y++) ink += d[(y * W + x) * 4 + 3];
        if (ink === 0 || ink >= rows * 255 * 0.5) continue;
        for (var yy = y0; yy < y1; yy++) d[(yy * W + x) * 4 + 3] = 0;
      }
    }
    sctx.putImageData(img, 0, 0);
  }

  // Open with "dayne.online" centred
  function startOffset() {
    setFont(sctx, fontPx);
    return (w - sctx.measureText(NAME).width) / 2;
  }

  /* ------------------------------------------------------------------
     Drawing
  ------------------------------------------------------------------ */
  // reveal(i) -> 0..1 per bar; even bars wipe in from the left, odd from
  // the right. Omitted = fully shown.
  function draw(reveal) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var W = canvas.width;
    var periodD = period * dpr;
    var f = dpr / scale; // strip px -> device px

    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      var r = reveal ? reveal(i) : 1;
      if (r <= 0) continue;

      // Whole pixels on both sides, so no bar samples a sliver of its
      // neighbour's row (that shows up as a hairline in the gap)
      var sy = Math.round(b.top * scale);
      var sh = Math.max(1, Math.round((b.top + b.height) * scale) - sy);
      var dy = Math.round(stripTop * dpr) + Math.round(sy * f);
      var dh = Math.max(1, Math.round(sh * f));

      ctx.save();
      if (r < 1) {
        ctx.beginPath();
        if (i % 2) ctx.rect(W * (1 - r), dy, W * r, dh);
        else ctx.rect(0, dy, W * r, dh);
        ctx.clip();
      }
      var x = (offset - lags[i]) * dpr;
      var base = ((x % periodD) + periodD) % periodD - periodD;
      for (var x0 = base; x0 < W; x0 += periodD) {
        ctx.drawImage(strip, 0, sy, strip.width, sh, Math.round(x0), dy, strip.width * f, dh);
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------
     Scroll input -> sideways momentum
  ------------------------------------------------------------------ */
  var DRIFT = -0.55; // px per frame at rest, right to left
  var vel = 0; // extra px per frame from the visitor
  var live = false;

  function push(dx) {
    if (!live) return;
    vel = Math.max(-90, Math.min(90, vel + dx));
  }

  window.addEventListener("wheel", function (e) {
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (e.deltaMode === 1) d *= 16; // lines -> px
    push(-d * 0.045);
  }, { passive: true });

  var drag = null;
  window.addEventListener("pointerdown", function (e) {
    if (e.target.closest && e.target.closest("a")) return;
    drag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    // Sideways drags pull the line along; vertical ones scroll it
    push((Math.abs(dx) > Math.abs(dy) ? dx : -dy) * 0.35);
  });
  window.addEventListener("pointerup", function () { drag = null; });
  window.addEventListener("pointercancel", function () { drag = null; });

  window.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " ") push(-14);
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") push(14);
  });

  /* ------------------------------------------------------------------
     Sequence
  ------------------------------------------------------------------ */
  var pctEl = document.querySelector("[data-pct]");
  var repeat = false;
  try { repeat = !!sessionStorage.getItem("booted"); sessionStorage.setItem("booted", "1"); } catch (e) {}
  var COUNT_MS = repeat ? 500 : 1400;
  var STAGGER = 45, WIPE = 650;

  function ease(x) { return 1 - Math.pow(1 - x, 3); }

  function start() {
    layout();
    offset = startOffset();

    if (reduceMotion) {
      live = true;
      docEl.classList.add("live");
      draw();
      window.addEventListener("resize", function () { layout(); offset = startOffset(); draw(); });
      return;
    }

    window.addEventListener("resize", layout);

    var t0 = performance.now(), prev = t0, revealAt = 0;
    var loaded = document.readyState === "complete";
    window.addEventListener("load", function () { loaded = true; });

    function frame(now) {
      var t = now - t0;
      var k = Math.min(50, now - prev) / 16.7;
      prev = now;

      if (!revealAt) {
        var p = ease(Math.min(1, t / COUNT_MS));
        if (!loaded) p = Math.min(p, 0.92);
        if (pctEl) pctEl.textContent = ("00" + Math.round(p * 100)).slice(-3);
        if (p >= 1) {
          revealAt = t + 120;
          docEl.classList.add("live");
        }
        requestAnimationFrame(frame);
        return;
      }

      var since = t - revealAt;
      var revealing = since < (bars.length - 1) * STAGGER + WIPE;
      if (!revealing) live = true;

      // Momentum eases back to the resting drift
      vel *= Math.pow(0.95, k);
      if (Math.abs(vel) < 0.01) vel = 0;
      offset += (DRIFT + vel) * k;

      // Each bar chases its share of the speed, so they shear and re-close
      var limit = w * 0.3;
      for (var i = 0; i < bars.length; i++) {
        var target = Math.max(-limit, Math.min(limit, vel * weights[i] * 4));
        lags[i] += (target - lags[i]) * Math.min(1, 0.15 * k);
      }

      draw(revealing ? function (i) { return ease(Math.max(0, Math.min(1, (since - i * STAGGER) / WIPE))); } : null);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // The canvas needs the display face loaded before it can set the type
  var fontReady = document.fonts && document.fonts.load
    ? document.fonts.load(WEIGHT + " 100px " + FAMILY)
    : Promise.resolve();
  Promise.race([fontReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(start, start);
})();
