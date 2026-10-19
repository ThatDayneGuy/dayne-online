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
   Sequence (the birth of the sun is the loader), all in the bar language:
   1. Void: the page fades up from black
   2. Big bang: one point flares where the sun will be and bursts into a
      cloud of bar fragments flying outward
   3. Nebula: the cloud flattens into a disc and visibly spins, inner
      fragments faster than outer ones (as orbits do), drawing inward
   4. Protostar: a core forms at the centre and grows in three heartbeat
      pulses while the last fragments spiral into it
   5. Ignition: the core collapses for a beat, then detonates: a white
      flash, three shock rings past the screen edges, the screen shakes,
      the star snaps to full size, and the sheet and the type wipe in
      slot by slot, alternating left and right
   6. Sunrise: the sun climbs slowly (8s) from behind the line to its place
      above it. Daylight spreads out from the sun in a growing circle,
      day colours inside, night outside, until the whole page is day.
   7. Live: the line loops forever, drifting left. Scrolling (wheel, drag,
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
  var sun = { x: 0, y: 0, r: 0, cur: 0, homeY: 0, startY: 0 }; // cur = radius drawn now
  var rasterBase = 0; // screen y of slot j=0's baseline edge

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
    rasterBase = base;
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
      var mid = row.top + thick / 2;
      var y0 = Math.floor(row.top * dpr) - 1, y1 = Math.ceil((row.top + thick) * dpr) + 1;
      // The slot's wipe: type and rule only (the sun exists before the sheet)
      var wipe = function () {
        c.save();
        c.beginPath();
        if (i % 2) c.rect(W * (1 - r), y0, W * r, y1 - y0);
        else c.rect(0, y0, W * r, y1 - y0);
        c.clip();
      };

      // 1. The type. Whole pixels on both sides, so no bar samples a sliver
      //    of its neighbour's row (that shows up as a hairline in the gap).
      var b = row.bar;
      if (b && r > 0) {
        if (r < 1) wipe();
        var sy = Math.round(b.top * scale);
        var sh = Math.max(1, Math.round((b.top + b.height) * scale) - sy);
        var dy = stripTopD + Math.round(sy * f);
        var dh = Math.max(1, Math.round(sh * f));
        var x = (offset - row.lag) * dpr;
        var start = ((x % periodD) + periodD) % periodD - periodD;
        for (var x0 = start; x0 < W; x0 += periodD) {
          c.drawImage(type, 0, sy, type.width, sh, Math.round(x0), dy, type.width * f, dh);
        }
        if (r < 1) c.restore();
      }

      // 2. The sun: one bar per slot it crosses, thin at the top, full at
      //    the bottom. XOR inverts the type wherever the two meet.
      var R = sun.cur, dyS = mid - sun.y;
      if (R > 0.5 && Math.abs(dyS) < R) {
        var halfW = Math.sqrt(R * R - dyS * dyS);
        var th = thick * (0.18 + 0.82 * (dyS + R) / (2 * R));
        var thD = Math.max(1, Math.round(th * dpr));
        var yD = Math.round(mid * dpr - thD / 2);
        var x1 = Math.round((sun.x - halfW - row.lag) * dpr);
        var x2 = Math.round((sun.x + halfW - row.lag) * dpr);
        c.globalCompositeOperation = "xor";
        c.fillStyle = ink;
        c.fillRect(x1, yD, x2 - x1, thD);
      }

      // 3. The rule, behind everything already in the slot
      if (r > 0 && ((row.j % ruleStep) + ruleStep) % ruleStep === 0) {
        if (r < 1) wipe();
        c.globalCompositeOperation = "destination-over";
        c.fillStyle = rule;
        c.fillRect(0, Math.round(mid * dpr - hair / 2), W, hair);
        if (r < 1) c.restore();
      }

      c.globalCompositeOperation = "source-over";
    }
  }

  /* ------------------------------------------------------------------
     The birth of the sun: specks of bar (on the raster, like everything
     else) burst out from a point, swirl back in, and a shock ring marks
     ignition. Drawn over the night scene only.
  ------------------------------------------------------------------ */
  var SPECKS = [];
  for (var n = 0; n < 220; n++) {
    SPECKS.push({
      a: n * 2.39996, // golden angle: an even spray with no clumps
      s: 0.25 + Math.random() * 0.75 // how far out it flies, 0..1 of the reach
    });
  }

  // Snap a y position to the middle of the nearest slot
  function slotMid(y) {
    var j = Math.round((rasterBase - thick / 2 - y) / pitch);
    return rasterBase - j * pitch - thick / 2;
  }

  // bar(c, ink, x1, x2, y, th): one horizontal bar in device pixels
  function bar(c, x1, x2, y, th) {
    var t = Math.max(1, Math.round(th * dpr));
    c.fillRect(Math.round(x1 * dpr), Math.round(y * dpr - t / 2), Math.max(1, Math.round((x2 - x1) * dpr)), t);
  }

  // A striped ring between radii ri and ro, centred on (cx, cy)
  function ring(c, cx, cy, ri, ro, th) {
    for (var k = 0; k < rows.length; k++) {
      var my = rows[k].top + thick / 2, dy = my - cy;
      if (Math.abs(dy) >= ro) continue;
      var ho = Math.sqrt(ro * ro - dy * dy), hi = Math.abs(dy) < ri ? Math.sqrt(ri * ri - dy * dy) : 0;
      bar(c, cx - ho, cx - hi, my, th);
      bar(c, cx + hi, cx + ho, my, th);
    }
  }

  function drawBirth(c, ink, tb) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.fillStyle = ink;
    var cx = sun.x, cy = sun.startY;
    var reach = Math.min(w, h) * 0.45;

    // Big bang: the point flares, then bursts
    if (tb >= 0 && tb < BANG.burst) {
      var fl = ease(tb / BANG.burst);
      bar(c, cx - thick * (0.5 + fl * 3), cx + thick * (0.5 + fl * 3), slotMid(cy), thick * (0.4 + fl * 0.8));
    }

    // The fragments: out (burst), round and round (nebula), in (protostar)
    var p1 = clamp((tb - BANG.burst) / BANG.out, 0, 1);
    var p2 = clamp((tb - BANG.nebula) / BANG.swirl, 0, 1);
    var p3 = clamp((tb - BANG.proto) / BANG.feed, 0, 1);
    if (tb >= BANG.burst && p3 < 1) {
      c.globalAlpha = p3 > 0.6 ? (1 - p3) / 0.4 : 1;
      var e2 = easeInOut(p2), e3 = ease(p3) * ease(p3);
      for (var i = 0; i < SPECKS.length; i++) {
        var sp = SPECKS[i];
        // Out to the edge of the cloud, then drawn in to a disc, then fed in
        var rad = sp.s * reach * ease(p1) * (1 - 0.6 * e2) * (1 - e3);
        // One direction of spin; inner orbits run faster (Kepler)
        var turns = (1.2 + 1.4 * (1 - sp.s)) * e2 + 1.5 * e3;
        var ang = sp.a + turns * Math.PI * 2;
        // The cloud flattens into a disc as it spins
        var flat = 0.85 - 0.6 * e2;
        var x = cx + Math.cos(ang) * rad, y = slotMid(cy + Math.sin(ang) * rad * flat);
        // Long streaks at the burst; in the disc, streaks along the orbit
        var len = thick * (p2 > 0 ? 0.8 + 2.4 * e2 * (1 - sp.s * 0.5) : 4.5 * (1 - p1) + 0.8);
        bar(c, x - len / 2, x + len / 2, y, thick * 0.55);
      }
      c.globalAlpha = 1;
    }

    // Ignition: three shock rings, each a little behind the last, running
    // past the edges of the screen
    var far = Math.hypot(w, h);
    for (var q = 0; q < 3; q++) {
      var p4 = clamp((tb - BANG.ignite - q * BANG.stagger) / BANG.shock, 0, 1);
      if (p4 <= 0 || p4 >= 1) continue;
      var ro = sun.r + (far - sun.r) * ease(p4);
      var band = sun.r * (0.45 - q * 0.12) * (1 - p4 * 0.6);
      c.globalAlpha = 1 - p4 * p4;
      ring(c, cx, cy, Math.max(0, ro - band), ro, thick * (0.9 - q * 0.2));
      c.globalAlpha = 1;
    }
  }

  // The protostar's radius over time: three heartbeat pulses as it feeds,
  // a collapse just before ignition, then a snap to full size
  function protoRadius(tb) {
    var r = sun.r;
    if (tb < BANG.proto) return 0;
    if (tb < BANG.ignite - BANG.collapse) {
      var g = clamp((tb - BANG.proto) / (BANG.ignite - BANG.collapse - BANG.proto), 0, 1);
      var beat = Math.pow(Math.max(0, Math.sin(g * Math.PI * 3)), 6); // three throbs
      return r * (0.12 + 0.55 * ease(g)) * (1 + 0.35 * beat);
    }
    if (tb < BANG.ignite) {
      var cp = (tb - (BANG.ignite - BANG.collapse)) / BANG.collapse;
      return r * 0.67 * (1 - 0.7 * cp * cp); // falls in on itself
    }
    var sp = clamp((tb - BANG.ignite) / BANG.snap, 0, 1);
    return r * (1 + 0.3 * Math.sin(sp * Math.PI) * (1 - sp)); // snaps out, overshoots, settles
  }

  // Daytime: the scene straight onto the page
  function drawDay(reveal) {
    drawScene(ctx, INK, RULE, reveal);
  }

  // Sunrise: night everywhere, then day inside a circle around the sun
  // `fade` 0..1 brings the night up out of black; `tb` is ms since the bang
  function drawDawn(reveal, dawnR, fade, tb) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawScene(lctx, NIGHT_INK, NIGHT_RULE, reveal);
    if (tb < BANG.ignite + BANG.shock + 300) drawBirth(lctx, NIGHT_INK, tb);
    ctx.globalAlpha = fade;
    ctx.drawImage(layer, 0, 0);
    ctx.globalAlpha = 1;

    // Ignition flash: the screen goes white and drains back to night
    var fp = (tb - BANG.ignite) / BANG.flash;
    if (fp >= 0 && fp < 1) {
      ctx.globalAlpha = 0.95 * (fp < 0.08 ? fp / 0.08 : Math.pow(1 - (fp - 0.08) / 0.92, 2));
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
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
  // The birth, in ms (a repeat visit in the same session runs it faster)
  var Q = repeat ? 0.35 : 1;
  var FADE_MS = 1000 * Q; // the void fades up
  var BANG_AT = 500 * Q; // the point appears
  // Times are ms from the bang
  var BANG = {
    burst: 350 * Q, // the point flares
    out: 900 * Q, // fragments fly outward
    nebula: 1100 * Q, // the cloud starts to spin into a disc...
    swirl: 2200 * Q, // ...for this long
    proto: 2900 * Q, // a core forms and the disc feeds into it...
    feed: 1700 * Q, // ...for this long
    collapse: 180 * Q, // the core falls in on itself before...
    ignite: 4800 * Q, // ...ignition: flash, shock rings, shake
    flash: 300 * Q,
    shock: 700 * Q,
    stagger: 70 * Q, // between the three shock rings
    shake: 280 * Q,
    snap: 300 * Q // the star snapping out to full size
  };
  var REVEAL_AT = BANG_AT + BANG.ignite + 50 * Q;
  var RISE_AT = REVEAL_AT + 200 * Q, RISE_MS = repeat ? 2500 : 8000; // the sunrise
  var DAWN_FROM = 0.2; // share of the rise before daylight starts to spread

  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  function start() {
    layout();
    offset = startOffset();

    if (reduceMotion) {
      live = true;
      sun.y = sun.homeY;
      sun.cur = sun.r;
      docEl.classList.add("day");
      drawDay();
      window.addEventListener("resize", function () { layout(); offset = startOffset(); sun.y = sun.homeY; sun.cur = sun.r; drawDay(); });
      return;
    }

    window.addEventListener("resize", layout);

    var t0 = performance.now(), prev = t0, isDay = false, shaking = false;

    function frame(now) {
      var t = now - t0;
      var k = Math.min(50, now - prev) / 16.7;
      prev = now;

      var stagger = rows.length > 1 ? SWEEP / (rows.length - 1) : 0;
      var since = t - REVEAL_AT;
      var revealing = since < SWEEP + WIPE;
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
      var tb = t - BANG_AT;
      sun.cur = protoRadius(tb);
      // The screen shakes for a moment at ignition
      var sk = (tb - BANG.ignite) / BANG.shake;
      if (sk >= 0 && sk < 1) {
        var amp = 10 * (1 - sk) * (1 - sk);
        canvas.style.transform = "translate(" + ((Math.random() - 0.5) * amp).toFixed(1) + "px," + ((Math.random() - 0.5) * amp).toFixed(1) + "px)";
        shaking = true;
      } else if (shaking) {
        canvas.style.transform = "";
        shaking = false;
      }
      var rise = clamp((t - RISE_AT) / RISE_MS, 0, 1);
      sun.y = sun.startY + (sun.homeY - sun.startY) * easeInOut(rise);
      var dawn = easeInOut(clamp((rise - DAWN_FROM) / (1 - DAWN_FROM), 0, 1));

      var reveal = revealing ? function (i) { return ease(clamp((since - i * stagger) / WIPE, 0, 1)); } : null;
      if (dawn < 1) {
        // Far enough to reach the furthest corner from the sun
        var reach = Math.max(Math.hypot(sun.x, sun.y), Math.hypot(w - sun.x, sun.y),
          Math.hypot(sun.x, h - sun.y), Math.hypot(w - sun.x, h - sun.y));
        drawDawn(reveal, dawn * reach, clamp(t / FADE_MS, 0, 1), tb);
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
