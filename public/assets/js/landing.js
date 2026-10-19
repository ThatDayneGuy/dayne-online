/* ==========================================================================
   dayne.online — temporary landing page motion (pixel / cyberpunk)
   One canvas, one list of pixel particles:
   1. Boot: the pixel "D" logo flickers on while the loader bar fills
   2. Morph: the logo bursts and its pixels fly into "Dayne.online"
   3. Live: pixels spring home, scatter away from the pointer, and the
      title glitches (RGB split + sliced rows) every few seconds
   Moving pixels leave cyan/magenta fringes proportional to their speed.
   No dependencies. Reduced motion: no loader, static title, no loop.
   ========================================================================== */

(function () {
  "use strict";

  window.__landing = true;
  var docEl = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var canvas = document.querySelector("[data-screen]");
  if (!canvas || !canvas.getContext) { docEl.classList.remove("js"); return; }
  var ctx = canvas.getContext("2d");

  var css = getComputedStyle(docEl);
  function token(name, fallback) { return (css.getPropertyValue(name) || fallback).trim(); }
  var INK = token("--ink", "#eaf6ff");
  var CYAN = token("--cyan", "#00e5ff");
  var MAGENTA = token("--magenta", "#ff2bd6");

  /* ------------------------------------------------------------------
     Bitmaps. Glyphs sit on a 9-row grid: rows 0-1 ascender, 2-6 x-height,
     7-8 descender. "#" is a lit pixel.
  ------------------------------------------------------------------ */
  var GLYPHS = {
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "a": ["", "", ".###.", "....#", ".####", "#...#", ".####"],
    "y": ["", "", "#...#", "#...#", "#...#", "#...#", ".####", "....#", ".###."],
    "n": ["", "", "####.", "#...#", "#...#", "#...#", "#...#"],
    "e": ["", "", ".###.", "#...#", "#####", "#....", ".####"],
    ".": ["", "", "", "", "", "", "#"],
    "o": ["", "", ".###.", "#...#", "#...#", "#...#", ".###."],
    "l": ["##.", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
    "i": [".#.", "", "##.", ".#.", ".#.", ".#.", "###"]
  };
  var WIDTHS = { ".": 1, "l": 3, "i": 3 };
  var TEXT = "Dayne.online";
  var TEXT_ROWS = 9;
  var LINE_GAP = 3; // empty rows between stacked lines

  // The boot logo: a heavy pixel D with a cut-out counter
  var LOGO = [
    "##########..",
    "##########..",
    "##......###.",
    "##......###.",
    "##..##...###",
    "##..##...###",
    "##..##...###",
    "##..##...###",
    "##......###.",
    "##......###.",
    "##########..",
    "#########..."
  ];

  // Lay out one or more lines of text as cells, each line centred.
  // Both layouts emit the same pixels in the same order, so particles
  // can switch between them on resize.
  function textCells(lines) {
    var cells = [], widths = [], maxW = 0;
    lines.forEach(function (line, li) {
      var col = 0, start = cells.length;
      for (var c = 0; c < line.length; c++) {
        var g = GLYPHS[line[c]], gw = WIDTHS[line[c]] || 5;
        for (var r = 0; r < g.length; r++) {
          for (var x = 0; x < g[r].length; x++) {
            if (g[r][x] === "#") cells.push({ c: col + x, r: r + li * (TEXT_ROWS + LINE_GAP), line: li });
          }
        }
        col += gw + 1;
      }
      widths.push(col - 1);
      maxW = Math.max(maxW, col - 1);
    });
    cells.forEach(function (cell) { cell.c += Math.round((maxW - widths[cell.line]) / 2); });
    return { cells: cells, cols: maxW, rows: lines.length * (TEXT_ROWS + LINE_GAP) - LINE_GAP, lines: lines.length };
  }

  function logoCells() {
    var cells = [];
    for (var r = 0; r < LOGO.length; r++) {
      for (var x = 0; x < LOGO[r].length; x++) {
        if (LOGO[r][x] === "#") cells.push({ c: x, r: r });
      }
    }
    return cells;
  }

  var WIDE = textCells([TEXT]);
  var STACKED = textCells(["Dayne", ".online"]); // narrow portrait screens
  var TXT = WIDE;
  var LOGO_CELLS = logoCells();

  /* ------------------------------------------------------------------
     Layout
  ------------------------------------------------------------------ */
  var w = 0, h = 0, dpr = 1;
  var cs = 8, ox = 0, oy = 0; // title cell size + origin
  var ls = 10, lx = 0, ly = 0; // logo cell size + origin

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    TXT = w < 640 && h > w ? STACKED : WIDE;
    var gutter = Math.max(16, w * 0.025);
    cs = Math.floor(Math.min((w - gutter * 2) * 0.88 / TXT.cols, h * 0.16 * TXT.lines / TXT.rows * 1.3, 24));
    cs = Math.max(cs, 3);
    ox = Math.round((w - TXT.cols * cs) / 2);
    oy = Math.round(h / 2 - (TXT.rows - 2) / 2 * cs);

    ls = Math.max(5, Math.min(14, Math.floor(Math.min(w, h) * 0.2 / 12)));
    lx = Math.round(w / 2 - 6 * ls);
    ly = Math.round(h * 0.42 - 6 * ls);

    docEl.style.setProperty("--tag-top", (oy + TXT.rows * cs + Math.max(18, cs * 1.4)) + "px");
    docEl.style.setProperty("--logo-bottom", (ly + 12 * ls + 28) + "px");

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.cell = TXT.cells[i];
      p.hx = ox + p.cell.c * cs;
      p.hy = oy + p.cell.r * cs;
    }
  }

  /* ------------------------------------------------------------------
     Particles: one per title pixel. During boot each one is parked on a
     logo pixel (several share one), so the logo is the title, folded up.
  ------------------------------------------------------------------ */
  var parts = WIDE.cells.map(function (cell, i) {
    var lc = LOGO_CELLS[i % LOGO_CELLS.length];
    return {
      cell: cell, logo: lc,
      x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0,
      on: Math.random() * 1100 + 100, // boot: when this pixel flickers on
      release: 0, // morph: when it leaves the logo
      shift: 0 // glitch: horizontal slice offset
    };
  });

  layout();

  /* ------------------------------------------------------------------
     Pointer
  ------------------------------------------------------------------ */
  var pointer = { x: -9999, y: -9999, down: false };
  window.addEventListener("pointermove", function (e) { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  window.addEventListener("pointerdown", function (e) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.down = true; }, { passive: true });
  window.addEventListener("pointerup", function () { pointer.down = false; if (pointer.touch) pointer.x = pointer.y = -9999; });
  window.addEventListener("pointercancel", function () { pointer.down = false; });
  document.addEventListener("pointerleave", function () { pointer.x = pointer.y = -9999; });
  window.addEventListener("touchstart", function () { pointer.touch = true; }, { passive: true, once: true });

  /* ------------------------------------------------------------------
     DOM helpers: loader bar, clock, typed tagline
  ------------------------------------------------------------------ */
  var segs = document.querySelectorAll(".loader-bar i");
  var pctEl = document.querySelector("[data-pct]");
  function setProgress(p) {
    var lit = Math.round(p * segs.length);
    for (var i = 0; i < segs.length; i++) segs[i].classList.toggle("on", i < lit);
    if (pctEl) pctEl.textContent = ("00" + Math.round(p * 100)).slice(-3) + "%";
  }

  var clockEl = document.querySelector("[data-clock]");
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function tick() {
    var d = new Date();
    if (clockEl) clockEl.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
  tick();
  setInterval(tick, 1000);

  var typeEl = document.querySelector("[data-type]");
  var typeText = typeEl ? typeEl.textContent : "";
  function typeOut() {
    if (!typeEl) return;
    var i = 0;
    typeEl.textContent = "";
    var id = setInterval(function () {
      i++;
      typeEl.textContent = typeText.slice(0, i);
      if (i >= typeText.length) clearInterval(id);
    }, 55);
  }

  /* ------------------------------------------------------------------
     Drawing
  ------------------------------------------------------------------ */
  var glitch = { until: 0, next: 0, split: 0 };

  function drawPixel(x, y, size, split) {
    if (split > 0.4) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = CYAN;
      ctx.fillRect(x - split, y, size, size);
      ctx.fillStyle = MAGENTA;
      ctx.fillRect(x + split, y, size, size);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.fillStyle = INK;
    ctx.fillRect(x, y, size, size);
  }

  function clear() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
  }

  // Boot frame: logo pixels flicker on, then the logo glitches at 100%
  function drawBoot(t, done) {
    clear();
    var size = ls - Math.max(1, Math.round(ls * 0.14));
    var seen = {};
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var key = p.logo.c + "," + p.logo.r;
      if (seen[key]) continue;
      seen[key] = true;
      if (t < p.on) continue;
      // Each pixel stutters for ~150ms as it comes on
      if (t - p.on < 150 && Math.random() < 0.5) continue;
      var jitter = done && Math.random() < 0.15 ? (Math.random() - 0.5) * ls * 3 : 0;
      drawPixel(lx + p.logo.c * ls + jitter, ly + p.logo.r * ls, size, done ? ls * 0.4 : 0);
    }
  }

  // Live frame: physics + glitch + draw
  function drawLive(t, dt) {
    clear();
    var size = cs - Math.max(1, Math.round(cs * 0.14));
    var R = cs * (pointer.down ? 11 : 7);
    var k = Math.min(dt / 16.7, 3);

    if (t > glitch.next) {
      glitch.until = t + 90 + Math.random() * 120;
      glitch.next = t + 2500 + Math.random() * 3500;
      glitch.split = cs * (0.4 + Math.random() * 0.8);
      // Slice a couple of row bands sideways
      var a = Math.floor(Math.random() * TXT.rows), b = a + 1 + Math.floor(Math.random() * 3);
      var s = (Math.random() < 0.5 ? -1 : 1) * cs * (1 + Math.floor(Math.random() * 3));
      for (var g = 0; g < parts.length; g++) {
        parts[g].shift = parts[g].cell.r >= a && parts[g].cell.r < b ? s : 0;
      }
    }
    var glitching = t < glitch.until;

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (t < p.release) {
        // Still folded into the logo, waiting for its turn to fly
        p.x = lx + p.logo.c * ls;
        p.y = ly + p.logo.r * ls;
        drawPixel(p.x, p.y, ls - 1, 0);
        continue;
      }

      // Spring toward home
      p.vx += (p.hx - p.x) * 0.06 * k;
      p.vy += (p.hy - p.y) * 0.06 * k;

      // Scatter away from the pointer
      var dx = p.x + cs / 2 - pointer.x, dy = p.y + cs / 2 - pointer.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < R * R) {
        var d = Math.sqrt(d2) || 1;
        var f = Math.pow(1 - d / R, 2) * cs * 0.9 * k;
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
      }

      var damp = Math.pow(0.8, k);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * k;
      p.y += p.vy * k;

      var speed = Math.abs(p.vx) + Math.abs(p.vy);
      var split = Math.min(speed * 0.35, cs * 1.4) + (glitching ? glitch.split : 0);
      var sx = glitching ? p.shift : 0;
      // A stray dead pixel now and then, like a tired panel
      if (Math.random() < 0.0015) continue;
      drawPixel(p.x + sx, p.y, size, split);
    }
  }

  /* ------------------------------------------------------------------
     Reduced motion: draw the title once, show everything, stop.
  ------------------------------------------------------------------ */
  function settle() {
    for (var i = 0; i < parts.length; i++) {
      parts[i].x = parts[i].hx;
      parts[i].y = parts[i].hy;
      parts[i].vx = parts[i].vy = 0;
      parts[i].release = 0;
    }
  }

  if (reduceMotion) {
    docEl.classList.add("live");
    settle();
    drawLive(0, 16.7);
    window.addEventListener("resize", function () { layout(); settle(); drawLive(0, 16.7); });
    return;
  }

  window.addEventListener("resize", layout);

  /* ------------------------------------------------------------------
     Sequence
  ------------------------------------------------------------------ */
  var repeat = false;
  try { repeat = !!sessionStorage.getItem("booted"); sessionStorage.setItem("booted", "1"); } catch (e) {}
  var BOOT_MS = repeat ? 900 : 2300;
  if (repeat) parts.forEach(function (p) { p.on *= 0.4; });

  var loaded = document.readyState === "complete";
  window.addEventListener("load", function () { loaded = true; });

  var phase = "boot", t0 = performance.now(), prev = t0, doneAt = 0, morphAt = 0;
  docEl.classList.add("booting");

  function ease(x) { return 1 - Math.pow(1 - x, 3); }

  function startMorph(now) {
    phase = "live";
    morphAt = now - t0;
    var left = ox, span = TXT.cols * cs;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.x = lx + p.logo.c * ls;
      p.y = ly + p.logo.r * ls;
      // Burst outward from the logo centre, released left-to-right
      var ang = Math.atan2(p.y - (ly + 6 * ls), p.x - (lx + 6 * ls));
      var kick = 6 + Math.random() * 14;
      p.vx = Math.cos(ang) * kick;
      p.vy = Math.sin(ang) * kick;
      p.release = morphAt + ((p.hx - left) / span) * 420 + Math.random() * 120;
    }
    glitch.next = morphAt + 2200;
    docEl.classList.remove("booting");
    docEl.classList.add("live");
    setTimeout(typeOut, 700);
  }

  function frame(now) {
    var t = now - t0;
    var dt = Math.min(50, now - prev);
    prev = now;

    if (phase === "boot") {
      var p = ease(Math.min(1, t / BOOT_MS));
      if (!loaded) p = Math.min(p, 0.92);
      setProgress(p);
      if (p >= 1 && !doneAt) doneAt = t;
      drawBoot(t, doneAt && t - doneAt > 120);
      if (doneAt && t - doneAt > 380) startMorph(now);
    } else {
      drawLive(t, dt);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
