/* ==========================================================================
   dayne.online — temporary landing page motion (green-phosphor terminal)
   One canvas:
   1. Boot: the pixel "D" logo flickers on while a percentage counts up
   2. Burst: the logo's pixels fly out and settle into one giant line of
      pixel text ("dayne.online — coming soon —", endlessly repeated)
   3. Live: the line loops forever, drifting left. Scrolling (wheel, drag,
      arrow keys) pushes it sideways with momentum; the faster it moves the
      longer its phosphor trail and the more pixel dust it sheds below.
      Every few seconds it glitches (sliced rows, ghosting, a hold slip).

   Pixels are drawn the way a monochrome CRT drew them, not as squares:
   - each pixel row is 2-3 sweeps of the electron beam (scanlines) with
     dark gaps between them, on one fixed raster
   - lit pixels side by side merge into one continuous beam run, with
     soft round ends where the beam switches on and off
   - the beam has a hot core and a soft skirt that bleeds into the gaps
   - horizontal position is analog (smooth); vertical snaps to scanlines
   No dependencies. Reduced motion: no loader, a still line, no loop.
   ========================================================================== */

(function () {
  "use strict";

  window.__landing = true;
  var docEl = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var canvas = document.querySelector("[data-screen]");
  if (!canvas || !canvas.getContext || !window.Path2D) { docEl.classList.remove("js"); return; }
  var ctx = canvas.getContext("2d");

  var css = getComputedStyle(docEl);
  function token(name, fallback) { return (css.getPropertyValue(name) || fallback).trim(); }
  var PHOSPHOR = token("--phosphor", "#3cf06e");
  var HOT = token("--hot", "#b4ffc8");
  var DIM = token("--dim", "#1d7a3d");

  /* ------------------------------------------------------------------
     Bitmaps. Glyphs sit on a 9-row grid: rows 0-1 ascender, 2-6 x-height,
     7-8 descender. "#" is a lit pixel. Width is the longest row unless
     the glyph is listed in WIDTHS.
  ------------------------------------------------------------------ */
  var GLYPHS = {
    "a": ["", "", ".###.", "....#", ".####", "#...#", ".####"],
    "c": ["", "", ".####", "#....", "#....", "#....", ".####"],
    "d": ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
    "e": ["", "", ".###.", "#...#", "#####", "#....", ".####"],
    "g": ["", "", ".####", "#...#", "#...#", "#...#", ".####", "....#", ".###."],
    "i": [".#.", "", "##.", ".#.", ".#.", ".#.", "###"],
    "l": ["##.", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
    "m": ["", "", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
    "n": ["", "", "####.", "#...#", "#...#", "#...#", "#...#"],
    "o": ["", "", ".###.", "#...#", "#...#", "#...#", ".###."],
    "s": ["", "", ".####", "#....", ".###.", "....#", "####."],
    "y": ["", "", "#...#", "#...#", "#...#", "#...#", ".####", "....#", ".###."],
    ".": ["", "", "", "", "", "", "#"],
    "—": ["", "", "", "", "#######"],
    " ": [""]
  };
  var WIDTHS = { " ": 3 };
  var NAME = "dayne.online";
  var LINE = NAME + " — coming soon — ";
  var ROWS = 9;

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

  function glyphWidth(ch) {
    if (WIDTHS[ch]) return WIDTHS[ch];
    return GLYPHS[ch].reduce(function (m, row) { return Math.max(m, row.length); }, 0);
  }

  // Cells of one copy of the text; `period` is its width including the
  // trailing gap, so copies placed `period` apart loop seamlessly.
  function lineCells(text) {
    var cells = [], col = 0;
    for (var c = 0; c < text.length; c++) {
      var g = GLYPHS[text[c]];
      for (var r = 0; r < g.length; r++) {
        for (var x = 0; x < g[r].length; x++) {
          if (g[r][x] === "#") cells.push({ c: col + x, r: r });
        }
      }
      col += glyphWidth(text[c]) + 1;
    }
    return { cells: cells, period: col };
  }

  // Merge lit cells that touch along a row into beam runs {c, r, len}
  function runsFrom(cells) {
    var sorted = cells.slice().sort(function (a, b) { return a.r - b.r || a.c - b.c; });
    var runs = [], cur = null;
    for (var i = 0; i < sorted.length; i++) {
      var s = sorted[i];
      if (cur && cur.r === s.r && cur.c + cur.len === s.c) cur.len++;
      else if (!(cur && cur.r === s.r && s.c < cur.c + cur.len)) runs.push(cur = { c: s.c, r: s.r, len: 1 });
    }
    return runs;
  }

  var ROW = lineCells(LINE);
  var ROW_RUNS = runsFrom(ROW.cells);
  var NAME_COLS = lineCells(NAME).period - 1;

  var LOGO_CELLS = [];
  LOGO.forEach(function (row, r) {
    for (var x = 0; x < row.length; x++) if (row[x] === "#") LOGO_CELLS.push({ c: x, r: r });
  });

  /* ------------------------------------------------------------------
     The raster: how many scanlines make up one pixel row at a cell size,
     and how wide the beam is
  ------------------------------------------------------------------ */
  function scanlines(cell) { return cell >= 9 ? 3 : 2; }
  function pitch(cell) { return cell / scanlines(cell); }
  function beamWidth(cell) { return Math.max(1, pitch(cell) * 0.6); }

  // Add one beam run (a row of lit pixels) to a path: K scanline sweeps,
  // each pulled in at the ends so the round caps stay inside the cells
  function addRun(path, x, y, len, cell) {
    var k = scanlines(cell), p = cell / k, inset = Math.min(beamWidth(cell) / 2, len * 0.3);
    for (var s = 0; s < k; s++) {
      var yy = y + p * (s + 0.5);
      path.moveTo(x + inset, yy);
      path.lineTo(x + len - inset, yy);
    }
  }

  // Stroke a path of beam runs: a soft skirt, the beam, then its hot core.
  // `dx` offsets the whole thing (used for ghosting).
  function strokeBeam(path, cell, color, dx, core) {
    var bw = beamWidth(cell);
    ctx.save();
    if (dx) ctx.translate(dx, 0);
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = bw * 2.4;
    ctx.stroke(path);
    ctx.globalAlpha = 1;
    ctx.lineWidth = bw;
    ctx.stroke(path);
    if (core) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = HOT;
      ctx.lineWidth = Math.max(0.6, bw * 0.35);
      ctx.stroke(path);
    }
    ctx.restore();
  }

  function drawBeams(path, cell, ghost) {
    if (ghost > 0.4) {
      strokeBeam(path, cell, DIM, -ghost, false);
      strokeBeam(path, cell, DIM, ghost * 0.6, false);
    }
    strokeBeam(path, cell, PHOSPHOR, 0, true);
  }

  /* ------------------------------------------------------------------
     Layout
  ------------------------------------------------------------------ */
  var w = 0, h = 0, dpr = 1;
  var cs = 12, oy = 0; // line cell size + top
  var ls = 10, lx = 0, ly = 0; // logo cell size + origin
  var offset = 0; // x of copy 0, in px; the line's whole motion lives here
  var hardClear = true;

  function layout() {
    var prevCs = cs;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    hardClear = true;

    // Big, but never so big that "dayne.online" can't fit the opening frame
    cs = Math.max(4, Math.floor(Math.min(h * 0.019, w * 0.9 / NAME_COLS, 20)));
    oy = Math.round(h / 2 - 3.5 * cs);
    offset *= cs / prevCs; // keep the same spot in the line on resize

    ls = Math.max(5, Math.min(14, Math.floor(Math.min(w, h) * 0.2 / 12)));
    lx = Math.round(w / 2 - 6 * ls);
    ly = Math.round(h * 0.42 - 6 * ls);
    docEl.style.setProperty("--logo-bottom", (ly + 12 * ls + 24) + "px");
  }

  // Snap a y position onto the line's raster (scanlines are fixed rows)
  function snapY(y) {
    var p = pitch(cs);
    return oy + Math.round((y - oy) / p) * p;
  }

  // Phosphor persistence: fade the last frame instead of wiping it.
  // `keep` 0..1 is how much of it survives (more at speed = longer trails).
  function clear(keep) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (hardClear || reduceMotion) {
      ctx.clearRect(0, 0, w, h);
      hardClear = false;
      return;
    }
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0, 0, 0, " + (1 - keep) + ")";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  /* ------------------------------------------------------------------
     Scroll input -> sideways momentum
  ------------------------------------------------------------------ */
  var DRIFT = -0.55; // px per frame at rest, right to left
  var vel = 0; // extra px per frame from the visitor
  var phase = "boot";

  function push(dx) {
    if (phase !== "live") return;
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

  var pctEl = document.querySelector("[data-pct]");
  function setProgress(p) {
    if (pctEl) pctEl.textContent = ("00" + Math.round(p * 100)).slice(-3) + "%";
  }

  /* ------------------------------------------------------------------
     The line
  ------------------------------------------------------------------ */
  var glitch = { until: 0, next: 0, ghost: 0, a: 0, b: 0, shift: 0 };

  // Open with "dayne.online" centred
  function startOffset() {
    return Math.round((w - NAME_COLS * cs) / 2);
  }

  // Draw every visible copy of the line at the current offset
  function drawLine(t, speed) {
    var period = ROW.period * cs;
    var base = ((offset % period) + period) % period - period;
    var glitching = t < glitch.until;
    var ghost = Math.min(speed * 0.5, cs * 1.4) + (glitching ? glitch.ghost : 0);
    var beams = new Path2D(), dustDim = new Path2D(), dustHot = new Path2D();

    // Pixel dust: the faster the line moves, the more it sheds below
    var dust = Math.min(1, Math.max(0, (speed - 2) / 22));
    var dir = DRIFT + vel > 0 ? 1 : -1;
    var p = pitch(cs), clamped = Math.min(speed, 45);

    for (var x0 = base; x0 < w; x0 += period) {
      for (var i = 0; i < ROW_RUNS.length; i++) {
        var run = ROW_RUNS[i];
        var x = x0 + run.c * cs, len = run.len * cs;
        if (x + len < -cs * 2 || x > w + cs) continue;
        var y = oy + run.r * cs;
        if (glitching && run.r >= glitch.a && run.r < glitch.b) x += glitch.shift;
        if (Math.random() < 0.003) continue; // a tired tube drops a run
        addRun(beams, x, y, len, cs);

        // Dust: short beam flecks on the raster, falling and lagging behind
        for (var n = 0; n < run.len * 2; n++) {
          if (Math.random() >= dust * 0.7) continue;
          var fx = x + Math.random() * len - dir * Math.random() * clamped * cs * 0.22;
          var fy = snapY(y + cs * 0.4 + Math.pow(Math.random(), 1.4) * clamped * cs * 0.3) + p / 2;
          var fl = Math.max(1, cs * (0.2 + Math.random() * 0.6));
          var target = Math.random() < 0.3 ? dustHot : dustDim;
          target.moveTo(fx, fy);
          target.lineTo(fx + fl, fy);
        }
      }
    }

    drawBeams(beams, cs, ghost);
    if (dust > 0) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = beamWidth(cs);
      ctx.strokeStyle = DIM;
      ctx.stroke(dustDim);
      ctx.strokeStyle = PHOSPHOR;
      ctx.stroke(dustHot);
      ctx.restore();
    }
  }

  function maybeGlitch(t) {
    if (t < glitch.next) return;
    glitch.until = t + 90 + Math.random() * 120;
    glitch.next = t + 2500 + Math.random() * 3500;
    glitch.ghost = cs * (0.4 + Math.random() * 0.8);
    glitch.a = Math.floor(Math.random() * ROWS);
    glitch.b = glitch.a + 1 + Math.floor(Math.random() * 3);
    glitch.shift = (Math.random() < 0.5 ? -1 : 1) * cs * (1 + Math.floor(Math.random() * 3));
    // Every other glitch, the vertical hold slips too
    if (Math.random() < 0.5) {
      docEl.classList.add("jolt");
      setTimeout(function () { docEl.classList.remove("jolt"); }, 110);
    }
  }

  layout();
  offset = startOffset();

  /* ------------------------------------------------------------------
     Reduced motion: draw the line once, show everything, stop.
  ------------------------------------------------------------------ */
  if (reduceMotion) {
    docEl.classList.add("live");
    clear(0);
    drawLine(0, 0);
    window.addEventListener("resize", function () { layout(); offset = startOffset(); clear(0); drawLine(0, 0); });
    return;
  }

  window.addEventListener("resize", layout);

  /* ------------------------------------------------------------------
     Boot + burst. During the burst, one particle per visible line pixel
     flies from the logo to its place; once all have landed, drawing hands
     over to drawLine at the same offset, so the switch is invisible.
  ------------------------------------------------------------------ */
  var repeat = false;
  try { repeat = !!sessionStorage.getItem("booted"); sessionStorage.setItem("booted", "1"); } catch (e) {}
  var BOOT_MS = repeat ? 900 : 2300;

  var loaded = document.readyState === "complete";
  window.addEventListener("load", function () { loaded = true; });

  var logoOn = LOGO_CELLS.map(function () { return (Math.random() * 1100 + 100) * (repeat ? 0.4 : 1); });
  var parts = [];
  var t0 = performance.now(), prev = t0, doneAt = 0, burstAt = 0;
  docEl.classList.add("booting");

  function ease(x) { return 1 - Math.pow(1 - x, 3); }

  function drawBoot(t, done) {
    clear(0.5);
    var lit = [];
    for (var i = 0; i < LOGO_CELLS.length; i++) {
      if (t < logoOn[i]) continue;
      // Each pixel stutters for ~150ms as it comes on
      if (t - logoOn[i] < 150 && Math.random() < 0.5) continue;
      lit.push(LOGO_CELLS[i]);
    }
    var path = new Path2D();
    runsFrom(lit).forEach(function (run) {
      var jitter = done && Math.random() < 0.2 ? (Math.random() - 0.5) * ls * 3 : 0;
      addRun(path, lx + run.c * ls + jitter, ly + run.r * ls, run.len * ls, ls);
    });
    drawBeams(path, ls, done ? ls * 0.4 : 0);
  }

  function startBurst(t) {
    phase = "burst";
    burstAt = t;
    offset = startOffset();
    parts = [];
    var period = ROW.period * cs;
    var cx = lx + 6 * ls, cy = ly + 6 * ls;
    for (var x0 = offset - period; x0 < w; x0 += period) {
      for (var i = 0; i < ROW.cells.length; i++) {
        var hx = x0 + ROW.cells[i].c * cs;
        if (hx < -cs * 2 || hx > w + cs) continue;
        var li = parts.length % LOGO_CELLS.length, lc = LOGO_CELLS[li];
        var px = lx + lc.c * ls, py = ly + lc.r * ls;
        var ang = Math.atan2(py - cy, px - cx), kick = 6 + Math.random() * 14;
        parts.push({
          logo: li, x: px, y: py, hx: hx, hy: oy + ROW.cells[i].r * cs,
          vx: Math.cos(ang) * kick, vy: Math.sin(ang) * kick,
          // Released left to right, like the line being typed out
          release: t + (Math.max(0, hx) / w) * 420 + Math.random() * 120
        });
      }
    }
    docEl.classList.remove("booting");
    docEl.classList.add("live");
  }

  function drawBurst(t, k) {
    clear(0.5);
    var settled = true, total = 0, moving = 0;
    var waiting = {}, path = new Path2D();
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (t < p.release) {
        // Still folded into the logo
        waiting[p.logo] = true;
        settled = false;
        continue;
      }
      p.vx += (p.hx - p.x) * 0.06 * k;
      p.vy += (p.hy - p.y) * 0.06 * k;
      var damp = Math.pow(0.8, k);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * k;
      p.y += p.vy * k;
      var speed = Math.abs(p.vx) + Math.abs(p.vy);
      total += speed;
      moving++;
      if (speed > 0.05 || Math.abs(p.hx - p.x) > 0.5 || Math.abs(p.hy - p.y) > 0.5) settled = false;
      addRun(path, p.x, snapY(p.y), cs, cs);
    }

    // What's left of the logo, still on its own raster
    var left = LOGO_CELLS.filter(function (c, i) { return waiting[i]; });
    if (left.length) {
      var lpath = new Path2D();
      runsFrom(left).forEach(function (run) { addRun(lpath, lx + run.c * ls, ly + run.r * ls, run.len * ls, ls); });
      drawBeams(lpath, ls, 0);
    }
    drawBeams(path, cs, moving ? Math.min((total / moving) * 0.35, cs * 1.4) : 0);

    if (settled || t - burstAt > 2600) {
      phase = "live";
      parts = [];
      glitch.next = t + 2200;
    }
  }

  function frame(now) {
    var t = now - t0;
    var dt = Math.min(50, now - prev);
    var k = dt / 16.7;
    prev = now;

    if (phase === "boot") {
      var p = ease(Math.min(1, t / BOOT_MS));
      if (!loaded) p = Math.min(p, 0.92);
      setProgress(p);
      if (p >= 1 && !doneAt) doneAt = t;
      drawBoot(t, doneAt && t - doneAt > 120);
      if (doneAt && t - doneAt > 380) startBurst(t);
    } else if (phase === "burst") {
      drawBurst(t, k);
    } else {
      // Momentum eases back to the resting drift
      vel *= Math.pow(0.95, k);
      if (Math.abs(vel) < 0.01) vel = 0;
      offset += (DRIFT + vel) * k;
      var speed = Math.abs(DRIFT + vel);
      maybeGlitch(t);
      clear(0.5 + Math.min(0.38, speed / 60)); // longer phosphor trail at speed
      drawLine(t, speed);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
