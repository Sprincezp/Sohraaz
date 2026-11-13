# SOHRAAZ — 5-theme system

One floating **◐ Themes** button switches colours **and** fonts across the whole
site. The choice is stored in `localStorage["sz-theme"]` and applied before first
paint on every page and store route.

| key | name | ground | display font | body font |
|---|---|---|---|---|
| `royal` (default) | Royal Gold | `#080604` | Cormorant Garamond | Jost |
| `rose` | Rose Gold | `#120a0d` | Playfair Display | DM Sans |
| `emerald` | Emerald Royale | `#04100b` | Cinzel | Raleway |
| `ivory` | Ivory Heritage (light) | `#faf4e6` | DM Serif Display | Karla |
| `maroon` | Maroon Maharaja | `#140507` | Bodoni Moda | Montserrat |

## Files changed

| file | change |
|---|---|
| `assets/theme.css` | **new** — the five token sets, the legacy-variable alias layer, component refinements, switcher UI, 200 ms colour fade |
| `assets/theme.js` | **new** — builds the switcher, applies/persists the theme, cross-tab sync, Escape/outside-click, tucks itself away behind full-screen surfaces |
| `index.html` | anti-flash line, shared font request, `theme.css` + `theme.js`, old palette blocks removed, every hex/rgba colour → token |
| `sohraaz-full-store-template.html` | same, across all hash routes |
| `sohraaz-story.html` | same |
| `SOHRAAZ — The Art of Modern Indian Elegance.html` | its private copy of the theme code removed; now uses the shared files |
| `mobile-preview.html` | same shared files, frame chrome tokenised |

No theme logic exists anywhere else: the pages only set `data-theme` in one
inline line and load the two shared assets.

## Screenshots

`assets/screenshots/before/` — the site before the switch (one look, 3 pages)
`assets/screenshots/after/` — every page × theme at 1280px, plus 360/768px passes

## Verification run

- **Contrast**: automated pass over every visible text node on 9 routes × 5 themes
  (20 page/theme combinations). All body copy ≥ 4.5:1 and all large text ≥ 3:1,
  except the primary-button gradient (see judgment calls).
- **Behaviour**: 20 assertions × 3 viewports (360 / 768 / 1280) — persistence
  across reload, all hash routes and page-to-page navigation; `aria-expanded`,
  `aria-pressed`, Escape closes and returns focus; panel stays open on pick;
  no horizontal scroll; switcher never overlaps the assistant, the reel viewer
  or the mobile bottom bar; zero console errors.

## Judgment calls

1. **Photo scrims stay dark in every theme.** The hero panel, story banner, Watch
   & Buy viewer and lookbook captions keep a dark scrim with light type, because
   they sit on photography and the spec allows dim overlays to stay black. A
   media-free hero (the standalone demo page) still follows the theme.
2. **Primary button gradient.** `--btn` is used exactly as specified, which puts
   the darkest stop (`--gold3`) at the left edge. The button face is rendered at
   `background-size:165%` centred, so the glyphs never sit on that stop: the
   visible face measures 4.9:1 (Ivory) to 12.9:1 (Royal). If you want the raw
   gradient edge to pass AA as well, change `--btn` to a solid `var(--gold)`.
3. **Ivory gold chips.** On the one light ground, chips that carry `--on` text on
   `--gold` (Black-Friday tag, skip link, copy/refer buttons) use `--gold2` as
   their ground so the label keeps ~7:1.
4. **Semantic and brand colours kept**: sale red, success green, wishlist heart
   `#FF4D6B`, WhatsApp `#25D366 / #128C4B`. Their per-theme counterparts are
   provided as `--ok / --err` for anything that must adapt.
5. **Ivory keeps its own `color-scheme:light`** so native form controls follow.
6. **Product swatch colours in the store's JS data are untouched** — they are the
   real garment colours, not theme values.
