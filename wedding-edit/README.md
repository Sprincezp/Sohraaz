# The Atelier — a scroll-driven 3D turntable for the Sohraaz sherwani

A standalone page. **Nothing in this folder is imported into, or shared with,
the Flask app in `SOHRAAZ COLLECTION/`** — no template, no asset, no route.
It is a separate folder with its own `index.html`, its own CSS, its own JS and
its own images, and it can be deleted without touching anything else.

```
kurtaroyal-3d/
├── index.html                    the page
├── assets/
│   ├── css/app.css               design system + layout
│   ├── js/turntable.js           the 3D engine (Three.js, WebGL2)
│   ├── js/main.js                scroll, beats, HUD, controls
│   ├── js/three.module.js        Three.js r160, vendored (works offline)
│   ├── frames-desktop/           44 WebP frames, 400x808  (1.72 MB)
│   ├── frames-mobile/            44 WebP frames, 280x566  (0.96 MB)
│   ├── frames-desktop.json       manifest (frame list, widths, view labels)
│   ├── frames-mobile.json
│   └── img/sherwani-1..4.jpg     the four real product photographs
└── tools/                        the pipeline that produced the frames
```

## Running it

It needs to be served over HTTP — ES modules and `fetch` do not work from
`file://`.

```bash
cd kurtaroyal-3d
python -m http.server 8099
# then open http://127.0.0.1:8099/index.html
```

`tools/capture_server.py 8098` does the same plus a `POST /_shot/<name>.png`
sink that the page can push canvas captures into.

## Deploying as a static page

The page is fully self-contained: no build step, no dependencies, no server.
Upload the whole folder (minus `tools/` if you prefer to keep dev tooling out)
to any static host and open it. On GitHub Pages it is served as-is, because
every internal reference is relative. The 3D engine, Three.js (vendored r160),
the frame sequences and the manifests all travel inside `assets/`.

## How the turn works

The garment is a photographic 360. The source clip
(`shotcut-20261115-154250.mp4`) is a rendered turntable, and `tools/build_frames.py`
turns it into a frame sequence:

1. **ffmpeg** decodes the 2160x3840 source once, crops it to the garment's
   union bounding box and rescales it to the delivery height.
2. **Alpha** is derived from the max channel. The background is pure black
   (63.4% of pixels have a max channel <= 8) and the darkest garment pixel in
   the whole clip sits at 48, so a soft ramp from 7 to 26 keys the background
   out cleanly without eating the maroon stole. The colour is then **un-matted**
   (divided by alpha) to kill the dark anti-aliasing fringe.
3. **Held frames are dropped.** The render behind the clip runs at 6 fps inside
   a 30 fps container — every fifth frame is a byte-identical repeat (verified
   at full resolution: max pixel delta 8, zero pixels over 12). Only the 44
   genuinely unique angles are kept.
4. The survivors are **re-sampled at equal arc length** measured on the
   silhouette, because the source render is not a constant-speed turntable — a
   naive every-Nth-frame sample makes the rotation visibly speed up and slow
   down while you scroll.
5. Each frame is written as a lossy WebP with an opaque alpha channel.

The client fetches all 44 frames in parallel behind the loading screen, packs
them into a WebGL2 **texture array**, and the shader picks the frame from a
fractional index — so the rotation is continuous instead of stepping, and the
garment is re-lit in real time from a normal derived from the frame's own
luminance. The gold work and the folds of the cloth catch the key light as it
travels around.

**Scroll is the primary control.** A 560vh section is pinned, and the scroll
progress through it maps straight onto the frame index. Dragging the canvas
scrubs the same axis; the keyboard arrows step it. Scrolling back up turns the
garment back the way it came — the sequence never gets stuck.

### The shot list

A scroll-driven page is a film, so the scroll picks between shots rather than
dragging one object around. `SHOTS` in `assets/js/turntable.js` holds the
shots; the scroll progress is eased between them.

| progress | shot | the garment | the copy |
|---|---|---|---|
| 0.00 | the front | right of centre | left |
| 0.13 | the drape | pushes in, right | left |
| 0.28 | three-quarter | **crosses to the left** | **crosses to the right** |
| 0.44 | in profile | left, closer | right |
| 0.60 | the back | centre, largest, in front of the wordmark | left |
| 0.76 | the stole | back to the right | left |
| 0.90 | the churidar | right, smaller | left |
| 1.00 | settle | centre, small | left |

When the garment crosses the stage the copy crosses with it, behind a short
fade so the jump is never seen. The scrim that guarantees the words stay
readable mirrors too.

### The brand mark

`SOHRAAZ` is drawn into the scene as a plane behind the garment, so the
sherwani passes **in front of** the house name — it is the sign-off moment.
It swells to its strongest at the back view and trails the garment with
parallax so the depth reads.

### One studio, no cards

There are no filled panels and no cards anywhere. The page is one continuous
studio: the product keeps playing behind, and the words float over it. When
the content sections take over, the product steps aside — it slides to the
right, shrinks and dims — but it never stops moving, and it drifts gently on
its own so it never freezes into a still image.


## Things worth knowing before you publish it

- **The turn is 288 degrees, not 360.** The source clip stops at roughly
  288 deg — it goes front, round the side, to the back and back out to a
  three-quarter view, and it never completes the circle. The page is designed
  around that sweep rather than pretending otherwise. The HUD tells you which
  view you are looking at (Front / Three-quarter / Profile / Back).
- **The product is real.** "Ethnic Wear Men Sherwani in Golden Colour with
  Maroon Touch and Churidar Pajama", Rs 6,999, from sohraaz.com. The four
  photographs are that product's own photographs, pulled from the live store.
- **The struck-through MRP is deliberately not shown.** sohraaz.com lists
  Rs 17,499 against Rs 6,999 for this piece. That is a 60% claim and it is
  backlog item C4 in the project notes, still open. The page shows the
  selling price only.
- **It is currently out of stock on the live site** (every variant reads
  unavailable), so the call to action is "Enquire on WhatsApp" rather than a
  buy button.
- **The studio mood switcher changes the lighting and the room, never the
  fabric.** Five presets (Ember / Ivory / Midnight / Ruby / Emerald) move the
  key light, the rim, the halo, the dust and the background. The garment's own
  colour in the frames is untouched. "Macro" adds a tighter key and a stronger
  bump so the beadwork reads.
- One offer is shown, not five. The live site currently pushes several at
  once (10% above Rs 1,999, Rs 300 above Rs 2,999, a 20% popup code) which is
  backlog item C3; this page carries only "Flat 10% off above Rs 1,999".

## Rebuilding the frames

```bash
python tools/build_frames.py --preset desktop    # 400x808, 44 frames
python tools/build_frames.py --preset mobile     # 280x566, 44 frames
```

The script needs `ffmpeg` and `ffprobe` on PATH (it was built against ffmpeg
8.1). It writes `assets/frames-<preset>/` and `assets/frames-<preset>.json`,
including each frame's silhouette width (the contact shadow narrows with it)
and its view label (the HUD reads it).

`--dry-run` prints the frame picks and the view labels without writing.

### Other tools

| File | What it is |
|---|---|
| `tools/analyze_frames.py` | background purity, alpha-key thresholds, bbox |
| `tools/find_loop.py` | where the sequence would wrap |
| `tools/loop_curve.py` | rotation speed over time, held-frame detection |
| `tools/verify_angular.py` | fits the angular speed and total coverage |
| `tools/parse_glb.py` | reads the reference site's `tmpkiciehot.glb` |
| `tools/viewport.html` | renders the page in an iframe at a chosen size |
| `tools/capture_server.py` | static server plus a screenshot sink |

## Reference

The brief was the behaviour of <https://sprincezp.github.io/kurtaroyal/> — a
Three.js page with a GLB sherwani, scroll-driven section states, gold dust,
orbit rings, a loading screen and a colour picker. This page keeps that
structure and swaps the model for the real photographs, and it fixes the parts
the reference only claims: the drag actually scrubs, the wheel actually zooms
the light, and the colour picker changes the studio rather than pretending to
re-dye the garment.

## Browser support

WebGL2 with `sampler2DArray` is required for the GPU path. Without it the
page falls back to a 2D canvas that still scrubs the sequence
(`Turntable2D` in `assets/js/turntable.js`). `prefers-reduced-motion` is
honoured: the grain and the ring animations stop, the reveals become
instant, and the frame still tracks the scroll.
