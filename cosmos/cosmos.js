/* COSMOS — a personal universe simulator.
   Engine: three.js r128. Everything is procedural; every figure in the
   encyclopedia is a real, sourced number. */
(() => {
  "use strict";

  /* ---------------- tiny math kit ---------------- */
  const TAU = Math.PI * 2;
  const mulberry32 = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hash2 = (x, y, s) => {
    const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const vnoise = (x, y, s) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
    const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, s, oct = 5) => {
    let v = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { v += amp * vnoise(x * f, y * f, s + i * 13); f *= 2; amp *= 0.5; }
    return v;
  };
  const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (n) => n.toLocaleString("en-US");

  /* ---------------- texture studio ---------------- */
  const canvasOf = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return [c, c.getContext("2d")];
  };
  const toTexture = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  };
  /* seamless in x: sample at a real cell size (pixels), crossfade across the seam */
  const pnoise = (x, y, W, cell, seed, oct) => {
    const X = x / cell, Y = y / cell;
    const u = x / W;
    const a = fbm(X, Y, seed, oct);
    const b = fbm(X - W / cell, Y, seed, oct);
    return a * (1 - u) + b * u;
  };

  const paintRocky = (ctx, W, H, o) => {
    const rnd = mulberry32(o.seed);
    const img = ctx.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = pnoise(x, y, W, W / 6, o.seed, 5);
        const m = pnoise(x, y, W, W / 2.2, o.seed + 91, 4);
        const t = clamp((n - 0.42) * 2.4, 0, 1);
        const c1 = o.low, c2 = o.high;
        const r = c1[0] + (c2[0] - c1[0]) * t + (m - 0.5) * o.grain * 255;
        const g = c1[1] + (c2[1] - c1[1]) * t + (m - 0.5) * o.grain * 255;
        const b = c1[2] + (c2[2] - c1[2]) * t + (m - 0.5) * o.grain * 255;
        const i = (y * W + x) * 4;
        d[i] = clamp(r, 0, 255); d[i + 1] = clamp(g, 0, 255); d[i + 2] = clamp(b, 0, 255); d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (o.caps) {
      ctx.fillStyle = "rgba(240,244,250,0.92)";
      ctx.fillRect(0, 0, W, H * 0.045);
      ctx.fillRect(0, H * 0.955, W, H * 0.045);
    }
    if (o.mare) {
      ctx.fillStyle = "rgba(30,16,10,0.35)";
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(rnd() * W, H * (0.25 + rnd() * 0.5), W * (0.06 + rnd() * 0.1), H * (0.05 + rnd() * 0.08), rnd() * 3, 0, TAU);
        ctx.fill();
      }
    }
    if (o.craters) {
      for (let i = 0; i < o.craters; i++) {
        const x = rnd() * W, y = rnd() * H, r = 2 + Math.pow(rnd(), 2.2) * 16;
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = Math.max(1, r * 0.18);
        ctx.beginPath(); ctx.arc(x, y, r * 0.82, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
      }
    }
  };

  const paintGas = (ctx, W, H, o) => {
    const rnd = mulberry32(o.seed);
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const bands = o.bands;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const wob = (pnoise(x, y, W, W / 3, o.seed, 4) - 0.5) * o.wobble;
        const by = clamp((y / H) * bands + wob + 0.5, 0, bands - 0.001);
        const pi = Math.floor(by);
        const pf = by - pi;
        const A = o.palette[pi % o.palette.length];
        const B = o.palette[(pi + 1) % o.palette.length];
        const swirl = (pnoise(x, y, W, W / 8, o.seed + 7, 3) - 0.5) * 0.25;
        const t = clamp(pf + swirl, 0, 1);
        const i = (y * W + x) * 4;
        d[i] = A[0] + (B[0] - A[0]) * t;
        d[i + 1] = A[1] + (B[1] - A[1]) * t;
        d[i + 2] = A[2] + (B[2] - A[2]) * t;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (o.spot) {
      const x = W * o.spot[0], y = H * o.spot[1];
      ctx.save();
      for (let i = 6; i >= 0; i--) {
        ctx.fillStyle = `rgba(${o.spot[2]},${o.spot[3]},${o.spot[4]},${0.10 + (6 - i) * 0.06})`;
        ctx.beginPath();
        ctx.ellipse(x, y, W * 0.05 * (1 + i * 0.35), H * 0.05 * (1 + i * 0.3), 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    if (o.haze) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(255,255,255,0.10)");
      g.addColorStop(0.5, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,255,255,0.10)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  };

  const paintEarth = (ctx, W, H, o) => {
    const img = ctx.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      const lat = Math.abs(y / H - 0.5) * 2;
      for (let x = 0; x < W; x++) {
        /* continents: one broad field, gently detailed */
        const n = pnoise(x, y, W, W / 2.2, o.seed, 4) * 0.8 + pnoise(x, y, W, W / 16, o.seed + 9, 4) * 0.2;
        const moist = pnoise(x, y, W, W / 7, o.seed + 44, 3);
        const i = (y * W + x) * 4;
        let r, g, b;
        if (n > 0.52) {
          const h = clamp((n - 0.52) * 6, 0, 1);
          const desert = clamp((moist - 0.35) * -3.2, 0, 1) * clamp(1 - lat * 1.6, 0, 1);
          r = 58 + h * 66 + desert * 118;
          g = 96 + h * 52 + desert * 62 - lat * 26;
          b = 44 + h * 34 + desert * -6;
          if (h > 0.8) { const s = (h - 0.8) * 4; r += (180 - r) * s * 0.5; g += (176 - g) * s * 0.5; b += (170 - b) * s * 0.5; }
        } else {
          const depth = clamp((0.52 - n) * 6, 0, 1);
          r = 30 + (1 - depth) * 30;
          g = 74 + (1 - depth) * 58;
          b = 128 + (1 - depth) * 76;
        }
        if (lat > 0.86) { const s = clamp((lat - 0.86) * 8, 0, 1); r += (240 - r) * s; g += (244 - g) * s; b += (250 - b) * s; }
        const cl = pnoise(x, y, W, W / 12, o.seed + 71, 4);
        if (cl > 0.62) { const a = clamp((cl - 0.62) * 4, 0, 0.8); r += (248 - r) * a; g += (248 - g) * a; b += (252 - b) * a; }
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  const paintSun = (ctx, W, H, o) => {
    const img = ctx.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = pnoise(x, y, W, W / 12, o.seed, 5);
        const i = (y * W + x) * 4;
        d[i] = 255;
        d[i + 1] = 226 - n * 52;
        d[i + 2] = 150 + n * 55;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const rnd = mulberry32(o.seed);
    ctx.fillStyle = "rgba(120,40,10,0.55)";
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.ellipse(rnd() * W, H * (0.2 + rnd() * 0.6), 4 + rnd() * 9, 3 + rnd() * 5, 0, 0, TAU);
      ctx.fill();
    }
  };

  const paintBands1D = (ctx, W, H, o) => {
    /* radial ring strip for Saturn's rings */
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const rnd = mulberry32(o.seed);
    for (let x = 0; x < W; x++) {
      const t = x / W;
      let a = 0;
      for (const [from, to, alpha] of o.rings) {
        if (t > from && t < to) {
          a = alpha * (0.55 + 0.45 * Math.sin(t * 220 + rnd() * 6));
          if (t > from && t < from + 0.015) a *= (t - from) / 0.015;
          if (t < to && t > to - 0.015) a *= (to - t) / 0.015;
        }
      }
      const shade = 205 + Math.sin(t * 160) * 18;
      for (let y = 0; y < H; y++) {
        const i = (y * W + x) * 4;
        d[i] = shade; d[i + 1] = shade * 0.97; d[i + 2] = shade * 0.9; d[i + 3] = clamp(a, 0, 1) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  const glowSprite = (color, inner = 0.5) => {
    const [c, ctx] = canvasOf(256, 256);
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, color);
    g.addColorStop(inner, color.replace(/[\d.]+\)$/, "0.28)"));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return toTexture(c);
  };

  const nebulaSprite = (seed, hue) => {
    const [c, ctx] = canvasOf(256, 256);
    ctx.globalCompositeOperation = "lighter";
    const rnd = mulberry32(seed);
    for (let i = 0; i < 16; i++) {
      const x = 60 + rnd() * 136, y = 60 + rnd() * 136, r = 24 + rnd() * 62;
      const h = hue + (rnd() - 0.5) * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `hsla(${h}, 70%, 62%, ${0.10 + rnd() * 0.10})`);
      g.addColorStop(1, "hsla(0, 0%, 0%, 0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    return toTexture(c);
  };

  const galaxySprite = (seed) => {
    const [c, ctx] = canvasOf(256, 256);
    const rnd = mulberry32(seed);
    ctx.globalCompositeOperation = "lighter";
    const core = ctx.createRadialGradient(128, 128, 0, 128, 128, 40);
    core.addColorStop(0, "rgba(255,236,200,0.9)");
    core.addColorStop(1, "rgba(255,236,200,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, 256, 256);
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < 220; i++) {
        const t = rnd();
        const r = 8 + t * 108;
        const th = arm * Math.PI + t * 2.6 + (rnd() - 0.5) * 0.5;
        const x = 128 + Math.cos(th) * r;
        const y = 128 + Math.sin(th) * r * 0.62;
        ctx.fillStyle = `rgba(${190 + rnd() * 60 | 0},${205 + rnd() * 40 | 0},255,${0.5 - t * 0.3})`;
        ctx.fillRect(x, y, 1.4, 1.4);
      }
    }
    return toTexture(c);
  };

  const paintMilkyWay = (ctx, W, H) => {
    const rnd = mulberry32(4242);
    ctx.fillStyle = "#04060d";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    const bandY = (x) => H * 0.5 + Math.sin((x / W) * TAU * 1.5 + 1.2) * H * 0.22;
    for (let i = 0; i < 1000; i++) {
      const x = rnd() * W;
      const spread = (rnd() + rnd() + rnd() - 1.5) * H * 0.09;
      const y = bandY(x) + spread;
      const r = 24 + rnd() * 90;
      const warm = rnd() < 0.3;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, warm ? "rgba(255,225,190,0.022)" : "rgba(185,205,255,0.02)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 3000; i++) {
      const x = rnd() * W;
      const spread = (rnd() + rnd() - 1) * H * 0.12;
      const y = bandY(x) + spread;
      ctx.fillStyle = `rgba(255,255,255,${0.08 + rnd() * 0.3})`;
      ctx.fillRect(x, y, 1.1, 1.1);
    }
    /* a dust lane through the heart of it */
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 220; i++) {
      const x = rnd() * W;
      const y = bandY(x) + (rnd() - 0.5) * H * 0.03;
      const r = 20 + rnd() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(3,4,9,0.26)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    /* the rest of the sky: scattered field stars */
    for (let i = 0; i < 2400; i++) {
      const x = rnd() * W, y = rnd() * H;
      ctx.fillStyle = `rgba(255,255,255,${0.07 + rnd() * 0.22})`;
      ctx.fillRect(x, y, 1, 1);
    }
  };

  /* ---------------- the real universe, at sim scale ---------------- */
  /* Radii are compressed for the frame; distances follow a = 14·AU^0.6. */
  const A = (au) => 14 * Math.pow(au, 0.6);
  const YEARS = (au) => 12 * Math.pow(au, 0.8) * 10;

  const BODIES = [
    {
      id: "sun", name: "The Sun", kind: "Star", parent: null, size: 6, a: 0, spin: 0.05, tex: { type: "sun", seed: 11 },
      intro: "A G-type main-sequence star, 4.6 billion years into a ten-billion-year life. It holds 99.86 % of the system's mass and fuses six hundred million tonnes of hydrogen every second.",
      data: [["Diameter", "1,392,700 km"], ["Surface", "5,505 °C"], ["Core", "15,000,000 °C"], ["Gravity", "274 m/s²"], ["Rotation", "25.4 days"], ["Age", "4.6 billion yr"]],
      facts: [
        "Light from its surface takes 8 min 19 s to reach Earth — and about 100,000 years to escape the core.",
        "It converts 4 million tonnes of matter into pure energy every second.",
        "In about 5 billion years it will swell into a red giant, likely swallowing Mercury and Venus."
      ],
      missions: [
        "Parker Solar Probe (2018–) — the fastest human-made object, flying through the corona itself.",
        "Solar Orbiter (2020–) — imaging the poles for the first time.",
        "SOHO (1995–) — three decades of continuous watching."
      ]
    },
    {
      id: "mercury", name: "Mercury", kind: "Planet · rocky", parent: "sun", size: 0.55, a: A(0.387), spin: 0.02, tex: { type: "rocky", seed: 21, low: [97, 92, 88], high: [172, 165, 156], craters: 90, grain: 0.05 },
      intro: "The smallest planet and the closest to the Sun — a cratered ball of iron and stone where a single solar day lasts 176 Earth days.",
      data: [["Diameter", "4,879 km"], ["Gravity", "3.7 m/s²"], ["Surface", "−173 to 427 °C"], ["Day", "176 Earth days"], ["Year", "88 days"], ["Distance", "0.39 AU"]],
      facts: [
        "It has the widest temperature swing of any planet: 600 °C between its scorched day and frozen night.",
        "Its huge iron core makes up about 85 % of the planet's radius.",
        "There is water ice in the craters at its poles, in permanent shadow."
      ],
      missions: ["MESSENGER (2011–2015) — first orbiter.", "BepiColombo — arriving in orbit late 2026."]
    },
    {
      id: "venus", name: "Venus", kind: "Planet · rocky", parent: "sun", size: 1.05, a: A(0.723), spin: -0.008, tex: { type: "gas", seed: 31, bands: 9, wobble: 2.6, palette: [[214, 186, 130], [233, 208, 152], [198, 164, 108], [240, 220, 170]], haze: true, grain: 0 },
      intro: "Earth's twin in size and its opposite in temper. Under permanent clouds of sulphuric acid, the surface is hot enough to melt lead.",
      data: [["Diameter", "12,104 km"], ["Gravity", "8.87 m/s²"], ["Surface", "464 °C"], ["Day", "243 days, backwards"], ["Year", "225 days"], ["Distance", "0.72 AU"]],
      facts: [
        "It rotates backwards, so the Sun rises in the west — and its day is longer than its year.",
        "Surface pressure is 92 atmospheres: like being 900 m deep in an ocean.",
        "It is the brightest planet in our sky; the ancient Chinese called it the Beautiful One."
      ],
      missions: ["Venera 7 (1970) — first landing on another planet.", "Magellan (1990–94) — mapped 98 % of the surface."]
    },
    {
      id: "earth", name: "Earth", kind: "Planet · rocky", parent: "sun", size: 1.1, a: A(1), spin: 0.35, tex: { type: "earth", seed: 41 },
      intro: "The only world where anything is known to be alive — one ocean world with a thin blue skin of air, kept temperate by a magnetic field and a generous moon.",
      data: [["Diameter", "12,742 km"], ["Gravity", "9.81 m/s²"], ["Average temp", "15 °C"], ["Day", "23.9 hours"], ["Year", "365.25 days"], ["Moons", "1"]],
      facts: [
        "71 % of the surface is ocean, but all that water is a film: 0.02 % of Earth's radius deep.",
        "Its magnetic field deflects the solar wind; without it the oceans would have boiled away long ago.",
        "The air you are breathing now contains argon from potassium decaying inside the planet."
      ],
      missions: ["Apollo 8 (1968) — first crewed flight to another world.", "ISS (2000–) — continuously inhabited for over 25 years."]
    },
    {
      id: "moon", name: "The Moon", kind: "Moon of Earth", parent: "earth", size: 0.3, a: 3.2, spin: 0.01, tex: { type: "rocky", seed: 51, low: [120, 118, 114], high: [196, 194, 188], craters: 120, mare: true, grain: 0.04 },
      intro: "Earth's companion, born from a giant impact 4.5 billion years ago — the only other world humans have walked on.",
      data: [["Diameter", "3,475 km"], ["Gravity", "1.62 m/s²"], ["Range", "−173 to 127 °C"], ["Orbit", "384,400 km"], ["Month", "27.3 days"], ["Drift", "+3.8 cm/yr"]],
      facts: [
        "It is tidally locked: the same face has watched Earth for billions of years.",
        "Moonquakes can ring for nearly an hour — the interior is drier and quieter than Earth's.",
        "Its gravity steadies Earth's tilt, which is why our seasons are so gentle."
      ],
      missions: ["Apollo 11 (1969) — first footstep, 20 hours on the surface.", "Chang'e 5 (2020) — first fresh samples since 1976.", "Artemis II — crewed flyby, soon."]
    },
    {
      id: "mars", name: "Mars", kind: "Planet · rocky", parent: "sun", size: 0.75, a: A(1.524), spin: 0.33, tex: { type: "rocky", seed: 61, low: [128, 62, 38], high: [214, 132, 84], craters: 40, caps: true, mare: true, grain: 0.06 },
      intro: "The rust-red desert world — once wet, twice as cold as it should be, and the most explored place beyond Earth.",
      data: [["Diameter", "6,779 km"], ["Gravity", "3.71 m/s²"], ["Average temp", "−63 °C"], ["Day", "24.6 hours"], ["Year", "687 days"], ["Distance", "1.52 AU"]],
      facts: [
        "Olympus Mons rises 21.9 km — two and a half Everests — and is the tallest volcano known.",
        "Valles Marineris would stretch from New York to Los Angeles.",
        "Its red is literally rust: iron oxide dust covering everything."
      ],
      missions: ["Perseverance + Ingenuity (2021–) — first powered flight on another world.", "Curiosity (2012–) — still driving.", "Viking 1 (1976) — first successful landing."]
    },
    { id: "phobos", name: "Phobos", kind: "Moon of Mars", parent: "mars", size: 0.16, a: 1.6, spin: 0.1, tex: { type: "rocky", seed: 66, low: [88, 80, 72], high: [140, 130, 118], craters: 60, grain: 0.06 },
      intro: "The larger of Mars's two captured potatoes, orbiting so low it crosses the Martian sky twice a day.",
      data: [["Size", "22.5 km across"], ["Orbit", "7.7 hours"], ["Surface", "−40 °C"], ["Fate", "doom in ~50 Myr"]],
      facts: ["It spirals 1.8 m closer to Mars every century and will break into a ring.", "Its Stickney crater spans nearly half the moon.", "It is probably a captured asteroid."] },
    { id: "deimos", name: "Deimos", kind: "Moon of Mars", parent: "mars", size: 0.12, a: 2.5, spin: 0.08, tex: { type: "rocky", seed: 67, low: [92, 86, 78], high: [148, 140, 126], craters: 40, grain: 0.06 },
      intro: "The smaller, outer Martian moon — a smooth, dust-blanketed lump named for the Greek personification of dread.",
      data: [["Size", "12.4 km across"], ["Orbit", "30.3 hours"], ["Surface", "−40 °C"]],
      facts: ["It would look like a bright star from the Martian surface.", "Its regolith buries most of its craters.", "Like Phobos, it may be a captured main-belt asteroid."] },
    {
      id: "jupiter", name: "Jupiter", kind: "Planet · gas giant", parent: "sun", size: 3.4, a: A(5.2), spin: 0.6, tex: { type: "gas", seed: 71, bands: 15, wobble: 1.9, palette: [[172, 124, 80], [234, 208, 172], [136, 90, 56], [246, 230, 200], [160, 112, 72]], spot: [0.3, 0.66, 200, 92, 60], grain: 0 },
      intro: "The system's oldest and largest resident — a failed star of hydrogen and helium with a storm wider than Earth that has raged for centuries.",
      data: [["Diameter", "139,820 km"], ["Gravity", "24.79 m/s²"], ["Cloud tops", "−108 °C"], ["Day", "9.9 hours"], ["Year", "11.9 years"], ["Moons", "95 known"]],
      facts: [
        "It outweighs every other planet combined, 2.5 times over.",
        "The Great Red Spot has been shrinking since the 1800s but still swallows Earth whole.",
        "Its magnetic field is 20,000 times stronger than Earth's."
      ],
      missions: ["Galileo (1995–2003) — first orbiter; dropped a probe into the clouds.", "Juno (2016–) — peering under the cloud decks.", "Voyager 1 & 2 (1979) — the flybys that revealed the rings."]
    },
    { id: "io", name: "Io", kind: "Moon of Jupiter", parent: "jupiter", size: 0.32, a: 5.2, spin: 0.08, tex: { type: "gas", seed: 81, bands: 7, wobble: 3.2, palette: [[224, 196, 88], [244, 226, 140], [188, 130, 60], [250, 240, 180]], grain: 0 },
      intro: "The most volcanic world known — kneaded by Jupiter's tides until its interior melts and its surface erupts continuously.",
      data: [["Diameter", "3,643 km"], ["Volcanoes", "400+ active"], ["Surface", "−130 °C, lava 1,600 °C"], ["Orbit", "42.5 hours"]],
      facts: ["Tidal flexing heats it like a repeatedly bent paperclip.", "Its volcanoes throw plumes 300 km into space.", "It resurfaces itself so fast that it has no impact craters at all."] },
    { id: "europa", name: "Europa", kind: "Moon of Jupiter", parent: "jupiter", size: 0.28, a: 6.8, spin: 0.06, tex: { type: "rocky", seed: 82, low: [228, 224, 214], high: [248, 246, 240], craters: 4, grain: 0.03, cracks: true },
      intro: "A cracked shell of ice over a global saltwater ocean holding twice the water of all Earth's seas — the system's most promising address for life.",
      data: [["Diameter", "3,122 km"], ["Ice shell", "15–25 km"], ["Ocean", "60–150 km deep"], ["Surface", "−171 °C"]],
      facts: ["The smoothest solid surface in the solar system.", "The Hubble telescope may have seen plumes venting from its south pole.", "Radiation at its surface would kill you in minutes — the ocean below is the place to look."] },
    { id: "ganymede", name: "Ganymede", kind: "Moon of Jupiter", parent: "jupiter", size: 0.42, a: 8.6, spin: 0.05, tex: { type: "rocky", seed: 83, low: [120, 112, 104], high: [200, 194, 184], craters: 70, grain: 0.05 },
      intro: "The largest moon in the solar system — bigger than Mercury, and the only moon with a magnetic field of its own.",
      data: [["Diameter", "5,268 km"], ["Gravity", "1.43 m/s²"], ["Surface", "−163 °C"], ["Orbit", "7.2 days"]],
      facts: ["It hides a saltwater ocean 100 km under the ice.", "Its aurorae betray that buried ocean.", "It is the only moon with its own magnetosphere."] },
    { id: "callisto", name: "Callisto", kind: "Moon of Jupiter", parent: "jupiter", size: 0.38, a: 10.6, spin: 0.04, tex: { type: "rocky", seed: 84, low: [78, 70, 62], high: [150, 140, 128], craters: 140, grain: 0.05 },
      intro: "The most heavily cratered body known — a four-billion-year-old surface, undisturbed since the heavy bombardment.",
      data: [["Diameter", "4,821 km"], ["Surface", "−139 °C"], ["Orbit", "16.7 days"]],
      facts: ["No known surface anywhere is older or more battered.", "It sits outside Jupiter's worst radiation — a possible future base.", "It may also hide a deep ocean."] },
    {
      id: "saturn", name: "Saturn", kind: "Planet · gas giant", parent: "sun", size: 3.0, a: A(9.58), spin: 0.55, ring: { i: 1.35, o: 2.45, tex: "rings" }, tex: { type: "gas", seed: 91, bands: 12, wobble: 1.2, palette: [[226, 202, 152], [242, 224, 182], [204, 176, 126], [248, 236, 204]], haze: true, grain: 0 },
      intro: "The jewel of the system — a gas giant lighter than water, wearing 282,000 km of ice rings thinner than a house is tall.",
      data: [["Diameter", "116,460 km"], ["Gravity", "10.44 m/s²"], ["Cloud tops", "−139 °C"], ["Day", "10.7 hours"], ["Year", "29.4 years"], ["Moons", "146 known"]],
      facts: [
        "Its average density is 0.687 g/cm³ — it would float, if you found the bathtub.",
        "The rings are 99 % water ice, and may be younger than the dinosaurs.",
        "A hexagonal jet stream circles its north pole, 30,000 km across."
      ],
      missions: ["Cassini–Huygens (2004–2017) — 13 years, 294 orbits, and a Grand Finale between planet and rings.", "Voyager 1 & 2 (1980–81) — first close looks."]
    },
    { id: "titan", name: "Titan", kind: "Moon of Saturn", parent: "saturn", size: 0.44, a: 4.6, spin: 0.04, tex: { type: "gas", seed: 95, bands: 6, wobble: 1.0, palette: [[218, 148, 66], [238, 178, 96], [196, 128, 56], [246, 196, 120]], haze: true, grain: 0 },
      intro: "The only moon with a real atmosphere — thick orange haze, methane rain, rivers and seas. A Earth-that-never-was, at −179 °C.",
      data: [["Diameter", "5,150 km"], ["Atmosphere", "1.45 bar, nitrogen"], ["Surface", "−179 °C"], ["Orbit", "15.9 days"]],
      facts: ["It rains liquid methane, into seas the size of the Caspian.", "Its dunes are made of solid organic tar.", "Beneath the surface hides a liquid-water ocean."] },
    { id: "enceladus", name: "Enceladus", kind: "Moon of Saturn", parent: "saturn", size: 0.2, a: 6.2, spin: 0.05, tex: { type: "rocky", seed: 96, low: [232, 238, 244], high: [250, 252, 255], craters: 8, grain: 0.02, stripes: true },
      intro: "A bright, tiny ice moon venting geysers of salty water from its south pole — a habitable world spraying its ocean into space.",
      data: [["Diameter", "504 km"], ["Surface", "−201 °C"], ["Geysers", "100 jets, 800 m/s"]],
      facts: ["Its plumes feed Saturn's E ring.", "The plume contains organics and molecular hydrogen — food for microbes.", "It reflects 90 % of the light that hits it: the whitest body known."] },
    {
      id: "uranus", name: "Uranus", kind: "Planet · ice giant", parent: "sun", size: 2.0, a: A(19.2), spin: -0.4, tilt: 1.71, tex: { type: "gas", seed: 101, bands: 5, wobble: 0.7, palette: [[152, 208, 216], [178, 224, 230], [138, 196, 208], [188, 232, 238]], haze: true, grain: 0 },
      intro: "An ice giant knocked onto its side by an ancient collision — it rolls around the Sun with its poles pointing at the star.",
      data: [["Diameter", "50,724 km"], ["Gravity", "8.69 m/s²"], ["Cloud tops", "−197 °C"], ["Day", "17.2 hours"], ["Year", "84 years"], ["Moons", "28 known"]],
      facts: [
        "Its axis is tilted 98°: each pole gets 42 years of daylight, then 42 of night.",
        "It is the coldest planetary atmosphere measured: −224 °C in places.",
        "Herschel found it in 1781 — the first planet ever discovered by telescope."
      ],
      missions: ["Voyager 2 (1986) — the only spacecraft ever to visit.", "A flagship Uranus mission is the planetary decadal survey's top pick."]
    },
    { id: "titania", name: "Titania", kind: "Moon of Uranus", parent: "uranus", size: 0.26, a: 3.8, spin: 0.04, tex: { type: "rocky", seed: 105, low: [140, 128, 120], high: [204, 196, 188], craters: 60, grain: 0.05 },
      intro: "The largest Uranian moon, scarred by enormous fault canyons that hint at an expansion long ago.",
      data: [["Diameter", "1,578 km"], ["Surface", "−203 °C"]],
      facts: ["Its Messina Chasma canyon runs 1,500 km.", "It is named for the queen of the fairies in A Midsummer Night's Dream.", "Like all Uranian moons it orbits the planet sideways."] },
    {
      id: "neptune", name: "Neptune", kind: "Planet · ice giant", parent: "sun", size: 1.95, a: A(30.1), spin: 0.45, tex: { type: "gas", seed: 111, bands: 6, wobble: 0.9, palette: [[62, 98, 200], [88, 128, 224], [48, 82, 178], [110, 148, 238]], spot: [0.42, 0.4, 30, 50, 120], grain: 0 },
      intro: "The windiest world — supersonic storms tear through its methane-blue clouds, found by mathematics before any telescope saw it.",
      data: [["Diameter", "49,244 km"], ["Gravity", "11.15 m/s²"], ["Cloud tops", "−201 °C"], ["Day", "16.1 hours"], ["Year", "165 years"], ["Moons", "16 known"]],
      facts: [
        "Winds reach 2,100 km/h — the fastest in the solar system.",
        "Le Verrier predicted its position within a degree; Galle found it that same night in 1846.",
        "It has completed only one orbit since its discovery."
      ],
      missions: ["Voyager 2 (1989) — the only visit, which found the Great Dark Spot."]
    },
    { id: "triton", name: "Triton", kind: "Moon of Neptune", parent: "neptune", size: 0.26, a: 3.6, spin: 0.03, tex: { type: "rocky", seed: 115, low: [216, 196, 196], high: [240, 230, 228], craters: 20, grain: 0.03, capSouth: true },
      intro: "Neptune's great captive moon, orbiting backwards — a stolen Kuiper-belt world with nitrogen geysers and a surface of frozen dew.",
      data: [["Diameter", "2,707 km"], ["Surface", "−235 °C"], ["Orbit", "5.9 days, retrograde"]],
      facts: ["It is one of the coldest measured places in the system.", "Voyager 2 caught dark plumes rising 8 km.", "Its backwards orbit means Neptune captured it, probably with a goodbye of moons destroyed."] },
    {
      id: "pluto", name: "Pluto", kind: "Dwarf planet", parent: "sun", size: 0.42, a: A(39.5), spin: 0.09, tex: { type: "rocky", seed: 121, low: [148, 108, 84], high: [232, 214, 196], craters: 12, heart: true, grain: 0.05 },
      intro: "The king of the Kuiper belt — a world of nitrogen glaciers and water-ice mountains, demoted but beloved.",
      data: [["Diameter", "2,377 km"], ["Gravity", "0.62 m/s²"], ["Surface", "−229 °C"], ["Day", "6.4 days"], ["Year", "248 years"], ["Moons", "5"]],
      facts: [
        "Sputnik Planitia, its heart, is a convecting glacier of nitrogen ice.",
        "Its mountains are made of water ice, hard as rock at −229 °C.",
        "Its orbit is so eccentric that sometimes it is closer to the Sun than Neptune."
      ],
      missions: ["New Horizons (2015) — the flyby that revealed the heart.", "Discovery: Clyde Tombaugh, 1930, from Flagstaff."]
    },
    { id: "charon", name: "Charon", kind: "Moon of Pluto", parent: "pluto", size: 0.24, a: 1.5, spin: 0.03, tex: { type: "rocky", seed: 125, low: [130, 124, 118], high: [196, 190, 182], craters: 50, grain: 0.04, redCap: true },
      intro: "Half of Pluto's size and a quarter of its mass — the two orbit a point in empty space between them, a true binary.",
      data: [["Diameter", "1,212 km"], ["Surface", "−230 °C"], ["Orbit", "6.4 days"]],
      facts: ["Its north pole is stained red by methane escaping from Pluto.", "Pluto and Charon face each other forever, tidally locked both ways.", "Its Mordor Macula dark region sits squarely over that red cap."] },
    { id: "ceres", name: "Ceres", kind: "Dwarf planet", parent: "sun", size: 0.35, a: A(2.77), spin: 0.25, tex: { type: "rocky", seed: 131, low: [104, 100, 96], high: [168, 164, 158], craters: 80, grain: 0.05, brightSpots: true },
      intro: "The largest object in the asteroid belt and the closest dwarf planet — an ocean world in miniature, hiding brine under its crust.",
      data: [["Diameter", "940 km"], ["Gravity", "0.28 m/s²"], ["Surface", "−105 °C"], ["Year", "4.6 years"]],
      facts: ["Its bright spots in Occator crater are salt left by escaping brine.", "It may hold more fresh water than Earth does, frozen under the surface.", "Discovered in 1801, it was called a planet for half a century."] }
  ];

  const POIS = [
    {
      id: "orion", name: "The Orion Nebula", kind: "Stellar nursery", pos: [420, 130, 620], scale: 380, hue: 200, sprite: "nebula",
      intro: "A cloud of collapsing gas 1,344 light-years away, lit from within by two thousand newborn stars. Somewhere in that glow, planets like yours are condensing right now.",
      data: [["Distance", "1,344 light-years"], ["Span", "24 light-years"], ["Young stars", "~2,000"], ["Age", "~2 million yr"]],
      facts: [
        "It is visible to the naked eye as the middle 'star' of Orion's sword.",
        "The Trapezium cluster at its heart is only 300,000 years old.",
        "Its gas, if it were here, would span the distance from the Sun to Alpha Centauri."
      ]
    },
    {
      id: "lagoon", name: "The Lagoon Nebula", kind: "Stellar nursery", pos: [-620, -80, 480], scale: 330, hue: 330, sprite: "nebula",
      intro: "A vast hydrogen cloud 4,100 light-years out, folding pink and violet around clusters of infant suns.",
      data: [["Distance", "4,100 light-years"], ["Span", "110 light-years"]],
      facts: ["It contains the Hourglass — a region lit by a star 200,000 times brighter than the Sun.", "Galileo drew the cluster inside it in 1610.", "It spans an area of sky four full moons wide."] },
    {
      id: "ring-neb", name: "The Ring Nebula", kind: "A dying star", pos: [-380, 220, -540], scale: 240, hue: 285, sprite: "nebula",
      intro: "What our Sun becomes: a dying star exhaling its outer layers into a glowing ring, one day at a time.",
      data: [["Distance", "2,570 light-years"], ["Span", "1 light-year"], ["Central star", "120,000 K"]],
      facts: ["The Sun will do exactly this in about 6 billion years.", "The 'ring' is really a bubble we see through.", "Its white-dwarf core is as massive as the Sun, squeezed into an Earth-sized ball."] },
    {
      id: "cygnus", name: "Cygnus X-1", kind: "Black hole", pos: [560, 90, -760], scale: 1, viewDist: 120,
      intro: "The first black hole humanity ever accepted — 21 Suns of mass folded into nothing, feeding on a blue companion star. Its accretion disk burns at millions of degrees. Feel the pull: near it, your engines will strain against its gravity.",
      data: [["Mass", "21 Suns"], ["Distance", "7,200 light-years"], ["Event horizon", "≈ 62 km across"], ["Discovered", "1964, by X-ray"]],
      facts: [
        "Hawking bet against it being a black hole — and conceded in 1990.",
        "Matter spiralling in releases more energy than fusion, per kilogram.",
        "Time slows near it: an hour at its edge is years for the rest of us."
      ]
    },
    {
      id: "galaxy", name: "The Milky Way", kind: "Galaxy · your home", pos: [1700, 480, -2000], scale: 1, sprite: "galaxy",
      intro: "A barred spiral of at least a hundred billion stars, 100,000 light-years across. You are inside it already — this is the view from outside, the view no human has ever had.",
      data: [["Span", "100,000+ light-years"], ["Stars", "100–400 billion"], ["Galactic year", "225 million years"], ["Central black hole", "Sagittarius A*, 4.15 M Sun"]],
      facts: [
        "The Sun has completed about 20 orbits of the galaxy in its lifetime.",
        "We are 26,000 light-years from the centre, in a quiet suburb of the Orion Arm.",
        "The Andromeda galaxy will merge with this one in about 4.5 billion years."
      ]
    }
  ];

  /* ---------------- the build ---------------- */
  const container = document.getElementById("scene");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  } catch (e) {
    document.getElementById("loader-msg").textContent = "WebGL is not available in this browser — COSMOS needs it to fly.";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 30000);
  camera.rotation.order = "YXZ";
  camera.position.set(-26, 15, 58);

  const setSize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  setSize();
  addEventListener("resize", setSize);

  scene.add(new THREE.AmbientLight(0x8090b8, 0.44));
  const sunLight = new THREE.PointLight(0xfff1dc, 2.4, 0, 0);
  scene.add(sunLight);

  const REG = {};          /* id -> body record (mesh anchors, data) */
  const HIT = [];          /* raycastable meshes */
  const loaderBar = document.getElementById("loader-bar");
  const loaderMsg = document.getElementById("loader-msg");
  const stage = async (frac, msg) => {
    loaderBar.style.width = `${Math.round(frac * 100)}%`;
    if (msg) loaderMsg.textContent = msg;
    await new Promise((r) => setTimeout(r, 30));
  };

  const bodyTexture = (t) => {
    const [c, ctx] = canvasOf(512, 256);
    if (t.type === "rocky") paintRocky(ctx, 512, 256, t);
    else if (t.type === "gas") paintGas(ctx, 512, 256, t);
    else if (t.type === "earth") paintEarth(ctx, 512, 256, t);
    else if (t.type === "sun") paintSun(ctx, 512, 256, t);
    return toTexture(c);
  };

  const build = async () => {
    /* --- starfield, two depths --- */
    await stage(0.05, "lighting the stars…");
    {
      const rnd = mulberry32(9);
      for (const [count, size, rMin, rMax] of [[11000, 1.5, 2400, 4200], [1600, 3.2, 2200, 4000]]) {
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          const u = rnd() * 2 - 1, th = rnd() * TAU, r = rMin + rnd() * (rMax - rMin);
          const s = Math.sqrt(1 - u * u);
          pos[i * 3] = r * s * Math.cos(th);
          pos[i * 3 + 1] = r * u;
          pos[i * 3 + 2] = r * s * Math.sin(th);
          const warm = rnd();
          const b = 0.55 + rnd() * 0.45;
          col[i * 3] = b * (warm > 0.85 ? 1 : 0.82 + rnd() * 0.18);
          col[i * 3 + 1] = b * 0.9;
          col[i * 3 + 2] = b * (warm > 0.85 ? 0.75 : 1);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        scene.add(new THREE.Points(g, new THREE.PointsMaterial({
          size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false
        })));
      }
    }

    /* --- the Milky Way painted on the sky --- */
    await stage(0.14, "pouring the Milky Way…");
    {
      const [c, ctx] = canvasOf(2048, 1024);
      paintMilkyWay(ctx, 2048, 1024);
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(5200, 48, 24),
        new THREE.MeshBasicMaterial({ map: toTexture(c), side: THREE.BackSide, depthWrite: false })
      );
      sky.rotation.z = 0.35;
      sky.rotation.x = 0.2;
      scene.add(sky);
    }

    /* --- distant galaxies --- */
    {
      const rnd = mulberry32(77);
      for (let i = 0; i < 8; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: galaxySprite(300 + i), transparent: true, opacity: 0.8, depthWrite: false,
          blending: THREE.AdditiveBlending
        }));
        const u = rnd() * 2 - 1, th = rnd() * TAU, r = 3600 + rnd() * 900;
        const sq = Math.sqrt(1 - u * u);
        s.position.set(r * sq * Math.cos(th), r * u, r * sq * Math.sin(th));
        const sc = 130 + rnd() * 180;
        s.scale.set(sc, sc * 0.7, 1);
        s.material.rotation = rnd() * TAU;
        scene.add(s);
      }
    }

    /* --- nebulae --- */
    await stage(0.24, "blowing the nebulae…");
    for (const poi of POIS.filter((p) => p.sprite === "nebula")) {
      const grp = new THREE.Group();
      grp.position.set(...poi.pos);
      const rnd = mulberry32(poi.hue * 31);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({
        map: nebulaSprite(poi.hue * 7, poi.hue), transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      core.scale.set(poi.scale * 2.2, poi.scale * 1.7, 1);
      grp.add(core);
      for (let i = 0; i < 14; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: nebulaSprite(poi.hue * 13 + i, poi.hue + (rnd() - 0.5) * 60), transparent: true,
          opacity: 0.5 + rnd() * 0.4, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        const a = rnd() * TAU, r = poi.scale * (0.2 + rnd() * 0.75);
        s.position.set(Math.cos(a) * r, (rnd() - 0.5) * poi.scale * 0.5, Math.sin(a) * r * 0.7);
        const sc = poi.scale * (0.25 + rnd() * 0.5);
        s.scale.set(sc, sc, 1);
        s.userData.drift = { seed: rnd() * TAU, amp: 0.4 + rnd() * 0.9 };
        grp.add(s);
        s.userData.isNeb = true;
      }
      /* embedded newborn stars */
      const n = 90, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, r = poi.scale * 0.9 * Math.cbrt(rnd());
        pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = (rnd() - 0.5) * poi.scale * 0.4; pos[i * 3 + 2] = Math.sin(a) * r * 0.7;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      grp.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false })));
      const hit = new THREE.Mesh(new THREE.SphereGeometry(poi.scale * 1.1, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.userData.poiId = poi.id;
      grp.add(hit);
      HIT.push(hit);
      poi.grp = grp;
      poi.worldPos = new THREE.Vector3(...poi.pos);
      scene.add(grp);
    }

    /* --- the Sun --- */
    await stage(0.36, "igniting the Sun…");
    {
      const sun = BODIES[0];
      const grp = new THREE.Group();
      scene.add(grp);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(sun.size, 48, 32),
        new THREE.MeshBasicMaterial({ map: bodyTexture(sun.tex) })
      );
      grp.add(mesh);
      const corona1 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite("rgba(255,196,110,0.8)", 0.18), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      corona1.scale.set(sun.size * 4.5, sun.size * 4.5, 1);
      grp.add(corona1);
      const corona2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite("rgba(255,150,60,0.24)", 0.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      corona2.scale.set(sun.size * 6, sun.size * 6, 1);
      grp.add(corona2);
      const hit = mesh;
      hit.userData.bodyId = sun.id;
      HIT.push(hit);
      REG[sun.id] = { ...sun, grp, mesh, angle: 0, worldPos: new THREE.Vector3() };
    }

    /* --- rings texture --- */
    let ringsTex;
    {
      const [c, ctx] = canvasOf(1024, 8);
      paintBands1D(ctx, 1024, 8, { seed: 500, rings: [[0.04, 0.30, 0.75], [0.33, 0.46, 0.25], [0.48, 0.78, 0.9], [0.80, 0.93, 0.35]] });
      ringsTex = toTexture(c);
    }

    /* --- planets, moons, rings, orbits --- */
    await stage(0.5, "winding up the worlds…");
    for (const b of BODIES.slice(1)) {
      const parent = b.parent === "sun" ? null : REG[b.parent];
      const anchor = new THREE.Group();
      if (parent) parent.grp.add(anchor);
      else scene.add(anchor);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(b.size, 48, 32),
        new THREE.MeshStandardMaterial({ map: bodyTexture(b.tex), roughness: 0.94, metalness: 0 })
      );
      if (b.tilt) mesh.rotation.z = b.tilt;
      mesh.userData.bodyId = b.id;
      anchor.add(mesh);
      HIT.push(mesh);

      if (b.ring) {
        const geo = new THREE.RingGeometry(b.size * b.ring.i, b.size * b.ring.o, 96, 1);
        /* remap uv so u follows radius */
        const uv = geo.attributes.uv, p = geo.attributes.position;
        for (let i = 0; i < uv.count; i++) {
          const r = Math.hypot(p.getX(i), p.getY(i));
          uv.setXY(i, (r - b.size * b.ring.i) / (b.size * (b.ring.o - b.ring.i)), 0.5);
        }
        const mat = new THREE.MeshBasicMaterial({
          map: ringsTex, side: THREE.DoubleSide, transparent: true, depthWrite: false,
          opacity: b.id === "saturn" ? 0.95 : 0.35
        });
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = Math.PI / 2 - 0.42;
        if (b.tilt) ring.rotation.z = -b.tilt;
        anchor.add(ring);
      }

      /* orbit line */
      if (b.parent === "sun" || !parent) {
        const pts = [];
        for (let i = 0; i <= 180; i++) {
          const a = (i / 180) * TAU;
          pts.push(new THREE.Vector3(Math.cos(a) * b.a, Math.sin(a + b.a) * b.a * 0.02, Math.sin(a) * b.a));
        }
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: 0x7ca8d8, transparent: true, opacity: 0.14 }));
        scene.add(line);
      }

      REG[b.id] = {
        ...b, grp: anchor, anchor, mesh,
        angle: mulberry32(b.id.length * 97)() * TAU,
        period: parent ? parent.size + 6 : YEARS(b.a / 14 > 0 ? (b.a / 14) : 1),
        worldPos: new THREE.Vector3(),
        parentRec: parent || null
      };
      if (parent) REG[b.id].period = 14 + b.a * 5;
    }

    /* fix real orbital periods for planets (top-level) */
    for (const id in REG) {
      const r = REG[id];
      if (!r.parentRec && id !== "sun") r.period = YEARS(Math.pow(r.a / 14, 1 / 0.6));
    }

    /* --- asteroid belt --- */
    await stage(0.66, "scattering the belt…");
    {
      const n = 750;
      const inst = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.MeshStandardMaterial({ color: 0x8d8f98, roughness: 1 }),
        n
      );
      const dummy = new THREE.Object3D();
      const rnd = mulberry32(313);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU;
        const r = 24 + rnd() * 8 + Math.sin(i * 12.9898) * 1.4;
        dummy.position.set(Math.cos(a) * r, (rnd() - 0.5) * 2.2, Math.sin(a) * r);
        dummy.rotation.set(rnd() * TAU, rnd() * TAU, rnd() * TAU);
        dummy.scale.setScalar(0.05 + Math.pow(rnd(), 2.5) * 0.42);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      const belt = new THREE.Group();
      belt.add(inst);
      scene.add(belt);
      REG.__belt = { grp: belt };
    }

    /* --- cosmic dust --- */
    {
      const n = 1400, pos = new Float32Array(n * 3);
      const rnd = mulberry32(888);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, r = 6 + rnd() * 180;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = (rnd() - 0.5) * 6;
        pos[i * 3 + 2] = Math.sin(a) * r;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({
        color: 0x9fb8e8, size: 0.22, sizeAttenuation: true, transparent: true, opacity: 0.35, depthWrite: false
      })));
    }

    /* --- the black hole --- */
    await stage(0.8, "waking the black hole…");
    {
      const poi = POIS.find((p) => p.id === "cygnus");
      const grp = new THREE.Group();
      grp.position.set(...poi.pos);
      grp.rotation.z = 0.2;
      scene.add(grp);

      const shadow = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      grp.add(shadow);

      const photon = new THREE.Mesh(
        new THREE.TorusGeometry(15.7, 0.28, 8, 96),
        new THREE.MeshBasicMaterial({ color: 0xcfe2ff })
      );
      grp.add(photon);

      const diskGeo = new THREE.RingGeometry(17, 52, 128, 1);
      const diskMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: { t: { value: 0 } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vec2 p = position.xy;
            float r = length(p);
            vUv = vec2(atan(p.y, p.x) / 6.28318 + 0.5, r);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying vec2 vUv;
          uniform float t;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                       mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
          }
          void main() {
            float ang = vUv.x * 8.0;
            float r = vUv.y;
            float sp = 9.0 / max(r * 0.35, 0.5);
            float n = noise(vec2(ang * 2.0 + t * sp, r * 7.0 - t * 0.8));
            n = 0.6 * n + 0.4 * noise(vec2(ang * 5.0 - t * sp * 1.7, r * 14.0));
            float heat = smoothstep(52.0, 17.0, r);
            vec3 col = mix(vec3(0.35, 0.08, 0.02), vec3(1.0, 0.62, 0.25), heat);
            col = mix(col, vec3(1.0, 0.92, 0.75), pow(heat, 3.0));
            float a = heat * (0.35 + 0.75 * n);
            a *= smoothstep(17.0, 19.0, r) * (0.35 + 0.65 * smoothstep(52.0, 30.0, r));
            gl_FragColor = vec4(col * (0.7 + 0.9 * n), a);
          }`
      });
      const disk = new THREE.Mesh(diskGeo, diskMat);
      disk.rotation.x = Math.PI / 2 - 0.32;
      grp.add(disk);

      /* infalling particles */
      const n = 700;
      const parts = [];
      const rnd = mulberry32(1001);
      for (let i = 0; i < n; i++) parts.push({ a: rnd() * TAU, r: 40 + rnd() * 90, y: (rnd() - 0.5) * 4, s: 0.4 + rnd() * 0.8 });
      const ppos = new Float32Array(n * 3);
      const pg = new THREE.BufferGeometry();
      pg.setAttribute("position", new THREE.BufferAttribute(ppos, 3));
      const points = new THREE.Points(pg, new THREE.PointsMaterial({
        color: 0xffc9a0, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      grp.add(points);

      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite("rgba(255,170,90,0.5)", 0.12), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.set(190, 190, 1);
      grp.add(halo);

      const hit = new THREE.Mesh(new THREE.SphereGeometry(70, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.userData.poiId = "cygnus";
      grp.add(hit);
      HIT.push(hit);

      poi.grp = grp;
      poi.diskMat = diskMat;
      poi.parts = { arr: parts, geo: pg, points };
      poi.worldPos = new THREE.Vector3(...poi.pos);
    }

    /* --- the Milky Way, visitable --- */
    await stage(0.92, "spinning up the galaxy…");
    {
      const poi = POIS.find((p) => p.id === "galaxy");
      const grp = new THREE.Group();
      grp.position.set(...poi.pos);
      grp.rotation.x = -0.55;
      grp.rotation.z = 0.2;
      scene.add(grp);

      const n = 34000;
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const rnd = mulberry32(2026);
      const coreC = new THREE.Color(0xffe4b8), armC = new THREE.Color(0x9dbcff), dustC = new THREE.Color(0x6a7bb8);
      for (let i = 0; i < n; i++) {
        const r = Math.pow(rnd(), 0.9) * 300 + 8;   /* flatter profile: fewer stars crowd the core */
        const arm = i % 2;
        const th = r * 0.028 + arm * Math.PI + (rnd() - 0.5) * (0.7 + r * 0.004);
        const scatter = (rnd() + rnd() + rnd() - 1.5) * (14 + r * 0.05);
        pos[i * 3] = Math.cos(th) * r + scatter;
        pos[i * 3 + 1] = (rnd() + rnd() - 1) * Math.max(3, 26 - r * 0.07);
        pos[i * 3 + 2] = Math.sin(th) * r + scatter;
        const c = new THREE.Color().copy(coreC).lerp(rnd() < 0.15 ? dustC : armC, clamp(r / 260, 0, 1));
        const b = (0.4 + rnd() * 0.6) * clamp(0.22 + r / 90, 0.22, 1);  /* keep the core from blowing out */
        col[i * 3] = c.r * b; col[i * 3 + 1] = c.g * b; col[i * 3 + 2] = c.b * b;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({
        size: 1.9, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      grp.add(pts);

      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite("rgba(255,222,170,0.5)", 0.16), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      core.scale.set(130, 105, 1);
      grp.add(core);

      const hit = new THREE.Mesh(new THREE.SphereGeometry(200, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.userData.poiId = "galaxy";
      grp.add(hit);
      HIT.push(hit);

      poi.grp = grp;
      poi.worldPos = new THREE.Vector3(...poi.pos);
    }

    await stage(1, "ready for departure");
  };

  /* ---------------- flight controls ---------------- */
  const state = {
    yaw: 0.35, pitch: -0.12, roll: 0,
    vel: new THREE.Vector3(),
    keys: {},
    mode: "explore",
    timeScale: 1, paused: false,
    simT: 0,
    focus: null,          /* body or poi record */
    focusOffset: new THREE.Vector3(),
    tween: null,
    drag: null,
    touch: new Map(),
    pinch: 0,
    boost: false,
    travelHint: false
  };
  const SHIP_MAX = 620, EXPLORE_MAX = 95;

  const onKey = (e) => {
    const k = e.key.toLowerCase();
    if (e.type === "keydown") {
      if (k === "m") toggleMap();
      else if (k === "h") toggleHelp();
      else if (k === "p") togglePause();
      else if (k === "x") toggleMode();
      else if (k === "escape") closeAll();
      else if (k === ",") setTimeScale(Math.max(0.25, state.timeScale / 2));
      else if (k === ".") setTimeScale(Math.min(4, state.timeScale * 2));
      else if (k === " ") { state.vel.set(0, 0, 0); e.preventDefault(); }
    }
    state.keys[k] = e.type === "keydown";
    if (["w", "a", "s", "d", "r", "f", "q", "e"].includes(k)) e.preventDefault();
  };
  addEventListener("keydown", onKey);
  addEventListener("keyup", onKey);

  const dom = renderer.domElement;
  let downAt = 0, downXY = [0, 0], moved = 0;

  dom.addEventListener("pointerdown", (e) => {
    dom.setPointerCapture(e.pointerId);
    state.touch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.touch.size === 2) {
      const p = [...state.touch.values()];
      state.pinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }
    downAt = performance.now();
    downXY = [e.clientX, e.clientY];
    moved = 0;
  });
  dom.addEventListener("pointermove", (e) => {
    hover(e);
    const rec = state.touch.get(e.pointerId);
    if (!rec) return;
    const dx = e.clientX - rec.x, dy = e.clientY - rec.y;
    rec.x = e.clientX; rec.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (state.touch.size === 1) {
      const k = 0.0026;
      state.yaw -= dx * k;
      state.pitch = clamp(state.pitch - dy * k, -1.55, 1.55);
    } else if (state.touch.size === 2) {
      const p = [...state.touch.values()];
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (state.pinch) {
        const fwd = new THREE.Vector3();
        camera.getWorldDirection(fwd);
        state.vel.addScaledVector(fwd, (d - state.pinch) * 1.6);
      }
      state.pinch = d;
    }
  });
  const endPointer = (e) => {
    state.touch.delete(e.pointerId);
    state.pinch = 0;
    if (state.touch.size === 0 && moved < 7 && performance.now() - downAt < 500) {
      tryClick(e);
    }
  };
  dom.addEventListener("pointerup", endPointer);
  dom.addEventListener("pointercancel", endPointer);
  dom.addEventListener("wheel", (e) => {
    e.preventDefault();
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    if (state.focus) {
      state.focusDist = clamp((state.focusDist || 20) * (1 + Math.sign(e.deltaY) * 0.12), 3, 800);
    } else {
      state.vel.addScaledVector(fwd, -e.deltaY * 0.045);
    }
  }, { passive: false });

  const tryClick = (e) => {
    const rect = dom.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(v, camera);
    const hits = rc.intersectObjects(HIT, false);
    if (hits.length) {
      const o = hits[0].object;
      const id = o.userData.bodyId || o.userData.poiId;
      if (id) openEntity(id);
    }
  };

  const hoverLabel = document.getElementById("hover-label");
  let hoverTick = 0;
  const hover = (e) => {
    if (++hoverTick % 3) return;
    const rect = dom.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(v, camera);
    const hits = rc.intersectObjects(HIT, false);
    if (hits.length) {
      const o = hits[0].object;
      const id = o.userData.bodyId || o.userData.poiId;
      const rec = REG[id] || POIS.find((p) => p.id === id);
      if (rec) {
        hoverLabel.textContent = rec.name;
        hoverLabel.style.display = "block";
        hoverLabel.style.left = `${e.clientX}px`;
        hoverLabel.style.top = `${e.clientY}px`;
        dom.style.cursor = "pointer";
        return;
      }
    }
    hoverLabel.style.display = "none";
    dom.style.cursor = "grab";
  };

  /* ---------------- travel + focus ---------------- */
  const posOf = (rec) => {
    if (rec.kind && REG[rec.id]) return REG[rec.id].worldPos;
    return rec.worldPos;
  };

  const openEntity = (id) => {
    const rec = REG[id] || POIS.find((p) => p.id === id);
    if (!rec) return;
    travelTo(rec);
    showPanel(rec);
    document.getElementById("hint").classList.add("gone");
  };

  const travelTo = (rec) => {
    const from = camera.position.clone();
    const fromQ = camera.quaternion.clone();
    state.focus = rec;
    state.focusDist = rec.size ? Math.max(rec.size * 4.5, rec.size + 2.5)
      : (rec.viewDist || (rec.sprite === "galaxy" ? 420 : rec.scale * 1.6));
    const look = new THREE.Vector3();
    camera.getWorldDirection(look);
    state.focusOffset.copy(look).multiplyScalar(-state.focusDist);
    state.focusOffset.y += state.focusDist * 0.25;
    state.tween = { t: 0, dur: 2.4, from, fromQ };
  };

  const releaseFocus = () => {
    state.focus = null;
    state.tween = null;
    hidePanel();
  };

  const showPanel = (rec) => {
    document.getElementById("panel-kind").textContent = rec.kind;
    document.getElementById("panel-name").textContent = rec.name;
    document.getElementById("panel-intro").textContent = rec.intro;
    const data = document.getElementById("panel-data");
    data.innerHTML = "";
    for (const [k, v] of rec.data) {
      const div = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      div.append(dt, dd);
      data.append(div);
    }
    const facts = document.getElementById("panel-facts");
    facts.innerHTML = "";
    for (const f of rec.facts) {
      const li = document.createElement("li");
      li.textContent = f;
      facts.append(li);
    }
    const mWrap = document.getElementById("panel-missions-wrap");
    if (rec.missions) {
      mWrap.style.display = "";
      const m = document.getElementById("panel-missions");
      m.innerHTML = "";
      for (const f of rec.missions) {
        const li = document.createElement("li");
        li.textContent = f;
        m.append(li);
      }
    } else mWrap.style.display = "none";
    document.getElementById("panel").classList.add("open");
    markHere(rec.id);
  };
  const hidePanel = () => {
    document.getElementById("panel").classList.remove("open");
    markHere(null);
  };
  document.getElementById("panel-close").addEventListener("click", releaseFocus);

  /* ---------------- UI chrome ---------------- */
  const destList = document.getElementById("dest-list");
  const DEST_ORDER = ["sun", "mercury", "venus", "earth", "moon", "mars", "ceres", "jupiter", "saturn", "uranus", "neptune", "pluto", "orion", "cygnus", "galaxy"];
  const markHere = (id) => {
    for (const btn of destList.querySelectorAll("button")) {
      btn.classList.toggle("here", btn.dataset.id === id);
    }
  };
  for (const id of DEST_ORDER) {
    const rec = REG[id] || POIS.find((p) => p.id === id);
    if (!rec) continue;
    const btn = document.createElement("button");
    btn.dataset.id = id;
    btn.innerHTML = `${rec.name}`;
    btn.addEventListener("click", () => openEntity(id));
    destList.append(btn);
  }
  /* note: REG is filled during build; rebuild list after */
  const buildDestList = () => {
    destList.innerHTML = "";
    for (const id of DEST_ORDER) {
      const rec = REG[id] || POIS.find((p) => p.id === id);
      if (!rec) continue;
      const btn = document.createElement("button");
      btn.dataset.id = id;
      btn.textContent = rec.name;
      btn.addEventListener("click", () => openEntity(id));
      destList.append(btn);
    }
  };

  const modeBtn = document.getElementById("mode-btn");
  const toggleMode = () => {
    state.mode = state.mode === "ship" ? "explore" : "ship";
    camera.fov = state.mode === "ship" ? 74 : 62;
    camera.updateProjectionMatrix();
    modeBtn.classList.toggle("on", state.mode === "ship");
    modeBtn.textContent = state.mode === "ship" ? "Explore mode" : "Ship mode";
  };
  modeBtn.addEventListener("click", toggleMode);

  const mapWrap = document.getElementById("map-wrap");
  const toggleMap = () => {
    const open = !mapWrap.classList.contains("open");
    mapWrap.classList.toggle("open", open);
    document.getElementById("map-btn").classList.toggle("on", open);
  };
  document.getElementById("map-btn").addEventListener("click", toggleMap);
  document.getElementById("map-close").addEventListener("click", toggleMap);

  const help = document.getElementById("help");
  const toggleHelp = () => help.classList.toggle("open", !help.classList.contains("open"));
  document.getElementById("help-btn").addEventListener("click", toggleHelp);
  help.addEventListener("click", (e) => { if (e.target === help) toggleHelp(); });

  const pausedCard = document.getElementById("paused");
  const togglePause = () => {
    state.paused = !state.paused;
    pausedCard.classList.toggle("open", state.paused);
    document.getElementById("pause-btn").classList.toggle("on", state.paused);
    document.getElementById("pause-btn").textContent = state.paused ? "Resume" : "Pause";
  };
  document.getElementById("pause-btn").addEventListener("click", togglePause);
  document.getElementById("resume-btn").addEventListener("click", togglePause);

  const setTimeScale = (v) => {
    state.timeScale = v;
    document.getElementById("clock-line").innerHTML = `time × <strong>${v.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}</strong>`;
  };

  const closeAll = () => {
    if (help.classList.contains("open")) toggleHelp();
    else if (mapWrap.classList.contains("open")) toggleMap();
    else if (document.getElementById("panel").classList.contains("open")) releaseFocus();
  };

  /* touch buttons */
  const hold = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener("pointerdown", (e) => { state.keys[key] = true; e.preventDefault(); });
    el.addEventListener("pointerup", () => { state.keys[key] = false; });
    el.addEventListener("pointerleave", () => { state.keys[key] = false; });
  };
  hold("t-fwd", "w"); hold("t-back", "s"); hold("t-boost", "shift");
  document.getElementById("t-brake").addEventListener("click", () => state.vel.set(0, 0, 0));

  /* ---------------- the map ---------------- */
  const mapCanvas = document.getElementById("map");
  const mapCtx = mapCanvas.getContext("2d");
  const drawMap = () => {
    const W = mapCanvas.width, H = mapCanvas.height;
    const cx = W / 2, cy = H / 2;
    /* compressed radial scale: pow 0.72 spreads the inner system, and the
       deep sky lands on a rim beyond Pluto instead of off the canvas */
    const MAP_MAX = A(39.5);                 /* Pluto's orbit, the system's edge */
    const R0 = Math.min(W, H) / 2 * 0.82;    /* Pluto's orbit on the map */
    const proj = (x, z, idx) => {
      const r = Math.hypot(x, z) || 0.0001;
      const rad = r <= MAP_MAX
        ? R0 * Math.pow(r / MAP_MAX, 0.72)
        : R0 + 14 + idx * 9;   /* one rim slot per destination, so labels never stack */
      return [cx + (x / r) * rad, cy + (z / r) * rad];
    };
    mapCtx.clearRect(0, 0, W, H);
    mapCtx.fillStyle = "rgba(4,6,13,0.9)";
    mapCtx.fillRect(0, 0, W, H);

    /* orbits, drawn at the same compressed radii */
    for (const id in REG) {
      const r = REG[id];
      if (r.parentRec || id === "sun") continue;
      mapCtx.strokeStyle = "rgba(124,168,216,0.16)";
      mapCtx.lineWidth = 1;
      mapCtx.beginPath();
      mapCtx.arc(cx, cy, R0 * Math.pow(r.a / MAP_MAX, 0.72), 0, TAU);
      mapCtx.stroke();
    }
    /* the edge of the system */
    mapCtx.strokeStyle = "rgba(124,168,216,0.28)";
    mapCtx.setLineDash([3, 6]);
    mapCtx.beginPath();
    mapCtx.arc(cx, cy, R0 + 8, 0, TAU);
    mapCtx.stroke();
    mapCtx.setLineDash([]);

    const dot = (x, y, r, color, label, sub, dy = 4, side = 1) => {
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(x, y, r, 0, TAU);
      mapCtx.fill();
      if (label && r > 1.5) {
        const lx = side > 0 ? x + r + 5 : x - r - 5;
        mapCtx.textAlign = side > 0 ? "left" : "right";
        mapCtx.fillStyle = "rgba(238,243,255,0.78)";
        mapCtx.font = "500 12px Mona Sans, sans-serif";
        mapCtx.fillText(label, lx, y + dy);
        if (sub) {
          mapCtx.fillStyle = "rgba(154,168,199,0.6)";
          mapCtx.font = "11px Mona Sans, sans-serif";
          mapCtx.fillText(sub, lx, y + dy + 13);
        }
        mapCtx.textAlign = "left";
      }
    };

    /* deep sky, on the rim beyond the system, labels alternating sides */
    POIS.forEach((poi, idx) => {
      const [x, y] = proj(poi.worldPos.x, poi.worldPos.z, idx);
      const side = idx % 2 ? -1 : 1;
      if (poi.id === "galaxy") {
        mapCtx.strokeStyle = "rgba(124,196,255,0.5)";
        mapCtx.lineWidth = 1.5;
        mapCtx.beginPath();
        mapCtx.arc(x, y, 9, 0, TAU);
        mapCtx.stroke();
        dot(x, y, 2.5, "#9cc6ff", poi.name, "100,000 light-years", 4, side);
      } else if (poi.id === "cygnus") {
        dot(x, y, 5, "#000", poi.name, "black hole", 4, side);
        mapCtx.strokeStyle = "rgba(255,170,110,0.8)";
        mapCtx.lineWidth = 1.5;
        mapCtx.beginPath();
        mapCtx.arc(x, y, 5, 0, TAU);
        mapCtx.stroke();
      } else {
        mapCtx.fillStyle = "rgba(150,190,255,0.3)";
        mapCtx.beginPath();
        mapCtx.arc(x, y, 13, 0, TAU);
        mapCtx.fill();
        dot(x, y, 3, "#cfe0ff", poi.name, poi.kind.toLowerCase(), 4, side);
      }
    });

    /* the system */
    dot(cx, cy, 6, "#ffd9a0", "The Sun");
    const labels = { mercury: 1, venus: 1, earth: 1, mars: 1, jupiter: 1, saturn: 1, uranus: 1, neptune: 1, pluto: 1, ceres: 1 };
    const labelDy = { mercury: -6, venus: 15, earth: -6, mars: 15 };  /* stagger the crowded inner orbits */
    for (const id in REG) {
      if (id === "sun" || id.startsWith("__")) continue;
      const r = REG[id];
      if (r.parentRec) {
        /* moons cluster beside their planet */
        const pp = r.parentRec.worldPos;
        const [px_, py_] = proj(pp.x, pp.z);
        const off = r.worldPos.clone().sub(pp);
        const dl = off.length() || 1;
        dot(px_ + (off.x / dl) * 6, py_ + (off.z / dl) * 6, 2, "#aab6cf", null);
      } else {
        const p = r.worldPos;
        const [x, y] = proj(p.x, p.z);
        const big = r.size > 1.5 ? 5 : 3.4;
        const col = { mercury: "#b8b2ac", venus: "#e8d0a0", earth: "#8fc4ff", mars: "#e8a070", jupiter: "#e8c8a0", saturn: "#f0e0b0", uranus: "#a0dfe8", neptune: "#7c9ce8", pluto: "#c8b8a8", ceres: "#a8a4a0" }[id] || "#cfd8ea";
        dot(x, y, big, col, labels[id] ? r.name : null, r.kind.split("·")[1] || "", labelDy[id] || 4);
      }
    }

    /* the ship */
    const cp = camera.position;
    const [sx, sy] = proj(cp.x, cp.z);
    mapCtx.strokeStyle = "rgba(124,196,255,0.95)";
    mapCtx.lineWidth = 1.6;
    mapCtx.beginPath();
    mapCtx.arc(sx, sy, 6, 0, TAU);
    mapCtx.moveTo(sx - 9, sy);
    mapCtx.lineTo(sx + 9, sy);
    mapCtx.moveTo(sx, sy - 9);
    mapCtx.lineTo(sx, sy + 9);
    mapCtx.stroke();

    mapCtx.fillStyle = "rgba(154,168,199,0.7)";
    mapCtx.font = "12px Mona Sans, sans-serif";
    mapCtx.fillText("top-down · inner orbits spread · deep sky on the rim · click any dot to fly there", 16, H - 14);
  };
  mapCanvas.addEventListener("click", (e) => {
    const rect = mapCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (mapCanvas.width / rect.width);
    const my = (e.clientY - rect.top) * (mapCanvas.height / rect.height);
    let best = null, bestD = 22;
    const consider = (x, y, fn) => {
      const d = Math.hypot(x - mx, y - my);
      if (d < bestD) { bestD = d; best = fn; }
    };
    /* nearest body in the same compressed projection drawMap uses */
    const MAP_MAX = A(39.5);
    const R0 = Math.min(mapCanvas.width, mapCanvas.height) / 2 * 0.82;
    const P = (x, z, idx) => {
      const r = Math.hypot(x, z) || 0.0001;
      const rad = r <= MAP_MAX
        ? R0 * Math.pow(r / MAP_MAX, 0.72)
        : R0 + 14 + idx * 9;
      return [mapCanvas.width / 2 + (x / r) * rad, mapCanvas.height / 2 + (z / r) * rad];
    };
    for (const id in REG) {
      if (id === "sun" || id.startsWith("__")) continue;
      const r = REG[id];
      if (r.parentRec) continue;
      const [x, y] = P(r.worldPos.x, r.worldPos.z);
      consider(x, y, () => openEntity(id));
    }
    POIS.forEach((poi, idx) => {
      const [x, y] = P(poi.worldPos.x, poi.worldPos.z, idx);
      consider(x, y, () => openEntity(poi.id));
    });
    consider(mapCanvas.width / 2, mapCanvas.height / 2, () => openEntity("sun"));
    if (best) { best(); toggleMap(); }
  });

  /* ---------------- the loop ---------------- */
  const clock = new THREE.Clock();
  const speedLine = document.getElementById("speed-line");
  const posLine = document.getElementById("pos-line");
  const fwdV = new THREE.Vector3(), rightV = new THREE.Vector3(), accV = new THREE.Vector3();
  let uiTick = 0;

  const updateOrbits = (dt) => {
    state.simT += dt * state.timeScale;
    for (const id in REG) {
      if (id.startsWith("__")) continue;
      const r = REG[id];
      if (id === "sun") { r.grp.position.set(0, 0, 0); r.worldPos.set(0, 0, 0); continue; }
      const a = r.angle + state.simT * TAU / r.period;
      const y = Math.sin(a + r.a) * r.a * 0.018;
      if (r.parentRec) {
        r.anchor.position.set(Math.cos(a) * r.a, y * 0.3, Math.sin(a) * r.a);
        r.worldPos.copy(r.parentRec.worldPos).add(r.anchor.position);
      } else {
        r.anchor.position.set(Math.cos(a) * r.a, y, Math.sin(a) * r.a);
        r.worldPos.copy(r.anchor.position);
      }
      r.mesh.rotation.y += r.spin * dt * state.timeScale;
    }
  };

  const updatePOIs = (dt, t) => {
    for (const poi of POIS) {
      if (poi.sprite === "nebula" && poi.grp) {
        for (const s of poi.grp.children) {
          if (s.userData.isNeb) {
            const d = s.userData.drift;
            s.material.rotation += dt * 0.01;
            s.position.y = Math.sin(t * 0.05 + d.seed) * d.amp;
          }
        }
      }
      if (poi.id === "cygnus" && poi.grp) {
        poi.diskMat.uniforms.t.value = t * 0.6;
        const p = poi.parts;
        for (let i = 0; i < p.arr.length; i++) {
          const q = p.arr[i];
          q.a += dt * 2.2 * q.s / Math.max(q.r * 0.05, 0.5);
          q.r -= dt * 2.4;
          if (q.r < 16) { q.r = 110 + Math.random() * 40; q.a = Math.random() * TAU; }
          p.geo.attributes.position.setXYZ(i, Math.cos(q.a) * q.r, q.y * (q.r / 90), Math.sin(q.a) * q.r);
        }
        p.geo.attributes.position.needsUpdate = true;
      }
      if (poi.id === "galaxy" && poi.grp) {
        poi.grp.rotation.y += dt * 0.004;
      }
    }
    if (REG.__belt) REG.__belt.grp.rotation.y += dt * 0.004 * state.timeScale;
  };

  const updateCamera = (dt) => {
    const flying = () => {
      const k = state.keys;
      return k.w || k.s || k.a || k.d || k.r || k.f;
    };
    /* tween */
    if (state.tween) {
      if (flying()) {
        state.tween = null;   /* grab the controls mid-flight */
      } else {
        state.tween.t += dt / state.tween.dur;
        const k = ease(clamp(state.tween.t, 0, 1));
        const rec = state.focus;
        const target = posOf(rec).clone().add(state.focusOffset);
        camera.position.lerpVectors(state.tween.from, target, k);
        const m = new THREE.Matrix4().lookAt(camera.position, posOf(rec), camera.up);
        const q = new THREE.Quaternion().setFromRotationMatrix(m);
        camera.quaternion.slerpQuaternions(state.tween.fromQ, q, k);
        if (state.tween.t >= 1) {
          state.tween = null;
          state.yaw = camera.rotation.y; state.pitch = camera.rotation.x;
        }
        return;
      }
    }
    /* focused: slow cinematic orbit */
    if (state.focus) {
      if (flying()) {
        state.focus = null;   /* flying away releases the orbit; the panel stays open */
      } else {
        const rec = state.focus;
        const target = posOf(rec);
        state.focusOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.05);
        const want = target.clone().add(state.focusOffset);
        camera.position.lerp(want, 1 - Math.exp(-4 * dt));
        const m = new THREE.Matrix4().lookAt(camera.position, target, camera.up);
        camera.quaternion.setFromRotationMatrix(m);
        state.yaw = camera.rotation.y; state.pitch = camera.rotation.x;
        return;
      }
    }
    /* free flight */
    const k = state.keys;
    const boost = k.shift ? 8 : 1;
    const max = (state.mode === "ship" ? SHIP_MAX : EXPLORE_MAX) * (k.shift ? 1 : 1);
    fwdV.set(0, 0, -1).applyQuaternion(camera.quaternion);
    rightV.set(1, 0, 0).applyQuaternion(camera.quaternion);
    accV.set(0, 0, 0);
    if (k.w) accV.add(fwdV);
    if (k.s) accV.addScaledVector(fwdV, -1);
    if (k.d) accV.add(rightV);
    if (k.a) accV.addScaledVector(rightV, -1);
    if (k.r) accV.y += 1;
    if (k.f) accV.y -= 1;
    if (accV.lengthSq() > 0) {
      accV.normalize();
      const thrust = state.mode === "ship" ? 170 * boost : 60 * boost;
      state.vel.addScaledVector(accV, thrust * dt);
      if (k.q) state.roll += dt * 1.1;
      if (k.e) state.roll -= dt * 1.1;
    } else {
      state.roll *= Math.exp(-1.4 * dt);
    }
    if (k.q) state.roll += dt * 0.9;
    if (k.e) state.roll -= dt * 0.9;
    state.vel.multiplyScalar(Math.exp(-(accV.lengthSq() > 0 ? 1.1 : 2.6) * dt));
    if (state.vel.length() > max) state.vel.setLength(max);

    /* the black hole pulls */
    const bh = POIS.find((p) => p.id === "cygnus");
    const toBH = bh.worldPos.clone().sub(camera.position);
    const rBH = toBH.length();
    if (rBH < 180 && !state.paused) {
      const pull = clamp(26000 / (rBH * rBH), 0, 14);
      state.vel.addScaledVector(toBH.normalize(), pull * dt);
    }

    camera.position.addScaledVector(state.vel, dt);
    camera.rotation.set(state.pitch, state.yaw, state.roll);

    /* keep out of the sun and planets */
    for (const id in REG) {
      if (id.startsWith("__")) continue;
      const r = REG[id];
      const d = camera.position.distanceTo(r.worldPos);
      const min = r.size * 1.35;
      if (d < min) {
        const push = camera.position.clone().sub(r.worldPos).setLength(min - d);
        camera.position.add(push);
        state.vel.multiplyScalar(0.5);
      }
    }
  };

  const updateHUD = () => {
    if (++uiTick % 6) return;
    const c = 0.028; /* units per light-second at 1 AU = 14 units → 1 u ≈ 10.7 Gm; c ≈ 0.028 u/s */
    const sp = state.vel.length() / c;
    speedLine.innerHTML = sp < 1
      ? `<b>${(sp * 299792).toFixed(0)} km/s</b>`
      : `<b>${fmt(Math.round(sp))}</b> × light-speed`;
    const au = camera.position.length() / 14;
    posLine.innerHTML = `at <strong>${au < 0.1 ? au.toFixed(3) : au.toFixed(1)} AU</strong> from the Sun`;
    if (state.focus) markHere(state.focus.id);
  };

  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!state.paused || true) {
      updateOrbits(dt);
      updatePOIs(dt, t);
    }
    updateCamera(dt);
    updateHUD();
    if (mapWrap.classList.contains("open")) drawMap();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };

  /* ---------------- go ---------------- */
  {
    /* open the flight aimed at the Sun */
    const tmp = camera.clone();
    tmp.lookAt(0, 0, 0);
    state.yaw = tmp.rotation.y;
    state.pitch = tmp.rotation.x;
    state.roll = tmp.rotation.z;
  }
  build().then(() => {
    buildDestList();
    document.getElementById("loader").classList.add("done");
    frame();
    setTimeout(() => document.getElementById("hint").classList.add("gone"), 12000);
  }).catch((err) => {
    console.error(err);
    loaderMsg.textContent = `The universe failed to assemble: ${err.message}`;
  });
})();
