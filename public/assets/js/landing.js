/* ==========================================================================
   dayne.online — temporary landing page motion (brutalist / striped type)
   The whole page is one raster of horizontal bar slots, like the IBM
   8-bar logo stretched into a ruled sheet:
   - the line of heavy type ("dayne.online — coming soon —") is the band
     where the slots fill with letters
   - every other slot carries a faint hairline rule
   - a striped sun (bars thin at the top, full at the bottom) sits in the
     space above the line; where it crosses the type it inverts it, so the
     letters read as paper cut out of the sun
   Sequence (the sunrise is the loader):
   1. Night: the page opens dark, the sheet drawn in pale ink, and the slots
      wipe in one at a time, alternating from the left and the right
   2. Sunrise: the sun climbs slowly from behind the line to its place
      above it. Daylight spreads out from the sun in a growing circle,
      day colours inside, night outside, until the whole page is day.
   3. Live: the line loops forever, drifting left. Scrolling (wheel, drag,
      arrow keys) pushes it sideways with momentum. Each slot has its own
      lag, so at speed the letters and the sun shear apart along the bars,
      then close up as the line slows.
   The type is rendered once into an offscreen strip; each frame draws that
   strip slot by slot, so every bar edge lands on a whole device pixel.
   No dependencies. Reduced motion: straight to day, a still page, no loop.
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
  var layer = document.createElement("canvas"); // one scene, composited during sunrise
  var lctx = layer.getContext("2d");

  var css = getComputedStyle(docEl);
  function token(name, fallback) { return (css.getPropertyValue(name) || fallback).trim(); }
  var INK = token("--ink", "#0d0d0d");
  var PAPER = token("--paper", "#f2f1ec");
  var RULE = token("--rule", "rgba(13, 13, 13, 0.14)");
  var NIGHT = token("--night", "#0d0d0d");
  var NIGHT_INK = token("--night-ink", "#f2f1ec");
  var NIGHT_RULE = token("--night-rule", "rgba(242, 241, 236, 0.16)");
  var FAMILY = token("--display", "Archivo, sans-serif");
  var WEIGHT = 900;
  var TRACKING = -0.03; // em

  var NAME = "dayne.online";
  var TEXT = NAME + " — coming soon — ";
  var BAR = 0.62; // bar thickness as a share of the bar pitch (rest is gap)
  var RULE_GAP = 10; // css px: hairlines are never closer together than this

  /* ------------------------------------------------------------------
     Layout: size the type, render one period of the line into the strip,
     then lay the raster of slots over the whole screen
  ------------------------------------------------------------------ */
  var w = 0, h = 0, dpr = 1;
  var fontPx = 100, period = 0; // css px
  var scale = 1; // strip px per css px
  var pitch = 10, thick = 6; // css px: slot spacing and bar thickness
  var stripTop = 0; // css px from the top of the screen
  var bars = []; // slots that cross the type: {top, height, j}, strip-relative
  var rows = []; // every slot on screen, top to bottom: {j, top, weight, lag, bar}
  var lagByJ = {}; // keeps each slot's lag across a resize
  var ruleStep = 1;
  var offset = 0; // css px; the line's whole motion lives here
  var sun = { x: 0, y: 0, r: 0, homeY: 0, startY: 0 };

  function setFont(c, px) {
    c.font = WEIGHT + " " + px + "px " + FAMILY;
    if ("letterSpacing" in c) c.letterSpacing = (TRACKING * px) + "px";
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function layout() {
    var prevFont = fontPx;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = layer.width = Math.round(w * dpr);
    canvas.height = layer.height = Math.round(h * dpr);

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

    // Slots are anchored so the baseline and the x-height both land on bar
    // edges; ascenders and descenders carry on at the same pitch. Slot j=0
    // sits on the baseline; j counts up the page.
    var nx = clamp(Math.floor(xh / 4.5), 3, 7);
    pitch = xh / (nx - 1 + BAR);
    thick = pitch * BAR;
    bars = [];
    var byJ = {};
    var jMin = -Math.ceil(descent / pitch), jMax = nx - 1 + Math.ceil((ascent - xh) / pitch);
    for (var j = jMax; j >= jMin; j--) {
      var top = baseline - j * pitch - thick;
      var bottom = Math.min(stripH, top + thick);
      top = Math.max(0, top);
      if (bottom - top > 0.5) bars.push(byJ[j] = { top: top, height: bottom - top, j: j });
    }

    // Render one period of the line, plus a little extra so copies overlap.
    // The strip is a mask: it's drawn in whichever ink the scene needs.
    scale = Math.min(dpr, 16000 / (period + fontPx));
    strip.width = Math.ceil((period + fontPx) * scale);
    strip.height = Math.ceil(stripH * scale);
    sctx.setTransform(scale, 0, 0, scale, 0, 0);
    setFont(sctx, fontPx);
    sctx.fillStyle = "#000";
    sctx.textBaseline = "alphabetic";
    sctx.fillText(TEXT, 0, baseline);
    sctx.fillText(TEXT, period, baseline);
    trimSlivers();
    tinted = {};

    // Centre the x-height band on the screen
    stripTop = Math.round(h / 2 - (baseline - xh / 2));

    // The raster: every slot from the top of the screen to the bottom.
    // Each slot's share of the shear: slots above the middle of the type
    // lead, slots below trail (capped, so far slots move as a block), and
    // neighbours alternate a little so the split reads as stripes.
    var base = stripTop + baseline; // screen y of the baseline
    var jc = (jMax + jMin) / 2, half = Math.max(1, (jMax - jMin) / 2);
    rows = [];
    for (var k = Math.floor(base / pitch); k >= Math.ceil((base - thick - h) / pitch); k--) {
      rows.push({
        j: k,
        top: base - k * pitch - thick,
        weight: clamp((k - jc) / half, -1.5, 1.5) + (k % 2 ? 0.3 : -0.3),
        lag: lagByJ[k] || 0,
        bar: byJ[k] || null
      });
    }
    ruleStep = Math.max(1, Math.ceil(RULE_GAP / pitch));

    // The sun: centred above the type at rest; it starts low, half behind
    // the line, and rises to its place
    var typeTop = stripTop + (bars.length ? bars[0].top : 0);
    sun.r = Math.max(24, Math.min(typeTop * 0.36, w * 0.2));
    sun.x = w / 2;
    sun.homeY = typeTop / 2;
    sun.startY = h / 2 + sun.r * 0.5;
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
      var n = y1 - y0;
      if (n <= 0) continue;
      for (var x = 0; x < W; x++) {
        var ink = 0;
        for (var y = y0; y < y1; y++) ink += d[(y * W + x) * 4 + 3];
        if (ink === 0 || ink >= n * 255 * 0.5) continue;
        for (var yy = y0; yy < y1; yy++) d[(yy * W + x) * 4 + 3] = 0;
      }
    }
    sctx.putImageData(img, 0, 0);
  }

  // The strip recoloured per ink (day and night), cached until next layout
  var tinted = {};
  function tint(color) {
    if (tinted[color]) return tinted[color];
    var c = document.createElement("canvas");
    c.width = strip.width;
    c.height = strip.height;
    var x = c.getContext("2d");
    x.drawImage(strip, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return (tinted[color] = c);
  }

  // Open with "dayne.online" centred
  function startOffset() {
    setFont(sctx, fontPx);
    return (w - sctx.measureText(NAME).width) / 2;
  }

  /* ------------------------------------------------------------------
     Drawing. Slots never overlap vertically, so each one can use its own
     compositing: type first, the sun XORed over it, the rule tucked
     behind both. The scene is transparent; the page shows through.
  ------------------------------------------------------------------ */
  // reveal(i) -> 0..1 per slot; even slots wipe in from the left, odd from
  // the right. Omitted = fully shown.
  function drawScene(c, ink, rule, reveal) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, canvas.width, canvas.height);
    var W = canvas.width;
    var periodD = period * dpr;
    var f = dpr / scale; // strip px -> device px
    var hair = Math.max(1, Math.round(dpr));
    var stripTopD = Math.round(stripTop * dpr);
    var type = tint(ink);

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var r = reveal ? reveal(i) : 1;
      if (r <= 0) continue;
      var mid = row.top + thick / 2;

      var clipped = r < 1;
      if (clipped) {
        var y0 = Math.floor(row.top * dpr) - 1, y1 = Math.ceil((row.top + thick) * dpr) + 1;
        c.save();
        c.beginPath();
        if (i % 2) c.rect(W * (1 - r), y0, W * r, y1 - y0);
        else c.rect(0, y0, W * r, y1 - y0);
        c.clip();
      }

      // 1. The type. Whole pixels on both sides, so no bar samples a sliver
      //    of its neighbour's row (that shows up as a hairline in the gap).
      var b = row.bar;
      if (b) {
        var sy = Math.round(b.top * scale);
        var sh = Math.max(1, Math.round((b.top + b.height) * scale) - sy);
        var dy = stripTopD + Math.round(sy * f);
        var dh = Math.max(1, Math.round(sh * f));
        var x = (offset - row.lag) * dpr;
        var start = ((x % periodD) + periodD) % periodD - periodD;
        for (var x0 = start; x0 < W; x0 += periodD) {
          c.drawImage(type, 0, sy, type.width, sh, Math.round(x0), dy, type.width * f, dh);
        }
      }

      // 2. The sun: one bar per slot it crosses, thin at the top, full at
      //    the bottom. XOR inverts the type wherever the two meet.
      var dyS = mid - sun.y;
      if (Math.abs(dyS) < sun.r) {
        var halfW = Math.sqrt(sun.r * sun.r - dyS * dyS);
        var th = thick * (0.18 + 0.82 * (dyS + sun.r) / (2 * sun.r));
        var thD = Math.max(1, Math.round(th * dpr));
        var yD = Math.round(mid * dpr - thD / 2);
        var x1 = Math.round((sun.x - halfW - row.lag) * dpr);
        var x2 = Math.round((sun.x + halfW - row.lag) * dpr);
        c.globalCompositeOperation = "xor";
        c.fillStyle = ink;
        c.fillRect(x1, yD, x2 - x1, thD);
      }

      // 3. The rule, behind everything already in the slot
      if (((row.j % ruleStep) + ruleStep) % ruleStep === 0) {
        c.globalCompositeOperation = "destination-over";
        c.fillStyle = rule;
        c.fillRect(0, Math.round(mid * dpr - hair / 2), W, hair);
      }

      c.globalCompositeOperation = "source-over";
      if (clipped) c.restore();
    }
  }

  // Daytime: the scene straight onto the page
  function drawDay(reveal) {
    drawScene(ctx, INK, RULE, reveal);
  }

  // Sunrise: night everywhere, then day inside a circle around the sun
  function drawDawn(reveal, dawnR) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawScene(lctx, NIGHT_INK, NIGHT_RULE, reveal);
    ctx.drawImage(layer, 0, 0);
    if (dawnR <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sun.x * dpr, sun.y * dpr, dawnR * dpr, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawScene(lctx, INK, RULE, reveal);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }

  /* ------------------------------------------------------------------
     Input: scroll -> sideways momentum
  ------------------------------------------------------------------ */
  var DRIFT = -0.55; // px per frame at rest, right to left
  var vel = 0; // extra px per frame from the visitor
  var live = false;

  function push(dx) {
    if (!live) return;
    vel = clamp(vel + dx, -90, 90);
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
  var repeat = false;
  try { repeat = !!sessionStorage.getItem("booted"); sessionStorage.setItem("booted", "1"); } catch (e) {}
  var WIPE = 650, SWEEP = 900; // ms per slot wipe; ms from first to last slot
  var RISE_AT = repeat ? 200 : 500, RISE_MS = repeat ? 1800 : 5000; // the sunrise
  var DAWN_FROM = 0.2; // share of the rise before daylight starts to spread

  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  function start() {
    layout();
    offset = startOffset();

    if (reduceMotion) {
      live = true;
      sun.y = sun.homeY;
      docEl.classList.add("day");
      drawDay();
      window.addEventListener("resize", function () { layout(); offset = startOffset(); sun.y = sun.homeY; drawDay(); });
      return;
    }

    window.addEventListener("resize", layout);

    var t0 = performance.now(), prev = t0, isDay = false;

    function frame(now) {
      var t = now - t0;
      var k = Math.min(50, now - prev) / 16.7;
      prev = now;

      var stagger = rows.length > 1 ? SWEEP / (rows.length - 1) : 0;
      var revealing = t < SWEEP + WIPE;
      if (!revealing) live = true;

      // Momentum eases back to the resting drift
      vel *= Math.pow(0.95, k);
      if (Math.abs(vel) < 0.01) vel = 0;
      offset += (DRIFT + vel) * k;

      // Each slot chases its share of the speed, so they shear and re-close
      var limit = w * 0.3, follow = Math.min(1, 0.15 * k);
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        row.lag += (clamp(vel * row.weight * 4, -limit, limit) - row.lag) * follow;
        lagByJ[row.j] = row.lag;
      }

      // The sun climbs from behind the line; daylight spreads from it
      var rise = clamp((t - RISE_AT) / RISE_MS, 0, 1);
      sun.y = sun.startY + (sun.homeY - sun.startY) * easeInOut(rise);
      var dawn = easeInOut(clamp((rise - DAWN_FROM) / (1 - DAWN_FROM), 0, 1));

      var reveal = revealing ? function (i) { return ease(clamp((t - i * stagger) / WIPE, 0, 1)); } : null;
      if (dawn < 1) {
        // Far enough to reach the furthest corner from the sun
        var reach = Math.max(Math.hypot(sun.x, sun.y), Math.hypot(w - sun.x, sun.y),
          Math.hypot(sun.x, h - sun.y), Math.hypot(w - sun.x, h - sun.y));
        drawDawn(reveal, dawn * reach);
      } else {
        if (!isDay) { isDay = true; docEl.classList.add("day"); }
        drawDay(reveal);
      }
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
