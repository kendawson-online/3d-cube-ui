import { cloneTemplate } from '../utils/dom.js';
import { getState, setState, watchState } from '../state/store.js';

export function createMenuController({ faces = [], onSelectFace }) {
  const slot = document.querySelector('[data-menu-slot]');
  const buttonsByFace = new Map();

  function renderButtons() {
    if (!slot) return;
    slot.innerHTML = '';
    faces.forEach((face) => {
      const btn = cloneTemplate('tpl-menu-button');
      btn.dataset.face = face.id;
      const icon = btn.querySelector('.icon');
      if (icon) {
        icon.classList.add(`bi-${face.num || 1}-circle-fill`);
      }
      const label = btn.querySelector('.label');
      if (label) label.textContent = face.title || face.id;
      btn.addEventListener('click', () => {
        if (typeof onSelectFace === 'function') {
          onSelectFace(face.id, { userInitiated: true, source: 'menu' });
        }
      });
      slot.appendChild(btn);
      buttonsByFace.set(face.id, btn);
    });
  }

  function syncActive(faceId) {
    buttonsByFace.forEach((btn, id) => {
      btn.classList.toggle('active', id === faceId);
    });
  }

  function syncCollapsed(collapsed) {
    document.body.classList.toggle('menu-collapsed', collapsed);
    const toggle = document.getElementById('menu-collapse-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!collapsed));
    }
  }

  function bindToggle() {
    const toggle = document.getElementById('menu-collapse-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', (ev) => {
      ev.preventDefault();
      const current = getState().menuCollapsed;
      setState({ menuCollapsed: !current });
    });
  }

  renderButtons();
  bindToggle();
  syncCollapsed(getState().menuCollapsed);
  // Wire click on the visible edge to toggle menu collapse (mimic GitHub)
  try {
    const edge = document.getElementById('menu-edge');
    if (edge) {
      edge.addEventListener('click', () => {
        const current = getState().menuCollapsed;
        setState({ menuCollapsed: !current });
      });
    }
  } catch (e) {}
  syncActive(getState().currentFace);

  watchState('menuCollapsed', (collapsed) => syncCollapsed(collapsed));
  watchState('currentFace', (faceId) => syncActive(faceId));

  return { syncActive };
}
