const ring = ['front', 'right', 'back', 'left'];
const faceRotations = {
  front: { x: 0, y: 0 },
  right: { x: 0, y: -90 },
  back: { x: 0, y: 180 },
  left: { x: 0, y: 90 },
  top: { x: -90, y: 0 },
  bottom: { x: 90, y: 0 }
};

function normalizeAngle(value) {
  let v = value % 360;
  if (v > 180) v -= 360;
  if (v < -180) v += 360;
  return v;
}

export function createCubeController({ onNavigate } = {}) {
  const cube = document.getElementById('cube');
  const scene = document.getElementById('scene');
  if (!cube || !scene) {
    return { goToFace: () => {}, setFaceImmediate: () => {}, refresh: () => {} };
  }

  let currentFace = 'front';
  let currentX = faceRotations[currentFace].x;
  let currentY = faceRotations[currentFace].y;

  function applyTransform() {
    cube.style.transform = `translateZ(calc(var(--cube-size, 800px) / -2)) rotateX(${currentX}deg) rotateY(${currentY}deg)`;
  }

  function compactAngles() {
    const nx = normalizeAngle(currentX);
    const ny = normalizeAngle(currentY);
    if (nx === currentX && ny === currentY) return;
    const prevTransition = cube.style.transition;
    cube.style.transition = 'none';
    currentX = nx;
    currentY = ny;
    applyTransform();
    void cube.offsetWidth;
    cube.style.transition = prevTransition;
  }

  function setFaceImmediate(faceId) {
    const rot = faceRotations[faceId];
    if (!rot) return;
    currentFace = faceId;
    currentX = rot.x;
    currentY = rot.y;
    const prevTransition = cube.style.transition;
    cube.style.transition = 'none';
    applyTransform();
    void cube.offsetWidth;
    cube.style.transition = prevTransition;
  }

  function rotateRing(targetFace) {
    const inRingFrom = ring.includes(currentFace);
    const inRingTo = ring.includes(targetFace);
    if (!(inRingFrom && inRingTo)) return false;
    const fromIdx = ring.indexOf(currentFace);
    const toIdx = ring.indexOf(targetFace);
    const len = ring.length;
    const leftSteps = (toIdx - fromIdx + len) % len;
    const rightSteps = (fromIdx - toIdx + len) % len;
    const canonFrom = faceRotations[currentFace]?.y ?? currentY;
    if (leftSteps <= rightSteps) {
      let proposed = canonFrom - 90 * leftSteps;
      while (Math.abs(proposed - currentY) > 180) {
        proposed += proposed < currentY ? 360 : -360;
      }
      currentY = proposed;
    } else {
      let proposed = canonFrom + 90 * rightSteps;
      while (Math.abs(proposed - currentY) > 180) {
        proposed += proposed < currentY ? 360 : -360;
      }
      currentY = proposed;
    }
    currentX = 0;
    currentFace = targetFace;
    return true;
  }

  function snapToFace(targetFace) {
    const rot = faceRotations[targetFace];
    if (!rot) return false;
    currentX = rot.x;
    currentY = rot.y;
    currentFace = targetFace;
    return true;
  }

  function goToFace(targetFace, { userInitiated = false } = {}) {
    if (!targetFace || targetFace === currentFace) return;
    const inRingFrom = ring.includes(currentFace);
    const inRingTo = ring.includes(targetFace);
    const rotated = (inRingFrom && inRingTo) ? rotateRing(targetFace) : snapToFace(targetFace);
    if (!rotated) return;
    applyTransform();
    if (typeof onNavigate === 'function' && userInitiated) {
      onNavigate({ faceId: targetFace, userInitiated: true, source: 'cube' });
    }
  }

  function handleDragNavigation(dx) {
    if (!ring.includes(currentFace)) return;
    const dir = dx < 0 ? 1 : -1;
    const idx = ring.indexOf(currentFace);
    const next = dir === 1 ? ring[(idx + 1) % ring.length] : ring[(idx + ring.length - 1) % ring.length];
    goToFace(next, { userInitiated: true });
  }

  let dragStartX = null;
  scene.addEventListener('pointerdown', (event) => {
    dragStartX = event.clientX;
  });
  scene.addEventListener('pointerup', (event) => {
    if (dragStartX === null) return;
    const dx = event.clientX - dragStartX;
    dragStartX = null;
    if (Math.abs(dx) < 30) return;
    handleDragNavigation(dx);
  });

  function createHotspot(side) {
    const hotspot = document.createElement('div');
    hotspot.className = `hotspot hotspot-${side}`;
    hotspot.title = 'Rotate cube';
    hotspot.addEventListener('click', () => {
      if (!ring.includes(currentFace)) return;
      const idx = ring.indexOf(currentFace);
      const next = side === 'right'
        ? ring[(idx + 1) % ring.length]
        : ring[(idx + ring.length - 1) % ring.length];
      goToFace(next, { userInitiated: true });
    });
    scene.appendChild(hotspot);
  }

  createHotspot('left');
  createHotspot('right');

  cube.addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'transform') return;
    compactAngles();
  });

  window.addEventListener('resize', () => applyTransform());

  return { goToFace, setFaceImmediate, refresh: applyTransform };
}
