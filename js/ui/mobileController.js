import { cloneTemplate } from '../utils/dom.js';

export function createMobileController({ faces = [], mountFaceContent, prefetchNeighbors, onNavigate }) {
  const host = document.getElementById('mobile-ui');
  let swiper = null;
  let container = null;

  function buildDOM() {
    if (!host) return;
    host.innerHTML = '';
    container = document.createElement('div');
    container.className = 'mobile-swiper-container swiper-container';

    const topbar = document.createElement('div');
    topbar.className = 'mobile-topbar';
    const select = document.createElement('select');
    select.id = 'mobile-face-select';
    faces.forEach((face) => {
      const option = document.createElement('option');
      option.value = face.id;
      option.textContent = face.title || face.id;
      select.appendChild(option);
    });
    select.addEventListener('change', (event) => {
      slideTo(event.target.value, { fromSelect: true });
    });
    topbar.appendChild(select);
    container.appendChild(topbar);

    const wrapper = document.createElement('div');
    wrapper.className = 'swiper-wrapper';
    faces.forEach((face) => {
      const slide = cloneTemplate('tpl-mobile-slide');
      slide.dataset.face = face.id;
      slide.setAttribute('data-type', face.type || 'html');
      wrapper.appendChild(slide);
    });
    container.appendChild(wrapper);

    const pagination = document.createElement('div');
    pagination.className = 'swiper-pagination';
    container.appendChild(pagination);
    const prev = document.createElement('div'); prev.className = 'swiper-button-prev'; container.appendChild(prev);
    const next = document.createElement('div'); next.className = 'swiper-button-next'; container.appendChild(next);

    host.appendChild(container);
  }

  function mount(initialFaceId) {
    if (!window.Swiper || swiper) return;
    buildDOM();
    if (!container) return;
    const initialIdx = Math.max(0, faces.findIndex((face) => face.id === initialFaceId));
    swiper = new Swiper(container, {
      loop: false,
      initialSlide: initialIdx,
      direction: 'horizontal',
      slidesPerView: 1,
      spaceBetween: 12,
      pagination: { el: container.querySelector('.swiper-pagination'), clickable: true },
      navigation: {
        nextEl: container.querySelector('.swiper-button-next'),
        prevEl: container.querySelector('.swiper-button-prev')
      },
      keyboard: { enabled: true },
      on: {
        init() {
          const targetFace = faces[this.realIndex] || faces[initialIdx];
          syncSelect(targetFace?.id);
          mountVisibleFace(targetFace);
          if (prefetchNeighbors) prefetchNeighbors(faces, this.realIndex);
        },
        slideChange() {
          const idx = typeof this.realIndex === 'number' ? this.realIndex : this.activeIndex;
          const face = faces[idx];
          mountVisibleFace(face);
          syncSelect(face?.id);
          if (prefetchNeighbors) prefetchNeighbors(faces, idx);
          if (typeof onNavigate === 'function' && face) {
            onNavigate({ faceId: face.id, userInitiated: true, source: 'mobile' });
          }
        }
      }
    });
  }

  function mountVisibleFace(face) {
    if (!face) return;
    const slide = container?.querySelector(`.swiper-slide[data-face="${face.id}"] .slide-inner`);
    if (slide && typeof mountFaceContent === 'function') {
      mountFaceContent(face, slide);
    }
  }

  function syncSelect(faceId) {
    const select = container?.querySelector('#mobile-face-select');
    if (select && typeof faceId === 'string') {
      select.value = faceId;
    }
  }

  function slideTo(faceId) {
    if (!swiper || !faceId) return;
    const idx = faces.findIndex((face) => face.id === faceId);
    if (idx < 0) return;
    if (swiper.realIndex === idx) return;
    swiper.slideTo(idx);
  }

  function destroy() {
    if (swiper) {
      swiper.destroy(true, true);
      swiper = null;
    }
    if (host) host.innerHTML = '';
    container = null;
  }

  function getActiveFaceId() {
    if (!swiper) return null;
    const idx = typeof swiper.realIndex === 'number' ? swiper.realIndex : swiper.activeIndex;
    return faces[idx]?.id || null;
  }

  return { mount, destroy, slideTo, getActiveFaceId };
}
