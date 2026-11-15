/* ==========================================================================
   ATELIER — page controller
   --------------------------------------------------------------------------
   Architecture follows the standard three-part scroll model:
     input  -> a passive scroll listener only ever writes a target number
     state  -> a small object holds the target and the eased current value
     render -> one requestAnimationFrame loop eases state toward target and
               hands it to the 3D engine
   The scroll handler never renders, so we get exactly one draw per frame no
   matter how many scroll events arrive.
   ========================================================================== */

import { Turntable, Turntable2D, MOODS } from "./turntable.js?v=20261115-4";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

/* ---------- content ------------------------------------------------------ */
const PRODUCT = {
  name: "Ethnic Wear Men Sherwani in Golden Colour with Maroon Touch and Churidar Pajama",
  short: "Sherwani in Golden Colour with Maroon Touch",
  price: "₹6,999",
  maker: "Sohraaz Collections",
  origin: "Cut & stitched in our own Kolkata workshop",
  whatsapp: "919123947668",
  phone: "+91 91239 47668",
  email: "care@sohraaz.com",
  address: "12/1, Picnic Garden, 3rd Lane, Ground Floor, near 42 Bus Stand, Kolkata 700039",
  gstin: "19DIBPA3993Q12M",
};

/* The beats line up with the frame indices in frames.json:
   0-1 front, 2-5 three-quarter, 6-20 profile, 21-23 three-quarter rear,
   24-29 back, 30-33 three-quarter rear, 34-43 profile.                     */
const BEATS = [
  {
    at: 0.0,
    kicker: "The front",
    title: "A Sherwani that opens the evening",
    body:
      "Cream ground, gold beadwork at the collar and placket, and a maroon stole that carries the whole look. Every piece is cut and stitched in our own Kolkata workshop — no middleman between the loom and the man wearing it.",
    facts: [
      ["Ground", "Cream with gold touch"],
      ["Set", "Sherwani + churidar pajama"],
    ],
  },
  {
    at: 0.07,
    kicker: "Three-quarter",
    title: "The drape is the whole point",
    body:
      "Turn it a few degrees and the cloth changes character. The fall is cut long and easy so the hem moves when you walk, and the stole is hung to sit clean over one shoulder rather than fight the coat.",
    facts: [
      ["Silhouette", "Long, straight, full"],
      ["Finish", "Hand-set beadwork"],
    ],
  },
  {
    at: 0.18,
    kicker: "In profile",
    title: "Built for the side you forget",
    body:
      "Most of a groom's night is spent in profile — greeting, posing, being pulled into photographs. Side-on, the sherwani keeps its line: no bunching at the arm, no gap at the shoulder.",
    facts: [
      ["Shoulder", "Clean, set, no sag"],
      ["Sleeve", "Full length, tapered"],
    ],
  },
  {
    at: 0.56,
    kicker: "The back",
    title: "The side nobody sees is finished too",
    body:
      "Scroll further and the back comes round. The same cream brocade runs unbroken across the shoulder blades, the stole crosses it neatly, and the hem is levelled to the same fall as the front.",
    facts: [
      ["Back panel", "Unbroken brocade"],
      ["Hem", "Levelled front and back"],
    ],
  },
  {
    at: 0.71,
    kicker: "The stole",
    title: "One deep maroon, and it changes everything",
    body:
      "The maroon stole with its gold border is the only saturated colour on the garment, and it is what separates this sherwani from a plain cream one. It is the piece people remember.",
    facts: [
      ["Stole", "Maroon with gold border"],
      ["Weight", "Structured, not limp"],
    ],
  },
  {
    at: 0.82,
    kicker: "The churidar",
    title: "The bottom that keeps it together",
    body:
      "The churidar is cut to gather clean at the knee and sit still at the ankle, so the sherwani's hem has something to fall over. Complete the set, or wear the coat over what you already own.",
    facts: [
      ["Bottom", "Churidar, included"],
      ["Fit", "Sized XS to 2XL"],
    ],
  },
];

/* ---------- state -------------------------------------------------------- */
const state = {
  target: 0,      // raw scroll progress of the turntable section
  eased: 0,       // eased progress
  extraFrames: 0, // frames fed in by scrolling past the turntable
  scrub: 0,       // drag offset, in frames
  dragging: false,
  lastX: 0,
  visible: true,
};

/* ---------- boot --------------------------------------------------------- */
const loader = $("#loader");
const loaderBar = $("#loader-bar");
const loaderPct = $("#loader-pct");
const loaderMsg = $("#loader-msg");

function setProgress(p, msg) {
  const pct = Math.round(clamp(p, 0, 1) * 100);
  if (loaderBar) loaderBar.style.width = `${pct}%`;
  if (loaderPct) loaderPct.textContent = `${pct}%`;
  if (msg && loaderMsg) loaderMsg.textContent = msg;
}

function pickPreset() {
  const w = window.innerWidth;
  const slow = navigator.connection?.saveData || /2g/.test(navigator.connection?.effectiveType || "");
  if (slow || w <= 700) return "mobile";
  if (w <= 1100) return "mobile";
  return "desktop";
}

async function boot() {
  const preset = pickPreset();
  setProgress(0.02, "Preparing the studio");
  document.body.dataset.preset = preset;

  let manifest;
  try {
    const res = await fetch(`assets/frames-${preset}.json`);
    if (!res.ok) throw new Error(String(res.status));
    manifest = await res.json();
  } catch (err) {
    setProgress(1, "Could not load the turntable");
    if (loaderMsg) {
      loaderMsg.textContent = "Turntable unavailable — serve this folder over HTTP.";
    }
    console.error(err);
    return;
  }

  const canvas = $("#gl");
  const gl2d = $("#gl2d");

  const canGL2 = (() => {
    try {
      const c = document.createElement("canvas");
      return !!c.getContext("webgl2");
    } catch {
      return false;
    }
  })();

  let engine;
  if (canGL2) {
    engine = new Turntable(canvas);
  } else {
    document.body.classList.add("no-webgl");
    engine = new Turntable2D(gl2d);
  }
  window.__atelier = engine;

  setProgress(0.05, "Rendering 44 angles");
  const payload = await engine.load(manifest, `assets/frames-${preset}`, (p) => {
    setProgress(0.05 + p * 0.9, "Rendering 44 angles");
  });

  setProgress(0.97, "Lighting the set");
  await new Promise((r) => setTimeout(r, 180));

  if (engine instanceof Turntable) {
    engine.init(payload);
  } else {
    engine.ready = true;
    engine.resize?.();
  }

  setProgress(1, "Ready");
  await new Promise((r) => setTimeout(r, 260));
  loader.classList.add("done");
  document.body.classList.add("loaded");
  start();
}

/* ---------- scroll ------------------------------------------------------- */
const section = $("#turntable");
const nav = $("#nav");
const bar = $("#scroll-progress");

function readScroll() {
  const rect = section.getBoundingClientRect();
  const travel = rect.height - window.innerHeight;
  const q = travel > 0 ? clamp(-rect.top / travel, 0, 1) : 0;
  state.target = q;

  // read the scrolling element rather than window.scrollY: some engines make
  // the body the scroll container, and window.scrollY then stays at 0
  const scroller = document.scrollingElement || document.documentElement;
  const max = scroller.scrollHeight - window.innerHeight;
  const gp = max > 0 ? clamp(scroller.scrollTop / max, 0, 1) : 0;
  if (bar) bar.style.width = `${gp * 100}%`;
  nav.classList.toggle("stuck", scroller.scrollTop > 40);

  // the studio controls belong to the hero and the turn, not to the cards
  const studioEnd = section.offsetTop + section.offsetHeight - window.innerHeight;
  document.body.classList.toggle("hud-on", scroller.scrollTop < studioEnd);

  /* how far the page has moved into the content sections — the product
     steps aside as the words take over, but keeps moving in the background */
  const intoContent = clamp(
    (scroller.scrollTop - studioEnd) / (window.innerHeight * 0.55),
    0,
    1
  );
  const eng = window.__atelier;
  if (eng) eng.contentPhase = intoContent;

  /* Keep turning below the sweep. The frames cover 288 degrees, so the
     extra travel is folded into a triangle wave: the garment runs forward
     to the end of the sequence, eases back through it, and loops — with no
     seam, and no jump when the loop wraps. */
  state.extraFrames =
    clamp(
      (scroller.scrollTop - studioEnd) / Math.max(1, window.innerHeight),
      0,
      120
    ) * 12;
}

window.addEventListener("scroll", readScroll, { passive: true });
window.addEventListener("resize", () => {
  readScroll();
  window.__atelier?.resize?.();
});

// exposed so the turntable can be driven and inspected from the console
window.__atelierState = state;
window.__atelierRead = readScroll;

/* ---------- beats -------------------------------------------------------- */
const beatEls = $$(".beat");
const beatsEl = $(".beats");
let activeBeat = -1;

function paintBeats(q) {
  let idx = 0;
  for (let i = 0; i < BEATS.length; i++) if (q >= BEATS[i].at) idx = i;
  if (idx === activeBeat) return;
  activeBeat = idx;
  beatEls.forEach((el, i) => el.classList.toggle("on", i === idx));
}

/* the copy crosses to the other side of the stage when the garment does.
   The swap is hidden behind a short fade so the jump is never seen. The
   pending flag matters: without it the frame loop would call this every
   frame and restart the timer, so the swap would never complete. */
let sideTimer = null;
function paintSide(side) {
  if (!beatsEl) return;
  if (beatsEl.dataset.side === side || beatsEl.dataset.pending === side) return;
  beatsEl.dataset.pending = side;
  beatsEl.classList.add("switching");
  clearTimeout(sideTimer);
  sideTimer = setTimeout(() => {
    beatsEl.dataset.side = side;
    document.body.dataset.side = side;
    delete beatsEl.dataset.pending;
    beatsEl.classList.remove("switching");
  }, 380);
}

/* ---------- HUD ---------------------------------------------------------- */
const hudAngle = $("#hud-angle");
const hudView = $("#hud-view");
const moodBtns = $$(".mood");
const detailBtn = $("#detail-toggle");

moodBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    moodBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    window.__atelier?.setMood?.(btn.dataset.mood);
    const name = $("#mood-name");
    if (name) name.textContent = MOODS[btn.dataset.mood]?.name || "";
  });
});

detailBtn?.addEventListener("click", () => {
  const on = detailBtn.getAttribute("aria-pressed") !== "true";
  detailBtn.setAttribute("aria-pressed", String(on));
  window.__atelier?.setDetail?.(on);
});

/* ---------- drag to scrub ------------------------------------------------ */
const canvas = $("#gl");
let dragId = null;

function onDown(e) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  dragId = e.pointerId;
  state.dragging = true;
  state.lastX = e.clientX;
  canvas.classList.add("dragging");
  try {
    canvas.setPointerCapture?.(e.pointerId);
  } catch {
    /* synthetic pointers have nothing to capture */
  }
}

function onMove(e) {
  if (!state.dragging || e.pointerId !== dragId) return;
  const dx = e.clientX - state.lastX;
  state.lastX = e.clientX;
  // a drag across the width of the screen sweeps the whole turntable
  const n = window.__atelier?.manifest?.count || 44;
  const perPx = (n - 1) / Math.max(320, window.innerWidth * 0.8);
  state.scrub = clamp(state.scrub - dx * perPx, -(n - 1), n - 1);
}

function onUp(e) {
  if (e.pointerId !== dragId) return;
  state.dragging = false;
  dragId = null;
  canvas.classList.remove("dragging");
}

canvas?.addEventListener("pointerdown", onDown);
window.addEventListener("pointermove", onMove, { passive: true });
window.addEventListener("pointerup", onUp);
window.addEventListener("pointercancel", onUp);

/* ---------- keyboard ----------------------------------------------------- */
window.addEventListener("keydown", (e) => {
  const t = e.target;
  if (t && typeof t.matches === "function" && t.matches("input, textarea, select")) return;
  const eng = window.__atelier;
  if (!eng?.manifest) return;
  const n = eng.manifest.count;
  if (e.key === "ArrowRight") {
    state.scrub = clamp(state.scrub + 1.5, -(n - 1), n - 1);
    e.preventDefault();
  } else if (e.key === "ArrowLeft") {
    state.scrub = clamp(state.scrub - 1.5, -(n - 1), n - 1);
    e.preventDefault();
  }
});

/* ---------- reveal ------------------------------------------------------- */
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
);
$$(".rv").forEach((el) => io.observe(el));

/* ---------- pause when the stage is off screen ---------------------------- */
const stage = $("#stage");
if (stage) {
  new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        state.visible = en.isIntersecting;
        const eng = window.__atelier;
        if (!eng) return;
        if (en.isIntersecting) eng.start?.();
        else eng.stop?.();
      });
    },
    { threshold: 0 }
  ).observe(stage);
}

/* ---------- the one render loop ------------------------------------------ */
let last = performance.now();

/** Advance the page by one step. Called from the animation frame, and
    exposed so the turn can be driven from a console or a test harness. */
function step(dt) {
  // ease the progress, then hand it to the engine
  const k = 1 - Math.pow(0.0022, dt);
  state.eased += (state.target - state.eased) * k;

  // the drag offset springs back so the scroll always stays authoritative
  if (!state.dragging && Math.abs(state.scrub) > 0.001) {
    state.scrub *= Math.pow(0.12, dt);
  }

  const eng = window.__atelier;
  if (eng?.manifest) {
    const n = eng.manifest.count;
    const cycle = n - 1;

    /* The sweep runs 0 -> 44 through the pinned section. Past that the
       scroll keeps feeding frames in, and the total is folded into a
       triangle wave so the garment runs on to the end of the sequence,
       eases back through it, and loops with no seam and no jump. */
    const period = cycle * 2;
    let x = (state.eased * cycle + state.extraFrames) % period;
    if (x < 0) x += period;
    const folded = x <= cycle ? x : period - x;

    const turn = clamp(folded + state.scrub, 0, n - 1.001);
    eng.progress = state.eased;
    eng.setTurn(turn);

    // report the frame actually on screen, not the target it is easing to
    const shown = clamp(typeof eng.turn === "number" ? eng.turn : turn, 0, n - 1);
    const fi = Math.round(shown);
    const rec = eng.manifest.frames[fi];
    if (hudAngle) hudAngle.textContent = `${String(fi + 1).padStart(2, "0")}/${n}`;
    if (hudView && rec) hudView.textContent = rec.view || "";
  }

  paintBeats(state.eased);
  paintSide(eng?.shot?.side || "left");
}

function start() {
  readScroll();
  document.body.classList.add("in-studio");
  const loop = (now) => {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
  };
  requestAnimationFrame(loop);
}

// exposed for the console and the verification harness
window.__atelierStep = step;

boot();
