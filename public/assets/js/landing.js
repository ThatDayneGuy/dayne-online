/* ==========================================================================
   dayne.online — temporary landing page motion
   1. Intro: wait for fonts, then add .go (CSS develops the print)
   2. Dev timer: how long the visitor has been in the darkroom
   3. Name weight: letters near the pointer swell heavier (variable Archivo)
   4. Contact sheet: a canvas of film strips drifting under an enlarger
      light that follows the pointer (or wanders on its own on touch)
   No dependencies. Reduced motion: static sheet, static name, no loop.
   ========================================================================== */

(function () {
  "use strict";

  var docEl = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     1. Intro
  ------------------------------------------------------------------ */
  function go() { docEl.classList.add("go"); }
  if (document.fonts && document.fonts.ready) {
    Promise.race([
      document.fonts.ready,
      new Promise(function (r) { setTimeout(r, 1200); })
    ]).then(go);
  } else {
    go();
  }

  /* ------------------------------------------------------------------
     2. Dev timer (mm:ss since arrival)
  ------------------------------------------------------------------ */
  var timerEl = document.querySelector("[data-timer]");
  var start = Date.now();
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  if (timerEl) {
    setInterval(function () {
      var s = Math.floor((Date.now() - start) / 1000);
      timerEl.textContent = pad(Math.floor(s / 60) % 100) + ":" + pad(s % 60);
    }, 1000);
  }

  /* ------------------------------------------------------------------
     Pointer state, shared by the name and the enlarger light
  ------------------------------------------------------------------ */
  var pointer = { x: 0, y: 0, active: false, down: false, last: 0 };
  window.addEventListener("pointermove", function (e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
    pointer.last = performance.now();
  }, { passive: true });
  window.addEventListener("pointerdown", function (e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
    pointer.down = true;
    pointer.last = performance.now();
  }, { passive: true });
  window.addEventListener("pointerup", function () { pointer.down = false; });
  window.addEventListener("pointercancel", function () { pointer.down = false; });
  document.addEventListener("pointerleave", function () { pointer.active = false; });

  /* ------------------------------------------------------------------
     3. Name weight
  ------------------------------------------------------------------ */
  var chars = Array.prototype.slice.call(document.querySelectorAll("[data-name] .ch"));
  var BASE_W = 760, MIN_W = 100, MAX_W = 900;
  var weights = chars.map(function () { return MIN_W; });

  function stepName(t, light) {
    for (var i = 0; i < chars.length; i++) {
      var r = chars[i].getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      // Letters swell under the light and thin out away from it
      var d = Math.hypot(light.x - cx, (light.y - cy) * 0.6);
      var reach = Math.max(window.innerWidth * 0.28, 220);
      var k = Math.max(0, 1 - d / reach);
      var target = BASE_W - 260 + k * (MAX_W - BASE_W + 260);
      weights[i] += (target - weights[i]) * 0.07;
      chars[i].style.fontWeight = Math.round(weights[i]);
    }
  }

  /* ------------------------------------------------------------------
     4. Contact sheet
  ------------------------------------------------------------------ */
  var canvas = document.querySelector("[data-sheet]");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var lit = document.createElement("canvas");
  var lctx = lit.getContext("2d");

  // Seeded random so the sheet is the same roll on every visit
  var seed = 7;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  // Geometry of one film strip (CSS px)
  var FW = 150, FH = 100, FGAP = 8, EDGE = 18, ROWGAP = 16;
  var COLS = 6, ROWS = 4;
  var STRIP_H = FH + EDGE * 2;
  var TILE_W = COLS * (FW + FGAP);
  var TILE_H = ROWS * (STRIP_H + ROWGAP);

  // An out-of-focus "photograph": a handful of random tones painted at
  // 8x5 px, then scaled up with smoothing so it reads as a soft image.
  function makeFrame() {
    var tiny = document.createElement("canvas");
    tiny.width = 8;
    tiny.height = 5;
    var t = tiny.getContext("2d");
    var img = t.createImageData(8, 5);
    var kind = rand();
    var horizon = 1 + Math.floor(rand() * 3);
    var sky = 120 + rand() * 120;
    var ground = 20 + rand() * 90;
    var bx = rand() * 8, by = rand() * 5, bv = rand() > 0.5 ? 235 : 15;
    for (var y = 0; y < 5; y++) {
      for (var x = 0; x < 8; x++) {
        var v;
        if (kind < 0.55) {
          v = y < horizon ? sky - y * 12 : ground + (rand() - 0.5) * 30;
        } else {
          v = 40 + rand() * 60;
        }
        var bd = Math.hypot(x - bx, (y - by) * 1.4);
        v += (bv - v) * Math.max(0, 1 - bd / 2.6);
        v = Math.max(0, Math.min(255, v));
        var p = (y * 8 + x) * 4;
        img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
        img.data[p + 3] = 255;
      }
    }
    t.putImageData(img, 0, 0);
    return tiny;
  }

  var tile = document.createElement("canvas");
  var pattern = null;

  function buildTile(scale) {
    tile.width = TILE_W * scale;
    tile.height = TILE_H * scale;
    var c = tile.getContext("2d");
    c.setTransform(scale, 0, 0, scale, 0, 0);
    seed = 7;

    // Print paper
    c.fillStyle = "#e7e4dc";
    c.fillRect(0, 0, TILE_W, TILE_H);

    var frameNo = 1;
    for (var row = 0; row < ROWS; row++) {
      var sy = row * (STRIP_H + ROWGAP) + ROWGAP / 2;

      // Film base prints black
      c.fillStyle = "#0e0e0d";
      c.fillRect(0, sy, TILE_W, STRIP_H);

      // Sprocket holes print as clear (paper) along both edges
      c.fillStyle = "#cfcbc2";
      for (var hx = 4; hx < TILE_W; hx += 13) {
        c.fillRect(hx, sy + 4, 7, 5);
        c.fillRect(hx, sy + STRIP_H - 9, 7, 5);
      }

      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "high";
      for (var col = 0; col < COLS; col++) {
        var fx = col * (FW + FGAP) + FGAP / 2;
        var fy = sy + EDGE;
        c.drawImage(makeFrame(), fx, fy, FW, FH);

        // Frame numbers in the rebate, like edge printing
        c.fillStyle = "rgba(231, 228, 220, 0.7)";
        c.font = "8px 'Fragment Mono', ui-monospace, monospace";
        var n = (frameNo < 10 ? "0" : "") + frameNo;
        c.fillText(n, fx + 2, sy + STRIP_H - 11);
        c.fillText(n + "A", fx + FW / 2, sy + STRIP_H - 11);
        frameNo++;
      }
      c.fillText("400  ▸  B&W", 10 + row * 37, sy + 15);
    }
    pattern = ctx.createPattern(tile, "repeat");
    if (pattern && pattern.setTransform && window.DOMMatrix) {
      pattern.setTransform(new DOMMatrix().scale(1 / scale));
    }
  }

  var w = 0, h = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = lit.width = Math.round(w * dpr);
    canvas.height = lit.height = Math.round(h * dpr);
    buildTile(dpr);
  }

  var ANGLE = -0.12; // radians; the sheet lies slightly askew on the table
  function drawSheet(c, ox, oy) {
    var D = Math.hypot(w, h) / 2 + Math.max(TILE_W, TILE_H);
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(ANGLE);
    c.translate(-(ox % TILE_W), -(oy % TILE_H));
    c.fillStyle = pattern;
    c.fillRect(-D, -D, D * 2 + TILE_W, D * 2 + TILE_H);
    c.restore();
  }

  // The enlarger light: eased toward the pointer, wandering when idle
  var light = { x: 0, y: 0, r: 0 };
  function lightTarget(t) {
    var idle = !pointer.active || t - pointer.last > 4000;
    if (!idle) return { x: pointer.x, y: pointer.y };
    var s = t / 1000;
    return {
      x: w * (0.5 + 0.32 * Math.sin(s * 0.23)),
      y: h * (0.45 + 0.25 * Math.sin(s * 0.31 + 1.3))
    };
  }

  function render(t, ox, oy) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // In the dark, the sheet is barely there
    ctx.globalAlpha = 0.05;
    drawSheet(ctx, ox, oy);
    ctx.globalAlpha = 1;

    // Under the light, it comes up
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(0, 0, w, h);
    drawSheet(lctx, ox, oy);
    lctx.globalCompositeOperation = "destination-in";
    var g = lctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.r);
    g.addColorStop(0, "rgba(0,0,0,0.62)");
    g.addColorStop(0.45, "rgba(0,0,0,0.3)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g;
    lctx.fillRect(0, 0, w, h);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(lit, 0, 0);
  }

  resize();
  light.x = w * 0.62;
  light.y = h * 0.42;
  light.r = Math.min(w, h) * 0.42;

  if (reduceMotion) {
    render(0, 0, 0);
    chars.forEach(function (el) { el.style.fontWeight = BASE_W; });
    window.addEventListener("resize", function () { resize(); render(0, 0, 0); });
    return;
  }

  window.addEventListener("resize", resize);

  var ox = 0, oy = 0, prev = performance.now(), running = true;
  function frame(t) {
    if (!running) return;
    var dt = Math.min(64, t - prev);
    prev = t;

    // Slow drift, like the sheet sliding across the light table
    ox += dt * 0.012;
    oy += dt * 0.005;

    var target = lightTarget(t);
    light.x += (target.x - light.x) * 0.075;
    light.y += (target.y - light.y) * 0.075;
    var rTarget = Math.min(w, h) * (pointer.down ? 0.7 : 0.42);
    light.r += (rTarget - light.r) * 0.08;

    // Pointer parallax: the sheet leans a touch away from the light
    var px = (light.x / w - 0.5) * -24;
    var py = (light.y / h - 0.5) * -16;

    render(t, ox + px, oy + py);
    stepName(t, light);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      prev = performance.now();
      requestAnimationFrame(frame);
    }
  });
})();
