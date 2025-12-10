const STORAGE_KEYS = {
  FACE: 'ui-current-face',
  MENU: 'ui-menu-collapsed',
  DIMENSIONS: 'ui-last-dimensions'
};

const emitter = new EventTarget();

const defaultDimensions = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DIMENSIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { width: window.innerWidth, height: window.innerHeight };
})();

const state = {
  faces: [],
  facesById: {},
  currentFace: (() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.FACE) || 'front';
    } catch (e) {
      return 'front';
    }
  })(),
  menuCollapsed: (() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.MENU) === '1';
    } catch (e) {
      return false;
    }
  })(),
  mode: 'loading',
  loaderVisible: true,
  lastDimensions: defaultDimensions
};

function cloneState() {
  return JSON.parse(JSON.stringify(state));
}

function persist(key, value, { json = false } = {}) {
  try {
    if (json) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.setItem(key, value);
  } catch (e) {}
}

function setState(patch = {}) {
  const changed = [];
  Object.entries(patch).forEach(([key, value]) => {
    const prev = state[key];
    const isDifferent = typeof value === 'object'
      ? JSON.stringify(prev) !== JSON.stringify(value)
      : prev !== value;
    if (!isDifferent) return;
    state[key] = value;
    changed.push(key);
    if (key === 'currentFace') {
      persist(STORAGE_KEYS.FACE, value);
    }
    if (key === 'menuCollapsed') {
      persist(STORAGE_KEYS.MENU, value ? '1' : '0');
    }
    if (key === 'lastDimensions') {
      persist(STORAGE_KEYS.DIMENSIONS, value, { json: true });
    }
  });
  if (!changed.length) return state;
  emitter.dispatchEvent(new CustomEvent('state:change', {
    detail: { changed, state: cloneState() }
  }));
  return state;
}

function setFaces(faces = []) {
  const facesById = faces.reduce((acc, face) => {
    acc[face.id] = face;
    return acc;
  }, {});
  setState({ faces, facesById });
}

function getState() {
  return cloneState();
}

function onStateChange(handler) {
  if (typeof handler !== 'function') return () => {};
  const wrapped = (event) => handler(event.detail);
  emitter.addEventListener('state:change', wrapped);
  return () => emitter.removeEventListener('state:change', wrapped);
}

function watchState(key, handler) {
  return onStateChange(({ changed, state }) => {
    if (changed.includes(key)) handler(state[key], state);
  });
}

function emit(eventName, detail) {
  emitter.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function on(eventName, handler) {
  if (typeof handler !== 'function') return () => {};
  const wrapped = (event) => handler(event.detail);
  emitter.addEventListener(eventName, wrapped);
  return () => emitter.removeEventListener(eventName, wrapped);
}

export { getState, setState, setFaces, onStateChange, watchState, emit, on, STORAGE_KEYS };
