/* ==========================================================================
   dayne.online — temporary landing page motion (brutalist / striped type)
   1. Loader: the logo spins in the middle of the page over a 000 -> 100
      counter
   2. Reveal: one giant line of heavy type ("dayne.online [logo] coming
      soon [logo]") cut into horizontal bars, like the IBM 8-bar logo. The
      bars wipe in one at a time, alternating from the left and the right.
   3. Live: the line loops forever, drifting left. Scrolling (wheel, drag,
      arrow keys) pushes it sideways with momentum. Each bar has its own
      lag, so at speed the letters shear apart along the bars, then close
      up again as the line slows.
   The logo is a box camera (the first camera: a box with a hole in it)
   drawn in the same bars: each face's bars are as thick as that face is
   lit (engraving-style shading), so it reads as 3D, and the front face
   carries a round lens. It spins slowly, and faster as you scroll. At the
   end of loading it turns to face you and the shutter clicks: the lens
   closes, the page flashes black, and the line appears.
   A click or tap (not a drag) snaps rounded focus brackets in to the
   corners of the screen, framing the whole page like a viewfinder.
   Behind it all, faint scanlines run across the page on the same raster
   as the bars (through every bar and every gap), with a slightly darker
   band rolling slowly down the screen like an old monitor's refresh.
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
  var INK = (css.getPropertyValue("--ink") || "#000000").trim();
  var FAMILY = (css.getPropertyValue("--display") || "Archivo, sans-serif").trim();
  var WEIGHT = 900;
  var TRACKING = -0.03; // em

  var NAME = "dayne.online";
  var SOON = "coming soon";
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
  var pitch = 10, thick = 6; // css px: bar spacing and thickness
  var logoXs = [], slotW = 0; // logo centres within one period; its slot
  var cubeS = 10, cubeY = 0; // the cube in the line: half-edge, centre y
  var spin = 0.6; // the cube's rotation, radians
  var shutter = 0; // 0 = lens open .. 1 = closed
  var rasterBase = 0; // screen y of the baseline: the scanlines hang off it
  var clock = 0; // ms, drives the rolling band

  /* ------------------------------------------------------------------
     The logo: a box camera in bars
  ------------------------------------------------------------------ */
  var VERTS = [];
  for (var v = 0; v < 8; v++) VERTS.push([v & 1 ? 1 : -1, v & 2 ? 1 : -1, v & 4 ? 1 : -1]);
  var FACES = [
    { q: [1, 3, 7, 5], n: [1, 0, 0] }, { q: [0, 4, 6, 2], n: [-1, 0, 0] },
    { q: [2, 6, 7, 3], n: [0, 1, 0] }, { q: [0, 1, 5, 4], n: [0, -1, 0] },
    { q: [4, 5, 7, 6], n: [0, 0, 1] }, { q: [0, 2, 3, 1], n: [0, 0, -1] }
  ];
  var TILT = 0.6; // tipped toward the viewer so the top face shows
  var LIGHT = (function (l) { var m = Math.hypot(l[0], l[1], l[2]); return [l[0] / m, l[1] / m, l[2] / m]; })([-0.3, 0.5, 0.85]); // from the front, so the lens face is the bold one

  // Spin about the vertical axis, then tilt; viewer looks down -z
  function turn(p, a) {
    var x = p[0] * Math.cos(a) + p[2] * Math.sin(a);
    var z = -p[0] * Math.sin(a) + p[2] * Math.cos(a);
    return [x, p[1] * Math.cos(TILT) - z * Math.sin(TILT), p[1] * Math.sin(TILT) + z * Math.cos(TILT)];
  }

  var FRONT = 4; // the z+ face carries the lens
  var HOLE = 0.58, GLASS = 0.24; // lens opening and the glass inside, in face units

  // A circle on the front face, turned and projected flat
  function onFront(rad, a) {
    var poly = [];
    for (var k = 0; k < 24; k++) {
      var th = k / 24 * Math.PI * 2, p = turn([rad * Math.cos(th), rad * Math.sin(th), 1], a);
      poly.push([p[0], -p[1]]);
    }
    return poly;
  }

  // The visible faces at angle a, projected flat (orthographic, unit size)
  // with how thick their bars are (0.14 in shadow .. 1 fully lit). The
  // front face also carries its lens: the opening, and the glass inside,
  // which grows to fill the opening as the shutter closes.
  function cubeFaces(a) {
    var pts = VERTS.map(function (p) { return turn(p, a); });
    var out = [];
    for (var i = 0; i < FACES.length; i++) {
      var n = turn(FACES[i].n, a);
      if (n[2] <= 0.001) continue;
      var lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      var face = { pts: FACES[i].q.map(function (k) { return [pts[k][0], -pts[k][1]]; }), weight: 0.14 + 0.86 * lit };
      if (i === FRONT) {
        face.hole = onFront(HOLE, a);
        face.glass = onFront(GLASS + (HOLE - GLASS) * shutter, a);
      }
      out.push(face);
    }
    return out;
  }

  // Where a horizontal line at height u crosses a convex polygon: [lo, hi]
  function span(poly, u) {
    var lo = Infinity, hi = -Infinity;
    for (var e = 0; e < poly.length; e++) {
      var a = poly[e], b = poly[(e + 1) % poly.length];
      if ((u - a[1]) * (u - b[1]) > 0 || a[1] === b[1]) continue;
      var x = a[0] + (b[0] - a[0]) * (u - a[1]) / (b[1] - a[1]);
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    return hi > lo ? [lo, hi] : null;
  }

  // Draw the cube's slice on one bar row: for each visible face, the span
  // where the row crosses it, as a bar as thick as the face is lit
  function cubeRow(c, faces, cx, cy, S, mid) {
    var u = (mid - cy) / S; // the row's height in cube units
    var gapD = Math.max(1, Math.round(dpr * Math.max(1, S * 0.03)));
    var yD = function (t) { return Math.round(mid * dpr - t / 2); };
    var seg = function (lo, hi, t) {
      // A hairline gap either side, so the edges between faces show
      var x1 = Math.round((cx + lo * S) * dpr) + gapD, x2 = Math.round((cx + hi * S) * dpr) - gapD;
      if (x2 > x1) c.fillRect(x1, yD(t), x2 - x1, t);
    };
    for (var i = 0; i < faces.length; i++) {
      var f = faces[i], sp = span(f.pts, u);
      if (!sp) continue;
      var t = Math.max(1, Math.round(thick * f.weight * dpr));
      var hole = f.hole && span(f.hole, u);
      if (!hole) { seg(sp[0], sp[1], t); continue; }
      // The face either side of the lens opening, then the glass in it
      seg(sp[0], hole[0], t);
      seg(hole[1], sp[1], t);
      var glass = span(f.glass, u);
      if (glass) seg(glass[0], glass[1], Math.max(t, Math.round(thick * 0.9 * dpr)));
    }
  }

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
    var wName = sctx.measureText(NAME).width, wSoon = sctx.measureText(SOON).width;
    var ascent = sctx.measureText("dl").actualBoundingBoxAscent;
    var descent = sctx.measureText("y").actualBoundingBoxDescent;
    var xh = sctx.measureText("x").actualBoundingBoxAscent;
    var pad = Math.ceil(fontPx * 0.05);
    var stripH = ascent + descent + pad * 2;
    var baseline = pad + ascent;

    // Bars are anchored so the baseline and the x-height both land on bar
    // edges; ascenders and descenders carry on at the same pitch.
    var nx = Math.max(3, Math.min(7, Math.floor(xh / 4.5)));
    pitch = xh / (nx - 1 + BAR);
    thick = pitch * BAR;
    bars = [];
    var jMin = -Math.ceil(descent / pitch), jMax = nx - 1 + Math.ceil((ascent - xh) / pitch);
    for (var j = jMax; j >= jMin; j--) {
      var top = baseline - j * pitch - thick;
      var bottom = top + thick;
      top = Math.max(0, top);
      bottom = Math.min(stripH, bottom);
      if (bottom - top > 0.5) bars.push({ top: top, height: bottom - top, j: j, mid: baseline - j * pitch - thick / 2 });
    }

    // Each bar's share of the shear: top bars lead, bottom bars trail, and
    // neighbours alternate a little so the split reads as stripes
    lags = bars.map(function (b, i) { return lags[i] || 0; });
    weights = bars.map(function (b, i) {
      var u = bars.length > 1 ? i / (bars.length - 1) : 0.5;
      return (0.5 - u) * 2 + (i % 2 ? 0.3 : -0.3);
    });

    // One period of the line: name, logo, "coming soon", logo. The cube is
    // as tall as the ascenders, sitting on the baseline.
    cubeS = ascent / 3.1;
    slotW = ascent * 1.5;
    period = wName + slotW + wSoon + slotW;
    logoXs = [wName + slotW / 2, wName + slotW + wSoon + slotW / 2];

    // Render one period of the line, plus a little extra so copies overlap
    scale = Math.min(dpr, 16000 / (period + fontPx));
    strip.width = Math.ceil((period + fontPx) * scale);
    strip.height = Math.ceil(stripH * scale);
    sctx.setTransform(scale, 0, 0, scale, 0, 0);
    setFont(sctx, fontPx);
    sctx.fillStyle = INK;
    sctx.textBaseline = "alphabetic";
    for (var p0 = 0; p0 <= period; p0 += period) {
      sctx.fillText(NAME, p0, baseline);
      sctx.fillText(SOON, p0 + wName + slotW, baseline);
    }
    trimSlivers();

    // Centre the x-height band on the screen
    stripTop = Math.round(h / 2 - (baseline - xh / 2));
    rasterBase = stripTop + baseline;
    cubeY = stripTop + baseline - ascent / 2;

    // The loader's cube, bigger, with the counter under it
    loaderS = Math.max(18, Math.min(w, h) * 0.075);
    docEl.style.setProperty("--counter-dy", Math.round(loaderS * 2.2) + "px");
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

  var loaderS = 20;

  // Scanlines: a hairline through the middle of every bar slot and every
  // gap (every slot only, where that would pack them closer than 4px),
  // faint, and a little darker inside the rolling band
  var SCAN = 0.13, BAND = 0.14; // line opacity, extra opacity in the band
  var ROLL_MS = 9000; // the band's trip from top to bottom
  function drawScanlines() {
    var step = pitch / 2 >= 4 ? pitch / 2 : pitch;
    var hair = Math.max(1, Math.round(dpr));
    var y0 = rasterBase - thick / 2; // the middle of the baseline slot
    var y = y0 - Math.ceil(y0 / step) * step;
    var bandH = h * 0.12, bandY = reduceMotion ? -1e9 : (clock % ROLL_MS) / ROLL_MS * (h + bandH * 4) - bandH * 2;
    ctx.fillStyle = INK;
    for (; y < h; y += step) {
      var d = (y - bandY) / bandH;
      ctx.globalAlpha = SCAN + BAND * Math.exp(-d * d);
      ctx.fillRect(0, Math.round(y * dpr - hair / 2), canvas.width, hair);
    }
    ctx.globalAlpha = 1;
  }

  // The loader: the cube alone in the middle, on its own bar raster
  function drawLoader() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawScanlines();
    ctx.fillStyle = INK;
    var faces = cubeFaces(spin), cy = h / 2, reach = loaderS * 1.8;
    var lp = Math.max(3.5, loaderS / 7), saved = thick;
    thick = lp * BAR;
    for (var y = cy - Math.ceil(reach / lp) * lp; y <= cy + reach; y += lp) cubeRow(ctx, faces, w / 2, cy, loaderS, y);
    thick = saved;
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
    drawScanlines();
    var W = canvas.width;
    var periodD = period * dpr;
    var f = dpr / scale; // strip px -> device px
    var faces = cubeFaces(spin);
    ctx.fillStyle = INK;

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
        // The logos riding in this copy of the line
        for (var g = 0; g < logoXs.length; g++) {
          var cx = x0 / dpr + logoXs[g];
          if (cx > -cubeS * 2 && cx < w + cubeS * 2) cubeRow(ctx, faces, cx, cubeY, cubeS, stripTop + b.mid);
        }
      }
      ctx.restore();
    }
    drawFocus();
  }

  /* ------------------------------------------------------------------
     A click: focus brackets
  ------------------------------------------------------------------ */
  var shots = []; // [{at}] while the brackets are showing
  var FOCUS = { snap: 180, fadeFrom: 520, gone: 1000 }; // ms after the click

  // One set of brackets framing the whole screen; a new click restarts it
  function shoot() {
    if (reduceMotion || !live) return;
    shots = [{ at: clock }];
  }

  // Four rounded corner brackets at the corners of the screen: they snap
  // in from just past the edges, with a touch of overshoot, hold, then fade.
  // They sit outside the links, so they frame them without touching.
  function drawFocus() {
    if (!shots.length) return;
    var e = clock - shots[0].at;
    if (e >= FOCUS.gone) { shots = []; return; }
    var inset = Math.max(10, Math.min(w, h) * 0.012);
    var arm = Math.max(28, Math.min(w, h) * 0.07);
    var round = arm * 0.28; // corner radius
    var p = Math.min(1, e / FOCUS.snap);
    // from 0.8 of an arm outside, in to the inset, a little past it, back
    var out = arm * (0.8 * Math.pow(1 - p, 3) - 0.1 * Math.sin(p * Math.PI));
    var d = inset - out;
    ctx.save();
    ctx.globalAlpha = e < FOCUS.fadeFrom ? 1 : 1 - (e - FOCUS.fadeFrom) / (FOCUS.gone - FOCUS.fadeFrom);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2 * dpr;
    ctx.lineCap = "round";
    ctx.beginPath();
    var corners = [[d, d, 1, 1], [w - d, d, -1, 1], [d, h - d, 1, -1], [w - d, h - d, -1, -1]];
    for (var i = 0; i < 4; i++) {
      var x = corners[i][0] * dpr, y = corners[i][1] * dpr, sx = corners[i][2], sy = corners[i][3];
      var a = arm * dpr;
      // along the top/bottom edge, round the corner, down/up the side
      ctx.moveTo(x + sx * a, y);
      ctx.arcTo(x, y, x, y + sy * a, round * dpr);
      ctx.lineTo(x, y + sy * a);
    }
    ctx.stroke();
    ctx.restore();
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

  var drag = null, press = null;
  window.addEventListener("pointerdown", function (e) {
    if (e.target.closest && e.target.closest("a")) return;
    drag = { x: e.clientX, y: e.clientY };
    press = { x: e.clientX, y: e.clientY, at: performance.now() };
  });
  window.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    // Sideways drags pull the line along; vertical ones scroll it
    push((Math.abs(dx) > Math.abs(dy) ? dx : -dy) * 0.35);
  });
  window.addEventListener("pointerup", function (e) {
    drag = null;
    // A press that barely moved and was quick is a click: take a photo
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8 && performance.now() - press.at < 500) {
      shoot();
    }
    press = null;
  });
  window.addEventListener("pointercancel", function () { drag = null; press = null; });

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
  var FACING = 0.45; // a three-quarter view with the lens toward us
  var SHOT = { turn: repeat ? 250 : 500, close: 110, flash: 140, open: 160 }; // ms

  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

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
    var shotAt = 0, spinFrom = 0, spinTo = 0;
    var loaded = document.readyState === "complete";
    window.addEventListener("load", function () { loaded = true; });

    function frame(now) {
      var t = now - t0;
      var k = Math.min(50, now - prev) / 16.7;
      clock = t;
      prev = now;

      if (!revealAt) {
        var p = ease(Math.min(1, t / COUNT_MS));
        if (!loaded) p = Math.min(p, 0.92);
        if (pctEl) pctEl.textContent = ("00" + Math.round(p * 100)).slice(-3);
        if (p < 1 || !shotAt) {
          spin += 0.03 * k;
          if (p >= 1) {
            // Loaded: turn the camera to face us for the shot
            shotAt = t;
            spinFrom = spin;
            spinTo = Math.ceil((spin - FACING) / (Math.PI * 2)) * Math.PI * 2 + FACING;
          }
          drawLoader();
        } else {
          // The shot: face us, the shutter closes, a black flash, it opens,
          // and the line appears
          var sh = t - shotAt;
          spin = spinFrom + (spinTo - spinFrom) * easeInOut(Math.min(1, sh / SHOT.turn));
          var c0 = SHOT.turn, c1 = c0 + SHOT.close, c2 = c1 + SHOT.open;
          shutter = sh < c0 ? 0 : sh < c1 ? (sh - c0) / SHOT.close : sh < c2 ? 1 - (sh - c1) / SHOT.open : 0;
          drawLoader();
          var fl = (sh - c1) / SHOT.flash;
          if (fl >= 0 && fl < 1) {
            ctx.globalAlpha = 1 - fl * fl;
            ctx.fillStyle = INK;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
          }
          if (sh >= c2) {
            shutter = 0;
            revealAt = t;
            docEl.classList.add("live");
          }
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
      // The cube turns slowly, and faster (either way) as the line is pushed
      spin += (0.012 - vel * 0.004) * k;

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
