/* Outward: the canvas engines. Every colour is read from the theme's tokens. */
(() => {
  "use strict";

  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  const PAPER = () => token("--color-paper");
  const PAPER2 = () => token("--color-paper-2");
  const PAPER3 = () => token("--color-paper-3");
  const INK = () => token("--color-ink");
  const INK2 = () => token("--color-ink-2");
  const MUTED = () => token("--color-muted");
  const RULE = () => token("--color-rule");
  const RULE2 = () => token("--color-rule-2");
  const ACCENT2 = () => token("--color-accent-2");

  /* Seeded PRNG so the sky is the same sky every visit. */
  const mulberry32 = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const prep = (canvas) => {
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  };

  const shade = (ctx, color, alpha) => {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  const stroke = (ctx, color, width, alpha) => {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  /* ---- the hero sky: stars, and the flight itself diagrammed in it ---- */
  /* Relative diameters (Earth = 1), compressed for the frame. */
  const PLANETS = [
    { id: "mercury", name: "Mercury", light: "3 min 14 s", size: 0.73 },
    { id: "venus", name: "Venus", light: "6 min 0 s", size: 0.99 },
    { id: "earth", name: "Earth", light: "8 min 19 s", size: 1 },
    { id: "mars", name: "Mars", light: "12 min 40 s", size: 0.81 },
    { id: "jupiter", name: "Jupiter", light: "43 min 20 s", size: 2.2 },
    { id: "saturn", name: "Saturn", light: "1 h 20 min", size: 2.05 },
    { id: "uranus", name: "Uranus", light: "2 h 40 min", size: 1.5 },
    { id: "neptune", name: "Neptune", light: "4 h 10 min", size: 1.48 },
  ];
  const PLANET_BY_ID = Object.fromEntries(PLANETS.map((p) => [p.id, p]));

  const quad = (p0, p1, p2, t) => {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
  };

  const drawSky = () => {
    const canvas = document.getElementById("sky");
    if (!canvas) return;
    const { ctx, w, h } = prep(canvas);
    ctx.clearRect(0, 0, w, h);
    const rand = mulberry32(20261115);
    const count = Math.round((w * h) / 3200);
    for (let i = 0; i < count; i++) {
      const x = rand() * w, y = rand() * h;
      const depth = rand();
      const r = 0.4 + depth * 1.4;
      ctx.globalAlpha = 0.18 + depth * 0.72;
      ctx.fillStyle = depth > 0.94 ? INK() : depth > 0.7 ? INK2() : MUTED();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const small = w < 700;
    const sun = { x: w * (small ? 0.78 : 0.85), y: h * (small ? 0.4 : 0.3) };
    const sr = Math.min(w, h) * (small ? 0.05 : 0.048);
    const start = { x: w * (small ? 0.72 : 0.62), y: h * 1.04 };
    const ctrl = { x: w * 0.98, y: h * (small ? 0.82 : 0.86) };

    /* the flight path, one hairline */
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(ctrl.x, ctrl.y, sun.x, sun.y);
    stroke(ctx, RULE(), 1, 0.7);

    /* the corona rings, hairlines all the way out */
    for (const [f, color, a] of [[1.5, RULE2(), 0.9], [2.05, RULE(), 0.6]]) {
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, sr * f, 0, Math.PI * 2);
      stroke(ctx, color, 1, a);
    }
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sr, 0, Math.PI * 2);
    shade(ctx, INK());

    /* the eight worlds along the path, at their relative sizes */
    const stops = [0.12, 0.2, 0.27, 0.34, 0.48, 0.58, 0.7, 0.8];
    const base = Math.min(w, h) * 0.02;
    PLANETS.forEach((p, i) => {
      const pt = quad(start, ctrl, sun, stops[i]);
      const r = Math.max(1.6, p.size * base);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      shade(ctx, i >= 4 ? INK2() : MUTED(), i >= 4 ? 1 : 0.9);
      if (p.id === "saturn") {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(-0.4);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.9, r * 0.5, 0, 0, Math.PI * 2);
        stroke(ctx, RULE2(), 1, 0.85);
        ctx.restore();
      }
      if (p.id === "earth") {
        ctx.beginPath();
        ctx.arc(pt.x + r * 2.6, pt.y - r * 1.8, Math.max(1.2, r * 0.27), 0, Math.PI * 2);
        shade(ctx, MUTED(), 0.9);
      }
    });
  };

  /* ---- the Sun, diagram: disc inside three hairline corona rings ---- */
  const drawSun = () => {
    const canvas = document.getElementById("c-sun");
    if (!canvas) return;
    const { ctx, w, h } = prep(canvas);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const sr = Math.min(w, h) * 0.24;
    const rings = [[1.32, RULE2(), 1, 0.9], [1.62, ACCENT2(), 1, 0.75], [1.95, RULE(), 1, 0.55]];
    for (const [f, color, width, a] of rings) {
      ctx.beginPath();
      ctx.arc(cx, cy, sr * f, 0, Math.PI * 2);
      stroke(ctx, color, width, a);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, sr, 0, Math.PI * 2);
    shade(ctx, INK());
  };

  /* ---- one planet, drawn in the theme's lightness steps ---- */
  const drawPlanet = (id) => {
    const canvas = document.getElementById("c-planet");
    if (!canvas) return;
    const { ctx, w, h } = prep(canvas);
    ctx.clearRect(0, 0, w, h);
    const p = PLANET_BY_ID[id] || PLANETS[0];
    const cx = w / 2, cy = h / 2;
    const R = p.size * 0.155 * Math.min(w, h);

    if (p.id === "saturn") {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.38);
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.85, R * 0.62, 0, 0, Math.PI * 2);
      stroke(ctx, RULE2(), R * 0.3, 0.55);
      ctx.restore();
    }
    if (p.id === "uranus") {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(1.32);
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.6, R * 0.3, 0, 0, Math.PI * 2);
      stroke(ctx, RULE2(), 1, 0.7);
      ctx.restore();
    }

    /* the lit face carries its screen: ink-2, a full step up from the ground */
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();

    shade(ctx, INK2());

    if (p.id === "mercury") {
      const craters = [[-0.3, -0.25, 0.16], [0.15, -0.45, 0.1], [0.42, 0.1, 0.14], [-0.05, 0.4, 0.11]];
      for (const [dx, dy, r] of craters) {
        ctx.beginPath();
        ctx.arc(cx + dx * R, cy + dy * R, r * R, 0, Math.PI * 2);
        shade(ctx, PAPER3(), 0.85);
      }
    }
    if (p.id === "venus") {
      for (const [dy, rw, a] of [[-0.35, 0.9, 0.4], [0.05, 1, 0.3], [0.42, 0.85, 0.4]]) {
        ctx.beginPath();
        ctx.ellipse(cx, cy + dy * R, R * rw, R * 0.1, -0.12, 0, Math.PI * 2);
        shade(ctx, MUTED(), a * 0.6);
      }
    }
    if (p.id === "earth") {
      const land = [[-0.35, -0.2, 0.34, 0.24, -0.5], [0.28, 0.18, 0.22, 0.3, 0.4], [-0.1, 0.5, 0.18, 0.1, 0.1]];
      for (const [dx, dy, rw, rh, rot] of land) {
        ctx.beginPath();
        ctx.ellipse(cx + dx * R, cy + dy * R, rw * R, rh * R, rot, 0, Math.PI * 2);
        shade(ctx, PAPER3());
      }
      ctx.beginPath();
      ctx.ellipse(cx, cy - R * 0.88, R * 0.5, R * 0.16, 0, 0, Math.PI * 2);
      shade(ctx, INK(), 0.7);
    }
    if (p.id === "mars") {
      ctx.beginPath();
      ctx.ellipse(cx + R * 0.15, cy + R * 0.05, R * 0.4, R * 0.26, -0.3, 0, Math.PI * 2);
      shade(ctx, PAPER3(), 0.9);
      ctx.beginPath();
      ctx.ellipse(cx, cy - R * 0.82, R * 0.32, R * 0.13, 0, 0, Math.PI * 2);
      shade(ctx, INK(), 0.6);
    }
    if (p.id === "jupiter" || p.id === "saturn") {
      const belts = p.id === "jupiter"
        ? [[-0.72, 0.18, 0.55], [-0.38, 0.22, 0.85], [-0.05, 0.16, 0.5], [0.3, 0.26, 0.9], [0.66, 0.2, 0.6]]
        : [[-0.5, 0.14, 0.4], [-0.15, 0.18, 0.55], [0.25, 0.14, 0.4], [0.58, 0.12, 0.5]];
      for (const [dy, rh, a] of belts) {
        ctx.fillStyle = PAPER3();
        ctx.globalAlpha = a * 0.55;
        ctx.fillRect(cx - R, cy + dy * R, R * 2, rh * R);
        ctx.globalAlpha = 1;
      }
      if (p.id === "jupiter") {
        ctx.beginPath();
        ctx.ellipse(cx - R * 0.28, cy + R * 0.16, R * 0.16, R * 0.1, 0, 0, Math.PI * 2);
        shade(ctx, PAPER2(), 0.9);
      }
    }
    if (p.id === "neptune") {
      ctx.beginPath();
      ctx.ellipse(cx - R * 0.1, cy - R * 0.3, R * 0.7, R * 0.08, -0.1, 0, Math.PI * 2);
      shade(ctx, MUTED(), 0.5);
      ctx.beginPath();
      ctx.ellipse(cx + R * 0.25, cy + R * 0.3, R * 0.14, R * 0.09, 0, 0, Math.PI * 2);
      shade(ctx, PAPER3(), 0.8);
    }

    /* the terminator: a hard edge, light leaves the Sun on the left */
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = PAPER();
    ctx.fillRect(cx, cy - R - 2, R + 2, R * 2 + 4);
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    stroke(ctx, RULE2(), 1, 0.8);

    if (p.id === "saturn") {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.38);
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.85, R * 0.62, 0, 0.12, Math.PI - 0.12);
      stroke(ctx, RULE2(), R * 0.3, 0.55);
      ctx.restore();
    }
  };

  /* ---- the black hole: dark disc, photon ring, accretion band ---- */
  const drawHole = () => {
    const canvas = document.getElementById("c-hole");
    if (!canvas) return;
    const { ctx, w, h } = prep(canvas);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.26;

    /* the photon ring, a full hairline circle */
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2);
    stroke(ctx, ACCENT2(), 1.5, 0.85);

    /* the accretion band, back half first */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 1.8, R * 0.55, 0, 0, Math.PI * 2);
    stroke(ctx, INK2(), R * 0.16, 0.9);
    ctx.restore();

    /* the shadow itself, darker than the ground it sits on */
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    shade(ctx, PAPER());

    /* the front of the band, passing over the shadow */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 1.8, R * 0.55, 0, 0.15, Math.PI - 0.15);
    stroke(ctx, INK2(), R * 0.16, 0.9);
    ctx.restore();
  };

  /* ---- the fly-by: panels scrolling past one pinned canvas ---- */
  const state = { planet: "mercury", fading: false };
  const setActive = (id) => {
    if (!PLANET_BY_ID[id] || state.planet === id || state.fading) return;
    state.fading = true;
    const name = document.querySelector(".readout__name");
    const fig = document.querySelector(".readout__fig");
    const canvas = document.getElementById("c-planet");

    name.style.transition = "opacity var(--dur-short) var(--ease-out)";
    fig.style.transition = "opacity var(--dur-short) var(--ease-out)";
    name.style.opacity = 0;
    fig.style.opacity = 0;

    setTimeout(() => {
      state.planet = id;
      const p = PLANET_BY_ID[id];
      if (name) name.textContent = p.name;
      if (fig) {
        fig.childNodes[0].textContent = p.light;
        fig.setAttribute("aria-label", `${p.light} of light from the Sun to ${p.name}`);
      }
      if (canvas) canvas.setAttribute("aria-label", `The planet you are passing: ${p.name}, drawn in the theme’s light`);
      drawPlanet(id);
      name.style.opacity = 1;
      fig.style.opacity = 1;
      state.fading = false;
    }, 220);
  };

  const wire = () => {
    const panels = [...document.querySelectorAll(".flyby__panels li")];
    if (panels.length && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.dataset.planet);
        }
      }, { rootMargin: "-45% 0px -45% 0px" });
      for (const li of panels) io.observe(li);
    }
  };

  const redrawAll = () => {
    drawSky();
    drawSun();
    drawPlanet(state.planet);
    drawHole();
  };

  /* any canvas whose box changes draws again at its true size */
  {
    const canvases = ["sky", "c-sun", "c-planet", "c-hole"];
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => redrawAll());
      for (const id of canvases) {
        const el = document.getElementById(id);
        if (el) ro.observe(el);
      }
    }
  }

  redrawAll();
  wire();
  addEventListener("resize", redrawAll);
})();
