/* ==========================================================================
   TURN TABLE — the 3D engine
   --------------------------------------------------------------------------
   The sherwani is a photographic 360: 44 frames rendered from the source
   turntable video, keyed to a transparent alpha and uploaded as a WebGL2
   texture array. The shader picks the frame from a fractional index, so the
   rotation is continuous instead of stepping, and it re-lights the garment
   in real time from a normal derived from the frame's own luminance — the
   gold embroidery and the folds of the cloth catch the key light.

   Everything else in the scene is genuine 3D: a floor with a contact
   shadow, drifting gold dust, two orbit rings, exponential fog and a camera
   that dollies through the scroll.
   ========================================================================== */

import * as THREE from "./three.module.js";

/* ---------- studio moods -------------------------------------------------
   These change the LIGHTING and the room, never the garment's colour. The
   fabric in the frames is untouched.                                             */
export const MOODS = {
  ember: {
    name: "Ember",
    key: 0xffd9a8, keyDir: [0.62, 0.72, 0.5], keyPower: 1.28,
    rim: 0xffb26b, rimPower: 0.9,
    ambient: 0.42, bg: 0x17100b, fog: 0x120c08,
    dust: 0xffcf9a, ring: 0xe8b06a,
  },
  ivory: {
    name: "Ivory",
    key: 0xfff6ea, keyDir: [0.18, 0.92, 0.55], keyPower: 1.18,
    rim: 0xffffff, rimPower: 0.8,
    ambient: 0.55, bg: 0x12100e, fog: 0x0e0c0a,
    dust: 0xf4e6cf, ring: 0xd9c7a8,
  },
  midnight: {
    name: "Midnight",
    key: 0xa9c0ff, keyDir: [-0.72, 0.5, 0.42], keyPower: 1.34,
    rim: 0x6f8dff, rimPower: 1.05,
    ambient: 0.34, bg: 0x070a14, fog: 0x05070e,
    dust: 0x9fb8ff, ring: 0x6f86c9,
  },
  ruby: {
    name: "Ruby",
    key: 0xffb3c0, keyDir: [0.3, 0.62, 0.62], keyPower: 1.24,
    rim: 0xff5f7a, rimPower: 0.95,
    ambient: 0.38, bg: 0x170a0e, fog: 0x100609,
    dust: 0xff8fa3, ring: 0xd1607a,
  },
  emerald: {
    name: "Emerald",
    key: 0xb9f0d6, keyDir: [-0.32, 0.82, 0.48], keyPower: 1.22,
    rim: 0x35c48c, rimPower: 0.88,
    ambient: 0.36, bg: 0x07110d, fog: 0x050c09,
    dust: 0x7fe3b8, ring: 0x4fbf95,
  },
};

/* ---------- shader ------------------------------------------------------- */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler2DArray;

/* three.js does not declare an output for GLSL3 materials, so we declare our
   own and do the tone map and the sRGB encode here rather than relying on the
   engine's chunks. */
layout(location = 0) out highp vec4 fragColor;

uniform sampler2DArray uFrames;
uniform float uFrameCount;
uniform float uFrameF;
uniform vec3  uKeyDir;     // view space
uniform vec3  uKeyColor;
uniform vec3  uRimColor;
uniform float uKeyPower;
uniform float uRimPower;
uniform float uAmbient;
uniform float uBump;
uniform float uSpec;
uniform float uOpacity;
uniform float uExposure;

varying vec2 vUv;

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 linearToSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 acesFilm(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  float f    = clamp(uFrameF, 0.0, uFrameCount - 1.0);
  float f0   = floor(f);
  float f1   = min(f0 + 1.0, uFrameCount - 1.0);
  float t    = smoothstep(0.0, 1.0, f - f0);

  vec4 c0 = texture(uFrames, vec3(vUv, f0));
  vec4 c1 = texture(uFrames, vec3(vUv, f1));
  vec4 c   = mix(c0, c1, t);

  if (c.a < 0.012) discard;

  vec3 base = srgbToLinear(c.rgb);

  /* ---- pseudo normal straight from the frame's own shading -------------
     The garment is a flat cutout, but the cloth inside it is not: the
     embroidery is brighter than the weave and the folds are darker. Taking
     the screen-space gradient of that luminance gives a believable surface
     for the key light to travel across.                                          */
  float h  = luma(base);
  float hx = dFdx(h);
  float hy = dFdy(h);
  vec2 grad = clamp(vec2(hx, hy) * uBump, vec2(-0.85), vec2(0.85));
  vec3 n = normalize(vec3(grad, 1.0));

  /* ---- lighting -------------------------------------------------------- */
  vec3 keyDir = normalize(uKeyDir);
  float key = max(dot(n, keyDir), 0.0);
  float fill = max(dot(n, vec3(-keyDir.x, 0.25, 0.7)), 0.0);
  vec3 view = vec3(0.0, 0.0, 1.0);
  float rim = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 2.2);

  vec3 lit = base * (uAmbient + key * uKeyColor * uKeyPower + fill * 0.14);
  lit += rim * uRimColor * uRimPower * 0.20;

  /* ---- a restrained specular for the gold thread ------------------------ */
  vec3 hvec = normalize(keyDir + view);
  float spec = pow(max(dot(n, hvec), 0.0), 46.0);
  lit += spec * uKeyColor * uSpec;

  vec3 outColor = linearToSrgb(acesFilm(lit * uExposure));
  fragColor = vec4(outColor, c.a * uOpacity);
}
`;

/* ---------- helpers ------------------------------------------------------ */
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const lerp = (a, b, t) => a + (b - a) * t;

function radialShadowTexture(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, "rgba(0,0,0,0.85)");
  g.addColorStop(0.42, "rgba(0,0,0,0.42)");
  g.addColorStop(0.75, "rgba(0,0,0,0.10)");
  g.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function dustTexture(size = 64) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.35, "rgba(255,255,255,0.32)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* The brand mark, drawn into the scene as a plane the garment can pass in
   front of. This is the sign-off moment: the sherwani comes forward and the
   house name sits behind it. */
function wordmarkTexture() {
  const W = 2048;
  const H = 560;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const serif = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
  ctx.fillStyle = "#e7d9c4";
  ctx.font = `500 190px ${serif}`;
  // manual letter spacing so the wordmark reads wide and quiet
  const word = "SOHRAAZ";
  const gap = 34;
  const widths = [...word].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (word.length - 1);
  let x = W / 2 - total / 2;
  [...word].forEach((ch, i) => {
    ctx.fillText(ch, x + widths[i] / 2, H / 2 - 40);
    x += widths[i] + gap;
  });

  ctx.strokeStyle = "rgba(199,170,139,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 250, H / 2 + 96);
  ctx.lineTo(W / 2 + 250, H / 2 + 96);
  ctx.stroke();

  ctx.fillStyle = "rgba(199,170,139,0.72)";
  ctx.font = `400 34px ${serif}`;
  ctx.fillText("THE ART OF MODERN INDIAN ELEGANCE", W / 2, H / 2 + 150);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ---------- the shot list ------------------------------------------------
   A scroll-driven page is a film. These are the shots, and the scroll
   progress picks between them: where the garment stands, how large it is,
   how far the camera is in, and which side the copy sits on.

     x        -0.45 .. +0.45 of the visible width, the garment's stage mark
     scale    - how big the garment reads
     dolly    - camera distance multiplier
     side     - which half of the screen the copy occupies
     logo     - opacity of the brand mark behind the garment
   ---------------------------------------------------------------------- */
export const SHOTS = [
  { at: 0.00, x: 1.00, scale: 1.00, dolly: 1.00, side: "left",  logo: 0.18 },
  { at: 0.13, x: 1.08, scale: 1.14, dolly: 0.93, side: "left",  logo: 0.10 },
  { at: 0.28, x: -0.96, scale: 1.04, dolly: 1.01, side: "right", logo: 0.24 },
  { at: 0.44, x: -1.04, scale: 1.16, dolly: 0.91, side: "right", logo: 0.18 },
  { at: 0.60, x: 0.24, scale: 1.15, dolly: 0.90, side: "left",  logo: 0.50 },
  { at: 0.76, x: 1.06, scale: 1.10, dolly: 0.96, side: "left",  logo: 0.12 },
  { at: 0.90, x: 0.94, scale: 0.94, dolly: 1.06, side: "left",  logo: 0.28 },
  { at: 1.00, x: 0.00, scale: 0.86, dolly: 1.14, side: "left",  logo: 0.36 },
];

function shotAt(q) {
  const t = clamp(q, 0, 1);
  let a = SHOTS[0];
  let b = SHOTS[SHOTS.length - 1];
  for (let i = 0; i < SHOTS.length - 1; i++) {
    if (t >= SHOTS[i].at && t <= SHOTS[i + 1].at) {
      a = SHOTS[i];
      b = SHOTS[i + 1];
      break;
    }
  }
  const span = b.at - a.at || 1;
  let k = clamp((t - a.at) / span, 0, 1);
  k = k * k * (3 - 2 * k); // smoothstep, so the moves settle rather than snap
  return {
    x: lerp(a.x, b.x, k),
    scale: lerp(a.scale, b.scale, k),
    dolly: lerp(a.dolly, b.dolly, k),
    logo: lerp(a.logo, b.logo, k),
    side: k < 0.5 ? a.side : b.side,
  };
}

/* ---------- the engine --------------------------------------------------- */
export class Turntable {
  constructor(canvas) {
    this.canvas = canvas;
    this.manifest = null;
    this.tex = null;
    this.ready = false;
    this.frames = [];           // ImageBitmaps, kept for the 2D fallback
    this.mood = "ember";
    this.detail = false;
    this.turn = 0;              // fractional frame index
    this.targetTurn = 0;
    this.progress = 0;          // 0..1 scroll progress
    this.contentPhase = 0;      // 0..1, how far into the content sections
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.mobile = window.matchMedia("(max-width: 860px)").matches;
    this._clock = new THREE.Clock();
    this._raf = null;
    this._visible = true;
  }

  /* ---------------- loading ---------------- */
  async load(manifest, base, onProgress) {
    this.manifest = manifest;
    const n = manifest.count;
    const w = manifest.width;
    const h = manifest.height;

    // decode every frame into one contiguous RGBA buffer
    const buffer = new Uint8Array(n * w * h * 4);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    let cursor = 0;
    let done = 0;
    const CONCURRENCY = 8;

    const worker = async () => {
      while (cursor < n) {
        const i = cursor++;
        const res = await fetch(`${base}/${manifest.frames[i].file}`);
        if (!res.ok) throw new Error(`frame ${i} failed: ${res.status}`);
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        /* WebGL uploads an ArrayBufferView straight into the texture, row 0
           first, and it does NOT honour UNPACK_FLIP_Y_WEBGL for 3D textures.
           Canvas pixel data is also row 0 = top. The two together leave the
           garment upside down, so the frame is drawn flipped on its way in. */
        ctx.save();
        ctx.clearRect(0, 0, w, h);
        ctx.translate(0, h);
        ctx.scale(1, -1);
        ctx.drawImage(bmp, 0, 0, w, h);
        ctx.restore();
        bmp.close?.();
        const px = ctx.getImageData(0, 0, w, h).data;
        buffer.set(px, i * w * h * 4);
        done++;
        onProgress?.(done / n);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, n) }, () => worker())
    );

    this.buffer = buffer;
    this.bitmapFrames = this.frames;
    return { buffer, w, h, n };
  }

  /* ---------------- scene ---------------- */
  init(payload) {
    const { buffer, w, h, n } = payload;
    this.manifest.count = n;
    this.manifest.width = w;
    this.manifest.height = h;

    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping; // the shader tone maps itself
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(MOODS.ember.bg);
    scene.fog = new THREE.FogExp2(MOODS.ember.fog, 0.055);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(0, 0, 6);
    this.camera = camera;

    /* ---- the garment ---- */
    const tex = new THREE.DataArrayTexture(buffer, w, h, n);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.UnsignedByteType;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.tex = tex;

    const aspect = w / h;
    const GARMENT_H = 2.9;
    const GARMENT_W = GARMENT_H * aspect;
    this.garmentH = GARMENT_H;
    this.garmentW = GARMENT_W;

    this.uniforms = {
      uFrames: { value: tex },
      uFrameCount: { value: n },
      uFrameF: { value: 0 },
      uKeyDir: { value: new THREE.Vector3(0.62, 0.72, 0.5).normalize() },
      uKeyColor: { value: new THREE.Color(MOODS.ember.key) },
      uRimColor: { value: new THREE.Color(MOODS.ember.rim) },
      uKeyPower: { value: MOODS.ember.keyPower },
      uRimPower: { value: MOODS.ember.rimPower },
      uAmbient: { value: MOODS.ember.ambient },
      uBump: { value: 26 },
      uSpec: { value: 0.5 },
      uOpacity: { value: 1 },
      uExposure: { value: 1.15 },
    };

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.garment = new THREE.Mesh(new THREE.PlaneGeometry(GARMENT_W, GARMENT_H), material);
    this.garment.renderOrder = 3;
    scene.add(this.garment);

    /* ---- contact shadow ----
       A flat plane under the garment. It must never occlude the garment
       itself, so depth testing is off and it paints before it.            */
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(GARMENT_W * 1.8, GARMENT_W * 1.25),
      new THREE.MeshBasicMaterial({
        map: radialShadowTexture(),
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        depthTest: false,
        color: 0x000000,
      })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    scene.add(this.shadow);

    /* ---- the studio halo: a soft pool of light behind the garment ------- */
    this.halo = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 11),
      new THREE.MeshBasicMaterial({
        map: radialShadowTexture(256),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        color: MOODS.ember.ring,
      })
    );
    this.halo.position.z = -2.4;
    this.halo.renderOrder = 1;
    scene.add(this.halo);

    /* ---- the brand mark, behind the garment ---------------------------- */
    this.wordmark = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 8.4 * (560 / 2048)),
      new THREE.MeshBasicMaterial({
        map: wordmarkTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      })
    );
    this.wordmark.position.z = -1.9;
    this.wordmark.renderOrder = 2;
    scene.add(this.wordmark);

    /* ---- gold dust ---- */
    const count = this.mobile ? 150 : 400;
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 11;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 7;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
      sizes[i] = Math.random() * 2 + 0.5;
    }
    const dgeo = new THREE.BufferGeometry();
    dgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dgeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    this.dust = new THREE.Points(
      dgeo,
      new THREE.PointsMaterial({
        map: dustTexture(),
        size: 0.055,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        color: MOODS.ember.dust,
      })
    );
    this.dust.renderOrder = 2;
    scene.add(this.dust);

    /* ---- orbit rings ---- */
    const ringMat = (opacity) =>
      new THREE.MeshBasicMaterial({
        color: MOODS.ember.ring,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: false,
      });
    this.ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.006, 8, 160), ringMat(0.22));
    this.ring1.rotation.set(Math.PI * 0.46, 0, 0);
    this.ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.004, 8, 160), ringMat(0.1));
    this.ring2.rotation.set(Math.PI * 0.28, Math.PI * 0.2, 0);
    this.ring1.renderOrder = 2;
    this.ring2.renderOrder = 2;
    scene.add(this.ring1, this.ring2);

    this.ready = true;
    this.resize();
    this.setMood(this.mood);
    this.start();
  }

  /* ---------------- layout ---------------- */
  resize() {
    if (!this.ready) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this.mobile = w <= 860;
    const wide = w / h > 1.12;

    // base distance so the garment always fits with a margin
    const dist = 6.0;
    this.baseDist = dist;
    const vFov = (this.camera.fov * Math.PI) / 180;
    const visH = 2 * dist * Math.tan(vFov / 2);
    const visW = visH * this.camera.aspect;

    const availW = wide ? visW * 0.36 : visW * 0.92;
    const availH = wide ? visH * 0.70 : visH * 0.41;
    const scale = Math.min(availW / this.garmentW, availH / this.garmentH);

    this.layout = {
      wide,
      scale,
      x: wide ? visW * 0.30 : 0,
      // narrow screens frame the garment high, clear of the words below
      y: wide ? 0.02 : visH * 0.22,
      visW,
      visH,
    };
  }

  /* ---------------- controls ---------------- */
  setTurn(frac) {
    this.targetTurn = frac;
  }

  setMood(name) {
    const m = MOODS[name];
    if (!m) return;
    this.mood = name;
    this.scene.background.setHex(m.bg);
    this.scene.fog.color.setHex(m.fog);
    this.uniforms.uKeyColor.value.setHex(m.key);
    this.uniforms.uRimColor.value.setHex(m.rim);
    this.uniforms.uKeyPower.value = m.keyPower;
    this.uniforms.uRimPower.value = m.rimPower;
    this.uniforms.uAmbient.value = m.ambient;
    this.dust.material.color.setHex(m.dust);
    this.ring1.material.color.setHex(m.ring);
    this.ring2.material.color.setHex(m.ring);
    this.halo.material.color.setHex(m.ring);
    this.moodData = m;
  }

  setDetail(on) {
    this.detail = on;
    this.uniforms.uBump.value = on ? 44 : 26;
    this.uniforms.uSpec.value = on ? 1.25 : 0.5;
  }

  /* ---------------- loop ---------------- */
  start() {
    if (this._raf) return;
    this._clock.getDelta();
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      if (!this._visible || document.hidden) return;
      this.tick();
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  tick() {
    const dt = Math.min(this._clock.getDelta(), 0.05);
    const time = this._clock.getElapsedTime();

    // ease the frame index toward the scroll target
    const k = 1 - Math.pow(0.0015, dt);
    this.turn += (this.targetTurn - this.turn) * k;
    /* Once the sweep is over the scroll itself keeps the sequence going,
    so the idle drift is only a gentle breath on top of it. */
    const drift = this.progress >= 0.999 ? Math.sin(time * 0.32) * 2.5 : 0;
    this.uniforms.uFrameF.value = this.turn + drift;

    const q = this.progress;
    const shot = shotAt(q);
    const cp = this.contentPhase || 0;

    // camera choreography — the shot list drives the dolly, a slow arc and
    // a gentle rise, so the camera reads as a crane rather than a tripod
    const arc = Math.sin(q * Math.PI);
    const cam = this.camera;
    const wide = this.layout?.wide !== false;
    // a narrow screen has less room, so the big beats are damped
    const shotDolly = wide ? shot.dolly : 1 + (shot.dolly - 1) * 0.4;
    const dist = this.baseDist * shotDolly * (1 + cp * 0.05) * (wide ? 1 : 1.04);
    cam.position.x = Math.sin(q * Math.PI * 1.15) * 0.42;
    cam.position.y = 0.44 - 0.34 * arc + Math.sin(time * 0.22) * 0.025;
    cam.position.z = dist;
    cam.lookAt(0, 0.0, 0);

    // the garment takes its stage mark from the shot list
    if (this.layout) {
      /* Once the content sections take over, the product steps aside and
         stays present rather than speck-small. On wide screens it drifts
         right and dims; on narrow screens it rises toward the top of the
         frame and shrinks to a presence, since there is no side to step to. */
      const cp = this.contentPhase || 0;
      const stageX = wide ? shot.x + cp * 0.85 : shot.x * (1 - cp * 0.45);
      const stageY = wide ? this.layout.y : this.layout.y + cp * this.layout.visH * 0.14;
      const shotScale = wide ? shot.scale : 1 + (shot.scale - 1) * 0.45;
      const s = this.layout.scale * shotScale * (1 - cp * (wide ? 0.12 : 0.24));
      this.garment.scale.setScalar(s);
      this.garment.position.x = this.layout.x * stageX;
      this.garment.position.y = stageY;
      this.uniforms.uOpacity.value = 1 - cp * (wide ? 0.36 : 0.42);

      // the billboard always faces the camera
      this.garment.quaternion.copy(cam.quaternion);

      // the shadow follows the garment and narrows as it turns side-on
      const turn = this.turn / Math.max(1, this.manifest.count - 1);
      const widthRatio = this._widthAt(turn);
      this.shadow.position.set(this.layout.x * stageX, stageY - this.garmentH * s * 0.5 - 0.02, 0);
      this.shadow.scale.set(widthRatio, 1, 1);
      this.shadow.material.opacity = (0.5 + 0.26 * widthRatio) * (1 - cp * 0.6);

      // the halo sits behind the garment and always faces the camera
      this.halo.position.set(this.layout.x * stageX, stageY, -2.4);
      this.halo.quaternion.copy(cam.quaternion);
      this.halo.scale.setScalar((0.85 + 0.12 * arc) * (1 - cp * 0.3));

      // the brand mark trails the garment with parallax, so the garment
      // reads as being in front of it
      this.wordmark.position.set(this.layout.x * stageX * 0.42, stageY - 0.05, -1.9);
      this.wordmark.quaternion.copy(cam.quaternion);
      this.wordmark.material.opacity = shot.logo * (1 - cp * 0.7);
      this.wordmark.scale.setScalar(0.92 + 0.16 * arc);
    }

    this.shot = shot;

    /* The key light travels around the garment as the scroll advances, but
       it is never allowed to swing behind it: a garment lit only from the
       back reads as a black hole, not as cloth. It also keeps a minimum
       forward component so the front of the sherwani is always readable. */
    const m = this.moodData || MOODS.ember;
    const az = clamp((q - 0.1) * 1.6, -0.7, 0.7);
    const base = new THREE.Vector3(m.keyDir[0], m.keyDir[1], m.keyDir[2]);
    const dir = new THREE.Vector3(
      base.x * Math.cos(az) - base.z * Math.sin(az),
      base.y,
      base.x * Math.sin(az) + base.z * Math.cos(az)
    );
    if (dir.z < 0.34) dir.z = 0.34;
    dir.normalize();
    this.uniforms.uKeyDir.value.copy(dir.transformDirection(cam.matrixWorldInverse));

    // rings and dust keep the room alive
    this.ring1.rotation.z = time * 0.09;
    this.ring2.rotation.z = -time * 0.065;
    this.ring1.rotation.y = Math.sin(time * 0.12) * 0.2;
    this.dust.rotation.y = time * 0.018;

    const p = this.dust.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.array[i * 3 + 1] += Math.sin(time * 0.3 + i * 0.11) * 0.0009;
      p.array[i * 3] += Math.cos(time * 0.2 + i * 0.05) * 0.0004;
    }
    p.needsUpdate = true;

    this.renderer.render(this.scene, cam);
  }

  /* relative silhouette width of a frame, used to narrow the contact shadow */
  _widthAt(turn) {
    const f = this.manifest.frames;
    if (!f || !f.length) return 1;
    const idx = Math.round(turn * (f.length - 1));
    const rec = f[idx];
    if (rec && typeof rec.w === "number") return rec.w;
    return 1;
  }
}

/* ---------- 2D fallback (no WebGL2) --------------------------------------- */
export class Turntable2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.bitmaps = [];
    this.turn = 0;
    this.targetTurn = 0;
    this.progress = 0;
    this.ready = false;
    this.mobile = window.matchMedia("(max-width: 860px)").matches;
  }

  async load(manifest, base, onProgress) {
    this.manifest = manifest;
    const n = manifest.count;
    let done = 0;
    const CONCURRENCY = 8;
    let cursor = 0;
    const worker = async () => {
      while (cursor < n) {
        const i = cursor++;
        const res = await fetch(`${base}/${manifest.frames[i].file}`);
        const blob = await res.blob();
        this.bitmaps[i] = await createImageBitmap(blob);
        done++;
        onProgress?.(done / n);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, n) }, () => worker())
    );
    this.ready = true;
    this.resize();
    this.loop();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.dpr = dpr;
  }

  setTurn(f) {
    this.targetTurn = f;
  }
  setMood() {}
  setDetail() {}

  loop = () => {
    requestAnimationFrame(this.loop);
    if (!this.ready || document.hidden) return;
    const k = 0.18;
    this.turn += (this.targetTurn - this.turn) * k;
    const n = this.bitmaps.length;
    if (!n) return;
    const f = clamp(this.turn, 0, n - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(i0 + 1, n - 1);
    const t = f - i0;
    const a = this.bitmaps[i0];
    const b = this.bitmaps[i1];
    if (!a) return;
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    const scale = Math.min((cw * 0.86) / a.width, (ch * 0.82) / a.height);
    const dw = a.width * scale;
    const dh = a.height * scale;
    const dx = cw * 0.5 + (cw > ch ? cw * 0.11 : 0) - dw / 2;
    const dy = ch * 0.5 - (cw <= ch ? ch * 0.14 : 0) - dh / 2;
    ctx.globalAlpha = 1 - t;
    ctx.drawImage(a, dx, dy, dw, dh);
    if (b && t > 0) {
      ctx.globalAlpha = t;
      ctx.drawImage(b, dx, dy, dw, dh);
    }
    ctx.globalAlpha = 1;
  };
}

export { clamp, lerp };
