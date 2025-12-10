import { setState } from '../state/store.js';

const LOADER_MIN_MS = 1200;
const SEEN_KEY = 'ui-loader-seen';

export function createLoader() {
  const overlay = document.getElementById('loader-overlay');
  let visible = true;
  let start = performance.now();

  function show() {
    if (!overlay) return;
    overlay.classList.remove('loader-hidden');
    overlay.setAttribute('aria-hidden', 'false');
    visible = true;
    start = performance.now();
    setState({ loaderVisible: true });
  }

  function hide(force = false) {
    if (!overlay || !visible) return;
    const elapsed = performance.now() - start;
    const remaining = LOADER_MIN_MS - elapsed;
    const finalize = () => {
      overlay.classList.add('loader-hidden');
      window.setTimeout(() => {
        overlay.remove();
      }, 350);
      overlay.setAttribute('aria-hidden', 'true');
      visible = false;
      setState({ loaderVisible: false });
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    };
    if (force || remaining <= 0) finalize();
    else window.setTimeout(finalize, remaining);
  }

  function hasSeen() {
    try {
      return localStorage.getItem(SEEN_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function captureDimensions() {
    try {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setState({ lastDimensions: { width, height, source: 'loader' } });
    } catch (e) {}
  }

  return { show, hide, hasSeen, captureDimensions };
}
