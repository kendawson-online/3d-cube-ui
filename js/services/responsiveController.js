import { setState } from '../state/store.js';
import { debounce } from '../utils/debounce.js';

const DEFAULT_BREAKPOINTS = {
  mobile: 750,
  desktopLarge: 1150
};

export function createResponsiveController(options = {}) {
  const { breakpoints = DEFAULT_BREAKPOINTS } = options;
  const emitter = new EventTarget();

  function classifyMode(width) {
    if (width < breakpoints.mobile) return 'mobile';
    if (width < breakpoints.desktopLarge) return 'desktop-medium';
    return 'desktop-large';
  }

  function updateMetrics(source = 'resize') {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const mode = classifyMode(width);
    const menu = document.querySelector('.menu');
    const menuWidth = mode === 'mobile' ? 0 : (menu ? menu.getBoundingClientRect().width : 0);
    const availableWidth = Math.max(240, width - menuWidth - 48);
    const availableHeight = Math.max(240, height - 160);
    const size = Math.floor(Math.max(260, Math.min(availableWidth, availableHeight)));
    const perspective = Math.round(size * 1.8);
    document.documentElement.style.setProperty('--cube-size', `${size}px`);
    document.documentElement.style.setProperty('--cube-perspective', `${perspective}px`);
    document.documentElement.style.setProperty('--viewport-width', `${width}px`);
    document.documentElement.style.setProperty('--viewport-height', `${height}px`);
    document.documentElement.style.setProperty('--menu-current-width', `${menuWidth}px`);
    setState({
      mode,
      lastDimensions: { width, height, menuWidth, size, source }
    });
    emitter.dispatchEvent(new CustomEvent('modechange', { detail: { mode } }));
    emitter.dispatchEvent(new CustomEvent('resize', { detail: { width, height, size } }));
  }

  const debounced = debounce(() => updateMetrics('resize'), 120);
  window.addEventListener('resize', debounced);
  updateMetrics('init');

  function on(eventName, handler) {
    if (typeof handler !== 'function') return () => {};
    const wrapped = (event) => handler(event.detail);
    emitter.addEventListener(eventName, wrapped);
    return () => emitter.removeEventListener(eventName, wrapped);
  }

  function refresh() {
    updateMetrics('refresh');
  }

  function dispose() {
    window.removeEventListener('resize', debounced);
  }

  return { on, refresh, dispose };
}
