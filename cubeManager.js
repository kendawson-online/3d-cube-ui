// ------------------------------------------------------------------------
// Cube Manager 
// Manages 3D cube rendering, interactions, and exposes cubeGoToFace API.
// Inspired by: https://codepen.io/l-ignatova/pen/qByExmV
// Created 12/7/25 by <ken@kendawson.com>
// Last updated: 12/8/25
// ------------------------------------------------------------------------

const version = '0.1.0-beta';
const debugmode = false;

const faces = ["front", "right", "back", "left", "top", "bottom"];
const ring = ["front", "right", "back", "left"];

// Canonical face rotations. These are aligned to the incremental
// step logic used by `goToFace` so adjacent ring moves change Y by ±90deg.
// (front -> right -> back -> left produces Y: 0 -> -90 -> 180 -> 90 -> 0)
const faceRotations = {
  front: { x: 0, y: 0 },
  right: { x: 0, y: -90 },
  back: { x: 0, y: 180 },
  left: { x: 0, y: 90 },
  top: { x: -90, y: 0 },
  bottom: { x: 90, y: 0 },
};

const cube = document.getElementById("cube");
const scene = document.getElementById("scene");
const buttons = Array.from(document.querySelectorAll(".btn"));

let currentFace = localStorage.getItem("ui-current-face") || "front";
// If a view query param is present (e.g. ?view=face4 or ?view=left), prefer it
try {
  const params = new URLSearchParams(window.location.search);
  const v = params.get('view');
  if (v) {
    // support links like 'face1'..'face6' mapping to ring order, or direct face ids
    const m = v.match(/^face(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n >= 1 && n <= faces.length) {
        currentFace = faces[n - 1];
      }
    } else if (faces.includes(v)) {
      currentFace = v;
    }
  }
} catch (e) {
  // ignore
}
let currentX = faceRotations[currentFace].x;
let currentY = faceRotations[currentFace].y;

const setActiveButton = (face) => {
  buttons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.face === face);
  });
};

const normalize = (a) => {
  let v = a % 360;
  if (v > 180) v -= 360;
  if (v < -180) v += 360;
  return v;
};

const applyTransform = () => {
  cube.style.transform = `translateZ(calc(var(--size) / -2)) rotateX(${currentX}deg) rotateY(${currentY}deg)`;
};

const goToFace = (targetFace, options = {}) => {
  if (!targetFace || targetFace === currentFace) return;

  const inRingFrom = ring.includes(currentFace);
  const inRingTo = ring.includes(targetFace);

  if (inRingFrom && inRingTo) {
    const fromIdx = ring.indexOf(currentFace);
    const toIdx = ring.indexOf(targetFace);
    const n = ring.length;
    const leftSteps = (toIdx - fromIdx + n) % n;
    const rightSteps = (fromIdx - toIdx + n) % n;
    // Use canonical face rotations as the basis so equivalent angles
    // (like -180 vs +180) don't cause sign-mismatch flips during CSS interpolation.
    const canonFrom = faceRotations[currentFace]?.y ?? currentY;
    const canonTo = faceRotations[targetFace]?.y ?? currentY;

    if (debugmode) {
        console.log(`goToFace: from=${currentFace}(${fromIdx}) to=${targetFace}(${toIdx}) leftSteps=${leftSteps} rightSteps=${rightSteps} canonFrom=${canonFrom} canonTo=${canonTo} currentY=${currentY}`);
    }

    // Always favor left if it's shorter or equal to keep consistent direction feel
    if (leftSteps <= rightSteps) {
      const before = currentY;
      let proposed = canonFrom - 90 * leftSteps;
      // shift proposed by +/-360 until it's the closest numeric equivalent to currentY
      while (Math.abs(proposed - currentY) > 180) {
        proposed += proposed < currentY ? 360 : -360;
      }
      currentY = proposed;
      if (debugmode) {
        console.log(`  chosen:left steps=${leftSteps} beforeY=${before} proposed=${proposed} afterY=${currentY}`);
      }
    } else {
      const before = currentY;
      let proposed = canonFrom + 90 * rightSteps;
      while (Math.abs(proposed - currentY) > 180) {
        proposed += proposed < currentY ? 360 : -360;
      }
      currentY = proposed;
      if (debugmode) {
        console.log(`  chosen:right steps=${rightSteps} beforeY=${before} proposed=${proposed} afterY=${currentY}`);
      }
    }
    currentX = 0;
  } else {
    // Snap to canonical rotation for any transition involving top/bottom
    const rot = faceRotations[targetFace];
    if (!rot) return;
    if (debugmode) {
        console.log(`goToFace: snapping from ${currentFace} to ${targetFace} rot=(${rot.x},${rot.y})`);
    }
    currentX = rot.x;
    currentY = rot.y;
  }

  currentFace = targetFace;
  applyTransform();
  setActiveButton(currentFace);
  localStorage.setItem("ui-current-face", currentFace);
  // Notify other controllers about the face change
  try {
    window.dispatchEvent(new CustomEvent('cube:facechange', { detail: { face: currentFace, rotation: { x: currentX, y: currentY }, userInitiated: !!options.userInitiated } }));
  } catch (e) {
    // ignore
  }
};

// Expose a programmatic API so external controller can navigate the cube
window.cubeGoToFace = (faceId, options = {}) => {
  try {
    goToFace(faceId, options);
  } catch (e) {
    console.error('cubeGoToFace error', e);
  }
};

buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    goToFace(btn.dataset.face, { userInitiated: true });
  });
});

// Basic drag-to-rotate for ring faces
let dragStartX = null;
scene.addEventListener("pointerdown", (e) => {
  dragStartX = e.clientX;
});
scene.addEventListener("pointerup", (e) => {
  if (dragStartX === null) return;
  const dx = e.clientX - dragStartX;
  dragStartX = null;
  if (Math.abs(dx) < 30) return;
  if (!ring.includes(currentFace)) return;
  if (dx < 0) {
    // drag left → rotate cube left (next face in ring)
    const next = ring[(ring.indexOf(currentFace) + 1) % ring.length];
    goToFace(next, { userInitiated: true });
  } else {
    const prev = ring[(ring.indexOf(currentFace) + ring.length - 1) % ring.length];
    goToFace(prev, { userInitiated: true });
  }
});

// Add click targets on left/right edges
const makeHotspot = (side) => {
  const el = document.createElement("div");
  el.title = "Click to rotate the cube";
  el.className = `hotspot hotspot-${side}`;
  el.addEventListener("click", () => {
    if (!ring.includes(currentFace)) return;
    const idx = ring.indexOf(currentFace);
    const next = side === "right"
      ? ring[(idx + 1) % ring.length]
      : ring[(idx + ring.length - 1) % ring.length];
    goToFace(next, { userInitiated: true });
  });
  scene.appendChild(el);
};
makeHotspot("left");
makeHotspot("right");

window.addEventListener("resize", () => {
  applyTransform();
});

// Initialize (apply initial orientation without animation so reloads don't animate)
setActiveButton(currentFace);
// Temporarily disable CSS transition to avoid animating into place on first paint
const prevTransition = cube.style.transition;
cube.style.transition = 'none';
applyTransform();
// Force reflow then restore transition
void cube.offsetWidth;
cube.style.transition = prevTransition || '';

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

console.log(`%c3D Cube UI - version: ${version}`,'font-weight:bold;');
if (debugmode) {
    console.log('Debug Mode is: %cON', 'font-weight: bold; color: lime;');
}

// expose debug flag to other modules (so controller can pick it up)
window.DEBUGMODE = !!debugmode;
