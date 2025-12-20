// ------------------------------------------------------------------------
// 3D Cube UI
// Inspired by: https://codepen.io/l-ignatova/pen/qByExmV
// Created 12/7/25 by <ken@kendawson.com>
// Last updated: 12/20/25
// ------------------------------------------------------------------------

// show extra debugging data
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
  });

  // Add face-active class to the current face
  const activeFaceEl = document.querySelector(`.face-${face}`);
  if (activeFaceEl) {
    activeFaceEl.classList.add('face-active');
  }
};

const normalize = (a) => {
  let v = a % 360;
  if (v > 180) v -= 360;
  if (v < -180) v += 360;
  return v;
};

const applyTransform = () => {
  cube.style.transform = `translateZ(calc(var(--cube-size) / -2)) rotateX(${currentX}deg) rotateY(${currentY}deg)`;
};

const goToFace = (targetFace, options = {}) => {
  if (!targetFace || targetFace === currentFace) return;

  const { skipHistory = false } = options;

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
  setActiveFace(currentFace);
  localStorage.setItem("ui-current-face", currentFace);
  
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
  const CACHE_KEY = 'ui-faces-data';
  const CACHE_VERSION_KEY = 'ui-faces-version';
  const CURRENT_VERSION = '1.0';
  
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
      const storedFace = localStorage.getItem("ui-current-face");
      
      // Priority: URL > localStorage > default
      if (urlFace && urlFace !== 'invalid') {
        currentFace = urlFace;
      } else if (urlFace === 'invalid') {
        // Invalid URL - show error and use default
        if (window.notify) {
          window.notify.error('The requested URL does not exist');
        }
        currentFace = storedFace || "front";
      } else {
        // No URL parameter - use localStorage or default
        currentFace = storedFace || "front";
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
    goToFace(next);
  } else {
    const prev = ring[(ring.indexOf(currentFace) + ring.length - 1) % ring.length];
    goToFace(prev);
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
    goToFace(next);
  });
  scene.appendChild(el);
};
makeHotspot("left");
makeHotspot("right");

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