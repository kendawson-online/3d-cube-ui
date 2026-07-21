# 3D Cube UI

**Version 1.0.0**

A 3D cube UI originally inspired by the Cube CV:

https://codepen.io/l-ignatova/pen/qByExmV

You can see an online demo here:

https://cube.kendawson.online/

![Screenshot](assets/img/screenshot.png)

---

## Features

- Rotating three-dimensional cube UI for screen sizes above 750px wide
- Smaller screens use [SwiperJS](https://swiperjs.com/) with a cube effect (swipe left/right to rotate)
- **Full keyboard navigation** — arrow keys rotate the cube; number keys `1`–`6` jump to a face
- **On-screen navigation arrows** (hotspot triangles) around the cube for point-and-click rotation
- **Click-and-drag** to freely rotate the cube in any direction, then snap to the nearest face
- **Mouse-wheel scrolling** works on every face, even when rotated (see [Scrolling](#scrolling))
- Content loaded separately from external data files (`data/faces.json` + per-face HTML)
- Persistence via local storage (remembers your location on reload)
- Deep linking via URL parameters (e.g. `?view=face5`)
- Text on each face automatically counter-rotates to stay upright and readable from any orientation
- Fine-grained CSS adjustment for medium and large screens via media queries
- Error notification alerts
- Supports iframes (with same-origin content)

---

## Face layout

The cube has six faces. Internally they use geometric keys, but everything the
user sees is labeled **Face 1** through **Face 6**:

| Face   | Deep-link (`?view=`) | Number key |
| ------ | -------------------- | ---------- |
| Face 1 | `face1`              | `1`        |
| Face 2 | `face2`              | `2`        |
| Face 3 | `face3`              | `3`        |
| Face 4 | `face4`              | `4`        |
| Face 5 | `face5`              | `5`        |
| Face 6 | `face6`              | `6`        |

---

## Navigation

### Keyboard

| Key            | Action                                                            |
| -------------- | ---------------------------------------------------------------- |
| `←` / `→`      | Rotate around the horizontal ring (Face 1 → 2 → 3 → 4 → 1 …)     |
| `↑` / `↓`      | Rotate across the top/bottom seam (through Face 5 / Face 6)      |
| `1`–`6`        | Jump directly to that face                                        |

Arrow keys rotate the cube **continuously** in the pressed direction (the cube
always takes the shortest path — it never spins the long way around). The last
horizontal direction is remembered, so repeated `←`/`→` keep turning the same
way even after crossing the top or bottom face.

### On-screen arrows

Navigation triangles sit around the cube. Click one to rotate the cube one step
in that direction — the same behavior as the matching arrow key.

### Click-and-drag

Click and drag anywhere on the cube to rotate it freely in any direction. When
you release, the cube snaps to whichever face is closest to facing you. A small
drag that doesn't cross the snap threshold leaves you on the current face.

### Scrolling

Any face whose content is taller than the face will scroll. Because non-front
faces are rotated in 3D space, mouse-wheel events are forwarded to the active
face automatically, so scrolling works on **all six faces** regardless of
orientation. Scrolling stops cleanly at the top and bottom of the content.

### Deep linking

Open a specific face directly with the `view` query parameter:

```
https://your-site/?view=face5
```

The current face is also saved to local storage, so reloading returns you to
where you left off.

---

## Content: `data/faces.json` and the per-face HTML files

All face content is loaded at runtime from the `data/` directory. You never edit
`index.html` to change what a face displays — you edit the data files.

### `data/faces.json`

This file is the manifest that maps each face to its content. It is an array of
six objects:

```json
[
  { "id": "front",  "num": 1, "link": "face1", "title": "Face 1", "type": "html",   "src": "face1.html" },
  { "id": "right",  "num": 2, "link": "face2", "title": "Face 2", "type": "html",   "src": "face2.html" },
  { "id": "back",   "num": 3, "link": "face3", "title": "Face 3", "type": "iframe", "src": "face3.html" },
  { "id": "left",   "num": 4, "link": "face4", "title": "Face 4", "type": "html",   "src": "face4.html" },
  { "id": "top",    "num": 5, "link": "face5", "title": "Face 5", "type": "html",   "src": "face5.html" },
  { "id": "bottom", "num": 6, "link": "face6", "title": "Face 6", "type": "html",   "src": "face6.html" }
]
```

| Field   | Description                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| `id`    | Internal geometry key for the face. **Do not change** — the rotation engine and DOM element IDs depend on it. |
| `num`   | The face number (1–6) shown to the user.                                                                      |
| `link`  | The value used in the `?view=` deep-link URL (e.g. `face2`).                                                  |
| `title` | Human-readable label used for buttons, nav links, and accessibility (aria) labels.                           |
| `type`  | `"html"` to inject the file inline, or `"iframe"` to load it in an `<iframe>` (use for same-origin docs).     |
| `src`   | The HTML file in `data/` that holds this face's content.                                                      |

### Per-face HTML files (`data/face1.html` … `data/face6.html`)

Each face's content lives in its own HTML fragment. For an `html`-type face,
include a heading and your content — it is injected directly into the face:

```html
<h2>Face 1 Heading</h2>
<div class="text-wrap">
  <p>Your content here…</p>
</div>
```

For an `iframe`-type face (like Face 3 in the default data), the file embeds an
iframe pointing at same-origin content:

```html
<h2>Face 3 Heading</h2>
<div class="text-wrap">
  <iframe src="data/sample-text.html" title="Face 3 content" loading="lazy"></iframe>
</div>
```

### Adding or changing content

1. Edit the relevant `data/faceN.html` file (or point `src` at a new file).
2. If you change a face's `title`, `type`, or `src`, update the matching row in
   `data/faces.json`.
3. Bump the cache version so returning visitors pick up the change — increment
   `CURRENT_VERSION` in `assets/js/app.js` (the `faces.json` manifest is cached
   in local storage and only re-fetched when this version string changes).

> **Note on caching:** the local `<script>` tags in `index.html` use a `?v=`
> query string as a cache-buster. Bump it whenever you deploy changed JS so
> browsers fetch the new files instead of a stale cached copy.

---

## Project structure

```
3d-cube-ui/
├── index.html              # App shell + cube markup
├── assets/
│   ├── css/
│   │   ├── cube.css        # Cube geometry, faces, scrollbars
│   │   ├── styles.css      # Layout + responsive media queries
│   │   ├── loader.css      # Loading spinner
│   │   └── mobile-ui.css   # Small-screen Swiper styles
│   ├── js/
│   │   ├── app.js          # Cube rotation, navigation, content loading
│   │   ├── urlManager.js   # Deep-link / browser-history handling
│   │   └── notifications.js# Error notification alerts
│   └── img/                # Backgrounds, icons, avatar, screenshot
└── data/
    ├── faces.json          # Face manifest (see above)
    ├── face1.html … face6.html  # Per-face content
    ├── sample-text.html    # Sample iframe content
    └── placeholder.html    # Placeholder content
```

---

## Browser support

Requires a modern browser with CSS 3D transforms (`transform-style: preserve-3d`
and `perspective`). Tested in current Chromium-based browsers.

---

## Credits

Originally inspired by [Cube CV by l-ignatova](https://codepen.io/l-ignatova/pen/qByExmV).
