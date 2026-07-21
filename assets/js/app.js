// ------------------------------------------------------------------------
// 3D Cube UI
// Version: 1.0.0
// Inspired by: https://codepen.io/l-ignatova/pen/qByExmV
// Created 12/7/25 by <ken@kendawson.com>
// Last updated: 12/20/25
// ------------------------------------------------------------------------

// show extra debugging data
const debugmode = false;

// -----------------------------------------------------------------------
// Face identifiers. These are the stable face STICKERS (face 1 is always
// face 1), NOT a viewpoint. "front" here means the face whose content is the
// Front Face, not "the face currently showing on screen". The currently
// displayed face is tracked separately in `currentFace`.
//   front=1, right=2, back=3, left=4, top=5, bottom=6
// -----------------------------------------------------------------------
const faces = ["front", "right", "back", "left", "top", "bottom"];

// -----------------------------------------------------------------------
// ROTATION MAP (Boris-style rotation graph, adjacency form).
// Every move from every face resolves to exactly ONE destination face. No
// ring arithmetic, no angle math, no viewpoint-dependent "front" word in the
// logic. Faces 1-4 (side) have fixed neighbors. Faces 5/6 (top/bottom) have
// neighbors that depend on which side face you PITCHED FROM, because the top/
// bottom faces connect to all four side faces and the "next" one depends on
// your incoming edge. `lastPitchFrom` (a side face id) resolves that.
//
// Source of truth: Ken's face-numbering sequences (1=front,2=right,3=back,
// 4=left,5=top,6=bottom).
// -----------------------------------------------------------------------
const SIDE_MAP = {
  front:  { up: "top",    down: "bottom", left: "left",  right: "right" },
  right:  { up: "top",    down: "bottom", left: "front", right: "back"  },
  back:   { up: "top",    down: "bottom", left: "right", right: "left"  },
  left:   { up: "top",    down: "bottom", left: "back",  right: "front" },
};

// Top (face 5) and bottom (face 6), keyed by the side face we pitched from.
const TOP_MAP = {
  front:  { up: "back",  down: "front", right: "right", left: "left"  },
  right:  { up: "left",  down: "right", left: "front", right: "back"  },
  back:   { up: "front", down: "back",  left: "right", right: "left"  },
  left:   { up: "right", down: "left",  left: "back",  right: "front" },
};

const BOTTOM_MAP = {
  front:  { up: "front", down: "back",  left: "left",  right: "right" },
  right:  { up: "right", down: "left",  left: "front", right: "back"  },
  back:   { up: "back",  down: "front", left: "right", right: "left"  },
  left:   { up: "left",  down: "right", left: "back",  right: "front" },
};

// The side face we most recently pitched FROM. Used only to resolve the top/
// bottom neighbor maps. Null until the first pitch from a side face.
let lastPitchFrom = null;

// Resolve a move direction to a destination face using the rotation map.
// dir: "up" | "down" | "left" | "right"
const step = (dir) => {
  const here = currentFace;
  let dest = null;

  if (SIDE_MAP[here]) {
    dest = SIDE_MAP[here][dir];
    // A pitch (up/down) from a side face sets the arrival context for top/bottom.
    if (dir === "up" || dir === "down") lastPitchFrom = here;
  } else if (here === "top") {
    dest = (TOP_MAP[lastPitchFrom] || TOP_MAP.front)[dir];
  } else if (here === "bottom") {
    dest = (BOTTOM_MAP[lastPitchFrom] || BOTTOM_MAP.front)[dir];
  }

  if (dest && dest !== here) {
    // Tell goToFace which axis to accumulate along so the cube spins
    // continuously (no snap/twist). Yaw (left/right) = Y axis; pitch
    // (up/down) = X axis. dir: right/up = -1, left/down = +1.
    //
    // EXCEPTION: when the SOURCE is a pole (top/bottom) and the move is a
    // yaw (left/right), yawing spins the cube IN PLACE on the pole — the pole
    // face (x = -90 for top, +90 for bottom) is the front face for ALL values
    // of cy, so accumulating cy never leaves the pole. We must SNAP to the
    // destination side face's canonical orientation ("roll off the pole")
    // instead. Up/down from a pole pitches back onto a side face and is fine
    // to accumulate; side-face moves are fine to accumulate too.
    const fromPole = (here === "top" || here === "bottom");
    const yawFromPole = fromPole && (dir === "left" || dir === "right");
    if (yawFromPole) {
      // Snap: roll the cube off the pole onto the correct side face.
      goToFace(dest, { axis: null, dir: 0 });
    } else {
      const axis = (dir === "left" || dir === "right") ? "y" : "x";
      const dirSign = (dir === "right" || dir === "up") ? -1 : 1;
      goToFace(dest, { axis, dir: dirSign });
    }
  }
};

// Canonical face rotations (Phase 1: cube orientation). These orient the
// whole cube so the destination face is front-and-center. The text-readability
// fix-up (Phase 2) is applied separately to the face content, not here.
const faceRotations = {
  front: { x: 0, y: 0 },
  right: { x: 0, y: -90 },
  back: { x: 0, y: 180 },
  left: { x: 0, y: 90 },
  top: { x: -90, y: 0 },
  bottom: { x: 90, y: 0 },
};

// -----------------------------------------------------------------------
// Phase 2: TEXT READABILITY (proper matrix method).
//
// The cube's full transform on a face's content is:
//   M = rotateX(currentX) · rotateY(currentY) · R_faceBase · rotateZ(textZ)
// where R_faceBase is the face's STATIC transform from cube.css (the ground
// truth — e.g. right = rotateY(90), top = rotateX(90), etc.) and textZ is the
// uprighting counter-rotation we solve for. For the ACTIVE (viewer-facing)
// face, R_faceBase·rotateZ is a rotation that lives in the face plane, so on
// screen it appears as a plain 2D in-plane spin. We choose textZ so the face's
// local +X axis (the text's "right") maps to screen +X; then — because 3D
// rotations never mirror — its +Y follows to screen +Y and the text reads
// upright. That makes textZ = -atan2(v.y, v.x), with
//   v = rotateX(cx) · rotateY(cy) · (R_faceBase · e_x).
//
// Everything is exact (rotation matrices are periodic), so this is correct for
// ANY accumulated (currentX, currentY) — not just canonical poses, and not a
// guessed per-face lookup table.
//
// CSS coordinate convention used throughout: +X right, +Y down, +Z toward the
// viewer. We use the standard rotation matrices in that frame and feed them
// CSS-coordinate vectors, so the result matches exactly what the browser renders.
// -----------------------------------------------------------------------
const norm180 = (d) => { let v = d % 360; if (v > 180) v -= 360; if (v < -180) v += 360; return v; };

// R_faceBase applied to the face's local +X axis, precomputed from cube.css.
//   front  rotateY(0)   ·[1,0,0] = [1, 0, 0]
//   right  rotateY(90)  ·[1,0,0] = [0, 0,-1]
//   back   rotateY(180) ·[1,0,0] = [-1,0, 0]
//   left   rotateY(-90) ·[1,0,0] = [0, 0, 1]
//   top    rotateX(90)  ·[1,0,0] = [1, 0, 0]   (rotateX leaves X fixed)
//   bottom rotateX(-90) ·[1,0,0] = [1, 0, 0]
const FACE_BASE_X = {
  front:  [1, 0, 0],
  right:  [0, 0, -1],
  back:   [-1, 0, 0],
  left:   [0, 0, 1],
  top:    [1, 0, 0],
  bottom: [1, 0, 0],
};

const rotateY = (v, deg) => {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
};
const rotateX = (v, deg) => {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
};

const computeTextZ = (face, cx, cy) => {
  const base = FACE_BASE_X[face];
  if (!base) return 0;
  // Cube transform is `rotateX(cx) rotateY(cy)` -> a point p becomes
  // R_x(cx) · R_y(cy) · p, so we apply rotateY(cy) first, then rotateX(cx).
  // base already includes R_faceBase · e_x.
  let v = rotateY(base, cy);
  v = rotateX(v, cx);
  // On-screen tilt of the text's +X axis; counter-rotate by the negative.
  const theta = Math.atan2(v[1], v[0]) * 180 / Math.PI;
  return norm180(-theta);
};

// Apply the upright counter-rotation to a face's content plane (invisible).
const applyTextRotation = (face) => {
  const el = document.getElementById(`face-${face}-content`);
  if (!el) return;
  el.style.transform = `rotateZ(${computeTextZ(face, currentX, currentY)}deg)`;
};

// Hide the incoming face's text, rotate it upright (invisibly), then fade in
// after the cube finishes rotating. Keeps the user from seeing 2-axis motion.
const fadeInText = (face) => {
  const el = document.getElementById(`face-${face}-content`);
  if (!el) return;
  applyTextRotation(face);
  void el.offsetWidth; // force reflow so rotateZ applies while still hidden
  el.classList.remove("text-fade");
};


const cube = document.getElementById("cube");
const scene = document.getElementById("scene");
const spinner = document.getElementById("spinner-overlay");
const app = document.getElementById("app");
const buttons = Array.from(document.querySelectorAll("[data-face]"));

// Check immediately if user has already seen the loader
const hasSeenLoader = localStorage.getItem('ui-has-loaded');
if (hasSeenLoader) {
  // Hide spinner immediately to prevent flash
  spinner.style.display = 'none';
}

let currentFace = "front";
let currentX = 0;
let currentY = 0;
let initialLoad = true; // suppress focus-on-load so no focus ring appears around the cube

// Store faces data globally
let mobileSwiper = null; // reference to Swiper instance for mobile syncing
let facesData = null;

const setActiveButton = (face) => {
  buttons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.face === face);
  });
};

const setActiveFace = (face) => {
  // Remove face-active class from all faces
  document.querySelectorAll('.face').forEach((faceEl) => {
    faceEl.classList.remove('face-active');
    faceEl.setAttribute('aria-hidden', 'true');
  });

  // Add face-active class to the current face
  const activeFaceEl = document.querySelector(`.face-${face}`);
  if (activeFaceEl) {
    activeFaceEl.classList.add('face-active');
    activeFaceEl.setAttribute('aria-hidden', 'false');
    // Move focus to the active face region for screen-reader users. Skip on the
    // very first load so the browser doesn't draw a focus ring around the cube.
    activeFaceEl.setAttribute('tabindex', '-1');
    if (!initialLoad) {
      activeFaceEl.focus({ preventScroll: true });
    }
  }
  initialLoad = false;
};

const normalize = (a) => {
  let v = a % 360;
  if (v > 180) v -= 360;
  if (v < -180) v += 360;
  return v;
};

// GROUND-TRUTH (cx,cy) -> visible-face table, MEASURED from the REAL browser
// render (getBoundingClientRect area of each .face at every rotateX/rotateY,
// the face with the largest on-screen area is the one actually facing the
// viewer). Encoded literally below — NO formula, NO sign-guessing — because
// CSS 3D-convention signs are easy to get wrong by hand. This is the SINGLE
// SOURCE OF TRUTH for which face is front; deriving currentFace from it
// guarantees the URL/active-face can never desync from what the user sees
// (the old bug: URL said face5 but the cube showed face6). Rebuild via the
// browser probe if cube.css base transforms ever change.
const FRONT_BY_XY = {
  "-360,-360": "front", "-360,-270": "left", "-360,-180": "back", "-360,-90": "right", "-360,0": "front", "-360,90": "left", "-360,180": "back", "-360,270": "right", "-360,360": "front",
  "-270,-360": "bottom", "-270,-270": "bottom", "-270,-180": "bottom", "-270,-90": "bottom", "-270,0": "bottom", "-270,90": "bottom", "-270,180": "bottom", "-270,270": "bottom", "-270,360": "bottom",
  "-180,-360": "back", "-180,-270": "right", "-180,-180": "front", "-180,-90": "left", "-180,0": "back", "-180,90": "right", "-180,180": "front", "-180,270": "left", "-180,360": "back",
  "-90,-360": "top", "-90,-270": "top", "-90,-180": "top", "-90,-90": "top", "-90,0": "top", "-90,90": "top", "-90,180": "top", "-90,270": "top", "-90,360": "top",
  "0,-360": "front", "0,-270": "left", "0,-180": "back", "0,-90": "right", "0,0": "front", "0,90": "left", "0,180": "back", "0,270": "right", "0,360": "front",
  "90,-360": "bottom", "90,-270": "bottom", "90,-180": "bottom", "90,-90": "bottom", "90,0": "bottom", "90,90": "bottom", "90,180": "bottom", "90,270": "bottom", "90,360": "bottom",
  "180,-360": "back", "180,-270": "right", "180,-180": "front", "180,-90": "left", "180,0": "back", "180,90": "right", "180,180": "front", "180,270": "left", "180,360": "back",
  "270,-360": "top", "270,-270": "top", "270,-180": "top", "270,-90": "top", "270,0": "top", "270,90": "top", "270,180": "top", "270,270": "top", "270,360": "top",
  "360,-360": "front", "360,-270": "left", "360,-180": "back", "360,-90": "right", "360,0": "front", "360,90": "left", "360,180": "back", "360,270": "right", "360,360": "front"
};
const geoFront = (cx, cy) => FRONT_BY_XY[`${cx},${cy}`] || "front";

const applyTransform = () => {
  cube.style.transform = `translateZ(calc(var(--cube-size) / -2)) rotateX(${currentX}deg) rotateY(${currentY}deg)`;
};

const goToFace = (targetFace, options = {}) => {
  if (!targetFace || targetFace === currentFace) return;

  const { skipHistory = false, axis = null, dir = 0 } = options;

  // Phase 1: cube orientation.
  // Ring steps (arrow keys / hotspots) pass axis+dir and ACCUMULATE the
  // rotation so the cube spins/rolls continuously with no snap or twist:
  //   - yaw  (left/right): accumulate on Y  -> continuous horizontal spin
  //   - pitch (up/down)  : accumulate on X  -> continuous roll toward/away
  // Non-ring navigations (number keys, URL load, drag-snap) pass axis:null
  // and SNAP to the destination's canonical angle.
  const rot = faceRotations[targetFace];
  if (!rot) return;
  if (axis === "y") {
    // Yaw: accumulate on Y, preserve X (keeps current pitch orientation).
    currentY += dir * 90;
  } else if (axis === "x") {
    // Pitch: accumulate on X, preserve Y (keeps current yaw orientation so a
    // pitch from a non-face-1 side face doesn't twist back to y=0).
    currentX += dir * 90;
  } else {
    // SNAP to the destination's canonical orientation, but choose the angle
    // NEAREST to the current accumulated angle (same face, mod 360) so the
    // cube always rolls the SHORT way — never a 270°/long-way spin. Snapping
    // to the raw canonical value (e.g. y:180 while currentY=-90) forces the
    // long path; +360*round((cur-target)/360) picks the equivalent nearest cur.
    const nearestEquiv = (cur, target) => target + 360 * Math.round((cur - target) / 360);
    currentX = nearestEquiv(currentX, rot.x);
    currentY = nearestEquiv(currentY, rot.y);
  }

  currentFace = geoFront(currentX, currentY); // SINGLE SOURCE OF TRUTH: the face
  // actually showing (derived from geometry), NOT the map's target string.
  // This prevents the state/URL desync (URL said 5, cube showed 6) that
  // occurred when the rotation graph's string lagged the real orientation.
  // Phase 2: orient ONLY the ACTIVE (geometrically-true) face during the
  // transition, and keep it hidden (opacity 0) so the user never sees its text
  // plane rotating into place (no gimbal/dizzy effect). Key off `currentFace`
  // (the geometry-derived truth) NOT `targetFace` (the map's label) — the map
  // label can differ from the real face (e.g. ring step says "top" but the
  // actual orientation is bottom), and keying off the wrong name would hide the
  // wrong face and leave the real one visible + visibly rotating. The other
  // five faces are re-oriented AFTER the cube settles (see below) — at rest
  // they're edge-on or behind the cube, so that rotation is imperceptible.
  const incomingEl = document.getElementById(`face-${currentFace}-content`);
  if (incomingEl) {
    applyTextRotation(currentFace);
    incomingEl.classList.add("text-fade");
  }
  applyTransform();
  setActiveButton(currentFace);
  setActiveFace(currentFace);
  localStorage.setItem("ui-current-face", currentFace);

  // After the cube finishes rotating, fade the ACTIVE face's text in (already
  // upright, no 2-axis motion) AND re-orient the other five faces. Key off
  // `currentFace` (geometry truth), not `targetFace`. They're edge-on/behind
  // at this point, so the rotation is imperceptible — but they'll read upright
  // the moment the user spins to them. All six stay oriented to the perspective.
  const transitionMs = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--transition")) || 0.65) * 1000;
  clearTimeout(goToFace._fadeTimer);
  const settledFace = currentFace;
  goToFace._fadeTimer = setTimeout(() => {
    fadeInText(settledFace);
    faces.forEach((f) => { if (f !== settledFace) applyTextRotation(f); });
  }, transitionMs);

  // Update URL unless this navigation came from history (to avoid duplicate entries)
  if (!skipHistory && window.urlManager) {
    window.urlManager.updateURL(currentFace);
  }
  // If a mobile swiper exists, move it to the correct slide to reflect this navigation
  if (mobileSwiper && Array.isArray(facesData)) {
    const idx = facesData.findIndex(f => f.id === currentFace);
    if (idx >= 0 && typeof mobileSwiper.slideToLoop === 'function') {
      mobileSwiper.slideToLoop(idx, 400, false);
    }
  }
};

const loadData = async () => {
  const CACHE_KEY = 'cube-faces-cache';
  const CACHE_VERSION_KEY = 'cube-faces-cache-version';
  const CURRENT_VERSION = '2.0';

  try {
    // Try to load from cache
    const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    const cachedData = localStorage.getItem(CACHE_KEY);

    if (cachedVersion === CURRENT_VERSION && cachedData) {
      // Use cached data
      facesData = JSON.parse(cachedData);
      if (debugmode) {
        console.log('Using cached faces data');
      }
    } else {
      // Fetch fresh data
      const response = await fetch('data/faces.json');
      facesData = await response.json();

      // Cache the data
      localStorage.setItem(CACHE_KEY, JSON.stringify(facesData));
      localStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION);

      if (debugmode) {
        console.log('Fetched and cached fresh faces data');
      }
    }

    // Initialize URL manager with reference to faces data for link mapping
    if (window.urlManager) {
      window.urlManager.init(facesData);

      // Now that we have faces data, determine initial face from URL or localStorage
      const urlFace = window.urlManager.getURLFace();

      // Priority: URL > default (front)
      // Do not auto-apply a previously stored face when the URL has no `view` param —
      // always default to the front face on first load without a `view`.
      if (urlFace && urlFace !== 'invalid') {
        currentFace = urlFace;
      } else if (urlFace === 'invalid') {
        // Invalid URL - show error and use default
        if (window.notify) {
          window.notify.error('The requested URL does not exist');
        }
        currentFace = "front";
      } else {
        // No URL parameter - default to front
        currentFace = "front";
      }

      // Set rotation for initial face
      currentX = faceRotations[currentFace].x;
      currentY = faceRotations[currentFace].y;

      // Update URL to match current face (use replace to not create history entry)
      window.urlManager.updateURL(currentFace, true);
    }

    const promises = facesData.map(async (face) => {
      const contentResponse = await fetch(`data/${face.src}`);
      const html = await contentResponse.text();
      const contentDiv = document.getElementById(`face-${face.id}-content`);
      contentDiv.innerHTML = html;

      // Add data-type attribute to face-content for CSS styling
      if (face.type === 'iframe') {
        contentDiv.setAttribute('data-type', 'iframe');
      }
    });
    await Promise.all(promises);
    // After faces are populated, initial face will be set below
    // Apply titles/labels to UI controls based on faces data
    const applyFaceTitles = (faces) => {
      if (!faces || !faces.forEach) return;
      faces.forEach((face) => {
        const title = face.title || '';
        // Select every control that references this face via data-face
        document.querySelectorAll(`[data-face="${face.id}"]`).forEach((el) => {
          if (title) {
            el.setAttribute('title', title);
            el.setAttribute('aria-label', title);
          }
          // For visible buttons (floating and sidebar) update/create a .btn-label element
          if (el.matches && el.matches('button.fbtns, button.sb-btns')) {
            const labelEl = el.querySelector('.btn-label');
            if (labelEl) {
              labelEl.textContent = title;
            } else if (title) {
              const span = document.createElement('span');
              span.className = 'btn-label';
              span.textContent = title;
              const hidden = el.querySelector('.visually-hidden');
              if (hidden) el.insertBefore(span, hidden);
              else el.appendChild(span);
            }
            // keep hidden fallback in sync
            const hidden = el.querySelector('.visually-hidden');
            if (hidden) hidden.textContent = title;
          }
        });
      });
    };
    applyFaceTitles(facesData);

    // Populate mobile swiper slides with the same content
    const wrapper = document.getElementById('swiper-wrapper');
    facesData.forEach(face => {
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
      // Add data-type attribute for iframe slides (used for conditional styling)
      if (face.type === 'iframe') {
        slide.setAttribute('data-type', 'iframe');
      }
      slide.innerHTML = document.getElementById(`face-${face.id}-content`).innerHTML;
      wrapper.appendChild(slide);
    });
  } catch (error) {
    console.error('Error loading data:', error);
    if (window.notify) {
      window.notify.error('Unable to load cube content');
    }
  }
};

buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    goToFace(btn.dataset.face);
  });
});

// Navigation hotspots live in a static overlay that is sized to the cube's
// screen footprint. The overlay never rotates or moves between faces, so the
// arrows stay put while the cube spins inside it. It is allowed to overflow the
// scene so the arrows can poke just outside the cube without creating a
// scrollbar. See #2.
let hotspotOverlay = null;
const getHotspotOverlay = () => {
  if (!hotspotOverlay) {
    hotspotOverlay = document.createElement("div");
    hotspotOverlay.className = "cube-overlay";
    hotspotOverlay.setAttribute("aria-hidden", "true");
    scene.appendChild(hotspotOverlay);
  }
  return hotspotOverlay;
};

// Horizontal hotspots (left/right) for X-ring rotation. Clicking advances one
// face along the rotation map (matches the arrow-key mental model).
const makeHotspot = (side) => {
  const el = document.createElement("div");
  el.title = "Click to rotate the cube";
  el.setAttribute("aria-hidden", "true"); // decorative; keyboard handles a11y nav
  el.className = `hotspot hotspot-${side}`;
  el.addEventListener("click", () => {
    step(side === "right" ? "right" : "left");
  });
  getHotspotOverlay().appendChild(el);
};
makeHotspot("left");
makeHotspot("right");

// Top/bottom hotspots for Y-axis (pitch) rotation. Clicking top pitches up
// through the vertical seam; clicking bottom pitches down.
const makePitchHotspot = (dir) => {
  const el = document.createElement("div");
  el.title = "Click to rotate the cube vertically";
  el.setAttribute("aria-hidden", "true");
  el.className = `hotspot hotspot-${dir}`;
  el.addEventListener("click", () => {
    step(dir === "top" ? "up" : "down");
  });
  getHotspotOverlay().appendChild(el);
};
makePitchHotspot("top");
makePitchHotspot("bottom");

// Free-form pointer drag (trackball-style): the cube follows the pointer while
// held (cursor -> grab hand), and snaps to the nearest canonical face on
// release. Horizontal drag = yaw (X-ring); vertical drag = pitch (top/bottom).
let dragStartX = null;
let dragStartY = null;
let dragging = false;
let dragStartFace = null; // face the drag began on, used for snap tie-breaker
let liveX = 0;
let liveY = 0;

const applyLiveTransform = () => {
  cube.style.transform = `translateZ(calc(var(--cube-size) / -2)) rotateX(${liveX}deg) rotateY(${liveY}deg)`;
};

scene.addEventListener("pointerdown", (e) => {
  // Ignore presses that begin on a navigation hotspot: those have their own
  // click handler that advances exactly one face. If we also started a drag
  // here, the drag's pointerup snap would override that single-step nav
  // (this was the cause of the arrow being dead on the front face and
  // jumping two faces elsewhere). See #3 / #4.
  if (e.target.closest(".hotspot")) return;
  // Ignore drags that start on the scrollable face content (let users select text)
  if (e.target.closest(".face-content") && e.target.closest(".face-active")) return;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  liveX = currentX;
  liveY = currentY;
  dragStartFace = currentFace; // remember where we began, for the snap tie-breaker
  dragging = true;
  scene.classList.add("grabbing");
  // Disable the CSS transition so the cube tracks the pointer 1:1
  cube.style.transition = "none";
  scene.setPointerCapture?.(e.pointerId);
  e.preventDefault();
});

scene.addEventListener("pointermove", (e) => {
  if (!dragging || dragStartX === null) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  // 0.5deg per px feels responsive without being twitchy
  liveY = currentY + dx * 0.5;
  liveX = currentX - dy * 0.5;
  applyLiveTransform();
});

// Pick the canonical face whose (x,y) rotation is geometrically closest to a
// given live angle. If two faces are equally close (within the dead-zone),
// fall back to `preferred` (the face the user started the drag from).
const nearestFace = (x, y, preferred) => {
  let best = null;
  let bestDist = Infinity;
  for (const f of faces) {
    const r = faceRotations[f];
    if (!r) continue;
    // Compare angles on the wrapped circle so 350deg is 10deg from 0.
    const dy = Math.abs(normalize(y - r.y));
    const dx = Math.abs(normalize(x - r.x));
    const dist = dx + dy;
    if (dist < bestDist) { bestDist = dist; best = f; }
  }
  // Dead-zone: if the nearest face is still more than 45deg away on either
  // axis, the cube is between faces and the call is ambiguous -> keep the
  // face the user started from rather than guessing.
  if (bestDist > 90) return preferred;
  return best;
};

scene.addEventListener("pointerup", (e) => {
  if (dragStartX === null || !dragging) return;
  dragging = false;
  scene.classList.remove("grabbing");
  // Re-enable transitions for the snap
  cube.style.transition = "";
  const dxTotal = e.clientX - dragStartX;
  const dyTotal = e.clientY - dragStartY;
  const moved = Math.hypot(dxTotal, dyTotal);
  let target;
  if (moved < 4) {
    // A press with no real movement is a click/tap, not a drag: return to the
    // face we started on (don't re-snap based on a ~0deg live angle, which
    // previously caused spurious full-face flips). #5b
    target = dragStartFace;
  } else {
    // Snap to the canonical face closest to the released angle. The tie/
    // ambiguity rule inside nearestFace returns to the starting face when the
    // cube is wedged between faces. #5b / #5c / #5d
    target = nearestFace(liveX, liveY, dragStartFace);
  }
  // ALWAYS snap, even if target === currentFace: goToFace early-returns when
  // the target equals the current face, which previously left the cube in a
  // *partial* (un-snapped) rotation. Force the canonical angle onto the cube.
  if (target === currentFace) {
    const rot = faceRotations[currentFace];
    if (rot) {
      // Choose the equivalent live angle nearest currentX/Y to avoid a long spin
      currentX = rot.x;
      currentY = rot.y;
      applyTransform();
    }
  } else {
    goToFace(target);
  }
  dragStartX = null;
  dragStartY = null;
  dragStartFace = null;
});

scene.addEventListener("pointercancel", () => {
  if (!dragging) return;
  dragging = false;
  scene.classList.remove("grabbing");
  cube.style.transition = "";
  // Snap back to the current canonical face (never leave a partial rotation).
  const rot = faceRotations[currentFace];
  if (rot) { currentX = rot.x; currentY = rot.y; applyTransform(); }
  dragStartX = null;
  dragStartY = null;
  dragStartFace = null;
});

// Wheel-forwarding for scroll on rotated faces.
// CSS-3D limitation: only the screen-parallel face (front, at rest) receives
// native pointer/wheel hit-testing. Every OTHER active face still carries a
// non-identity element transform (e.g. right = rotateY(90)); it only LOOKS flat
// because the cube counter-rotates. Chromium's 3D hit-test can't reliably land
// the wheel on such a face, so events fall through to `.scene` and the face
// won't scroll. Fix: intercept wheel on the scene and drive the ACTIVE face's
// .face-content.scrollTop ourselves. Only acts when that content actually
// overflows; otherwise we let the event pass (page/other scroll unaffected).
scene.addEventListener("wheel", (e) => {
  if (dragging) return;
  const activeEl = document.querySelector(".face.face-active");
  const fc = activeEl && activeEl.querySelector(".face-content");
  if (!fc) return;
  if (fc.scrollHeight <= fc.clientHeight) return; // nothing to scroll
  const atTop = fc.scrollTop <= 0;
  const atBottom = fc.scrollTop + fc.clientHeight >= fc.scrollHeight - 1;
  // Let the browser handle over-scroll at the edges (no trap).
  if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) return;
  fc.scrollTop += e.deltaY;
  e.preventDefault();
}, { passive: false });

// Keyboard navigation (accessibility + power-user shortcuts)
// 1-6 jump to a face. Arrow keys rotate the cube *continuously* in the
// pressed direction, matching the numbered-key mental model:
//   - Left/Right step along the X-ring (front->right->back->left->front...).
//   - Up/Down pitch across the top/bottom seam:
//       front --up--> top --up--> back --up--> bottom --up--> front
//       (down reverses the path). The last horizontal direction is preserved
//       so repeated Left/Right keep turning the same way.
window.addEventListener("keydown", (e) => {
  // Ignore when typing in an input/textarea/iframe content
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  const ringOrder = ["front", "right", "back", "left", "top", "bottom"];
  if (e.key >= "1" && e.key <= "6") {
    const face = ringOrder[Number(e.key) - 1];
    if (face) goToFace(face);
    e.preventDefault();
    return;
  }
  switch (e.key) {
    case "ArrowLeft":
      step("left");
      e.preventDefault();
      break;
    case "ArrowRight":
      step("right");
      e.preventDefault();
      break;
    case "ArrowUp":
      step("up");
      e.preventDefault();
      break;
    case "ArrowDown":
      step("down");
      e.preventDefault();
      break;
  }
});

window.addEventListener("resize", () => {
  applyTransform();
});

// Setup browser history listener for back/forward navigation
if (window.urlManager) {
  window.urlManager.setupHistoryListener((face, options) => {
    goToFace(face, options);
  });
}

// Initialize - load data first, then show app
loadData().then(() => {
  const showApp = () => {
    // Set initial position without animation BEFORE showing app
    cube.style.transition = 'none';
    setActiveButton(currentFace);
    setActiveFace(currentFace);
    applyTransform();
    applyTextRotation(currentFace); // Phase 2: orient initial face's text (no fade on first paint)
    // Orient every face for the initial orientation (cheap; side/back faces
    // are at unreadable angles now but correct once the user rotates to them).
    faces.forEach((f) => { if (f !== currentFace) applyTextRotation(f); });

    // Force reflow to apply the transform without transition
    void cube.offsetWidth;

    // Re-enable transitions for future navigation
    cube.style.transition = '';

    // Now show the app - remove loader and let CSS media queries control app visibility
    spinner.classList.add('loader-hidden');
    setTimeout(() => {
      spinner.style.display = 'none';
      // Don't set inline display style - CSS media queries handle this

      // Initialize Swiper for mobile UI
      const swiperOptions = {
        effect: 'cube',
        grabCursor: true,
        loop: true,
        cubeEffect: {
          shadow: true,
          slideShadows: true,
          shadowOffset: 20,
          shadowScale: 0.94,
        },
        pagination: {
          el: '.swiper-pagination',
        },
        scrollbar: {
          el: '.swiper-scrollbar',
          draggable: true,
        },
        navigation: {
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        },
      };

      const startIndex = Array.isArray(facesData) ? facesData.findIndex(f => f.id === currentFace) : -1;
      if (startIndex >= 0) swiperOptions.initialSlide = startIndex;

      // Add init event handler to options so it fires during construction
      swiperOptions.on = {
        init: function() {
          // Mark document ready so CSS reveals mobile UI (preventing flash of wrong slide)
          try { document.documentElement.classList.add('app-ready'); } catch (e) {}
        }
      };

      const swiper = new Swiper('.mySwiper', swiperOptions);
      mobileSwiper = swiper;

      // Keep urlManager and app state in sync when the user navigates the swiper
      if (mobileSwiper && Array.isArray(facesData)) {
        mobileSwiper.on('slideChange', () => {
          const idx = mobileSwiper.realIndex ?? mobileSwiper.activeIndex;
          const faceObj = facesData[idx];
          if (!faceObj) return;
          const newFaceId = faceObj.id;
          if (newFaceId && newFaceId !== currentFace) {
            currentFace = newFaceId;
            setActiveButton(currentFace);
            // update urlManager so URL reflects mobile slide
            if (window.urlManager && typeof window.urlManager.updateURL === 'function') {
              window.urlManager.updateURL(currentFace);
            }
          }
        });
      }

      // Set flag in localStorage so spinner doesn't show on subsequent loads
      localStorage.setItem('ui-has-loaded', 'true');
    }, 300);
  };

  // Show spinner only on first load, skip on subsequent loads
  if (!hasSeenLoader) {
    setTimeout(showApp, 3000);
  } else {
    showApp();
  }
});

// Compact angles after the transform finishes to keep numeric values small
// without changing the visual orientation. This prevents accumulated
// +/-360° growth that can later cause confusing long rotations.
const compactAngles = () => {
  const nx = normalize(currentX);
  const ny = normalize(currentY);
  if (nx === currentX && ny === currentY) return;

  // Temporarily disable transition, write compacted angles, then re-enable
  const prevInline = cube.style.transition;
  cube.style.transition = "none";
  currentX = nx;
  currentY = ny;
  applyTransform();
  // Force reflow to ensure the no-transition transform is applied
  void cube.offsetWidth;
  // Restore inline transition to allow CSS rules to take effect again
  cube.style.transition = prevInline;
};

cube.addEventListener("transitionend", (e) => {
  if (e.propertyName !== "transform") return;
  compactAngles();
});

if (debugmode) {
    console.log('Debug Mode is: %cON', 'font-weight: bold; color: lime;');
    // make borders visible on columns
    const scolumn = document.getElementById('scolumn'); // spacer column
    const ccolumn = document.getElementById('ccolumn'); // cube column
    if (scolumn && ccolumn) {
      scolumn.style.border = '1px dashed yellow';
      ccolumn.style.border = '1px dashed red';
    }
    // print out cube column dimensions
    let elem = document.getElementById("ccolumn");
    let rect = elem.getBoundingClientRect();
    console.groupCollapsed('Cube column dimensions');
    for (const key in rect) {
      if (typeof rect[key] !== "function") {
        console.log(`${key} : ${rect[key]}`);
      }
    }
    console.groupEnd();
}
