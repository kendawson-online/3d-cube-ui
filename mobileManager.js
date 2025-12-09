// mobileManager.js
// Responsible for mobile UI (Swiper) only. Exposes init/destroy/slideToFace.
(function () {
  let swiper = null;
  let container = null;
  let faces = [];
  let callbacks = {};

  function createDOM() {
    if (container) return container;
    container = document.createElement('div');
    container.className = 'mobile-swiper-container swiper-container';

    const topbar = document.createElement('div');
    topbar.className = 'mobile-topbar';
    const select = document.createElement('select');
    select.id = 'mobile-face-select';
    select.addEventListener('change', (ev) => {
      const v = ev.target.value;
      const idx = faces.findIndex((ff) => ff.id === v);
      if (idx >= 0 && swiper) {
        if (typeof swiper.slideToLoop === 'function' && swiper.params && swiper.params.loop) swiper.slideToLoop(idx);
        else swiper.slideTo(idx);
      }
    });
    topbar.appendChild(select);
    container.appendChild(topbar);

    const wrapper = document.createElement('div');
    wrapper.className = 'swiper-wrapper';
    container.appendChild(wrapper);

    const pagination = document.createElement('div');
    pagination.className = 'swiper-pagination';
    container.appendChild(pagination);
    const prev = document.createElement('div'); prev.className = 'swiper-button-prev'; container.appendChild(prev);
    const next = document.createElement('div'); next.className = 'swiper-button-next'; container.appendChild(next);

    document.body.appendChild(container);
    return container;
  }

  function mountSlides() {
    if (!container) return;
    const wrapper = container.querySelector('.swiper-wrapper');
    wrapper.innerHTML = '';
    faces.forEach((f) => {
      const slide = document.createElement('div');
      slide.className = 'swiper-slide mobile-slide';
      slide.setAttribute('data-face', f.id);
      const content = document.createElement('div');
      content.className = 'slide-content mobile-slide-content';
      slide.appendChild(content);
      wrapper.appendChild(slide);
    });
    // populate select
    const sel = container.querySelector('#mobile-face-select');
    if (sel) {
      sel.innerHTML = '';
      faces.forEach((f) => { const o = document.createElement('option'); o.value = f.id; o.textContent = f.title || f.id; sel.appendChild(o); });
    }
  }

  function init(facesArr, opts = {}) {
    faces = facesArr || [];
    callbacks = opts || {};
    createDOM();
    mountSlides();

    let startIndex = Math.max(0, faces.findIndex((f) => f.id === opts.initialFaceId));
    try {
      swiper = new Swiper('.mobile-swiper-container', {
        loop: true,
        initialSlide: startIndex,
        direction: 'horizontal',
        slidesPerView: 1,
        spaceBetween: 12,
        pagination: { el: '.swiper-pagination', clickable: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        keyboard: { enabled: true },
        a11y: true,
        on: {
          init() {
            const activeSlide = this.slides && this.slides[this.activeIndex];
            const active = activeSlide && activeSlide.querySelector('.slide-content');
            // Prefer realIndex (works with looped swiper). Fall back to data-face or data-swiper-slide-index
            let face = null;
            if (typeof this.realIndex === 'number' && faces[this.realIndex]) {
              face = faces[this.realIndex];
            }
            const faceId = activeSlide && activeSlide.dataset && activeSlide.dataset.face;
            if (!face && faceId) face = faces.find(f => f.id === faceId);
            if (!face && activeSlide) {
              const si = activeSlide.getAttribute && activeSlide.getAttribute('data-swiper-slide-index');
              const siNum = si != null ? parseInt(si, 10) : NaN;
              if (!Number.isNaN(siNum) && faces[siNum]) face = faces[siNum];
            }
            // Fallback: try localStorage first (ui-current-face), then URL ?view=
            if (!face) {
              try {
                const stored = localStorage.getItem('ui-current-face');
                if (stored) {
                  const m2 = stored.match(/^face(\d+)$/i);
                  if (m2) {
                    const n2 = parseInt(m2[1], 10);
                    if (!Number.isNaN(n2) && n2 >= 1 && n2 <= faces.length) face = faces[n2 - 1];
                  } else {
                    face = faces.find((f) => f.link === stored || f.id === stored) || null;
                  }
                }
              } catch (e) {}
            }
            if (!face) {
              try {
                const params = new URLSearchParams(window.location.search);
                const v = params.get('view');
                if (v) {
                  const m = v.match(/^face(\d+)$/i);
                  if (m) {
                    const n = parseInt(m[1], 10);
                    if (!Number.isNaN(n) && n >= 1 && n <= faces.length) face = faces[n - 1];
                  } else {
                    face = faces.find((f) => f.link === v || f.id === v) || null;
                  }
                }
              } catch (e) {
                // ignore
              }
            }
            if (callbacks.mountFaceContent && face) callbacks.mountFaceContent(face, active);
            if (callbacks.prefetchNeighbors) callbacks.prefetchNeighbors(this.activeIndex);
            const sel = container.querySelector('#mobile-face-select'); if (sel && face) sel.value = face.id;
          },
          slideChange() {
            const idx = this.activeIndex;
            const activeSlide = this.slides && this.slides[idx];
            const slide = activeSlide && activeSlide.querySelector('.slide-content');
            // Determine face robustly: prefer realIndex, then data-face, then data-swiper-slide-index
            let face = null;
            if (typeof this.realIndex === 'number' && faces[this.realIndex]) {
              face = faces[this.realIndex];
            }
            const faceId = activeSlide && activeSlide.dataset && activeSlide.dataset.face;
            if (!face && faceId) face = faces.find(f=>f.id===faceId);
            if (!face && activeSlide) {
              const si = activeSlide.getAttribute && activeSlide.getAttribute('data-swiper-slide-index');
              const siNum = si != null ? parseInt(si, 10) : NaN;
              if (!Number.isNaN(siNum) && faces[siNum]) face = faces[siNum];
            }
            if (!face) {
              // try localStorage first
              try {
                const stored = localStorage.getItem('ui-current-face');
                if (stored) {
                  const m2 = stored.match(/^face(\d+)$/i);
                  if (m2) {
                    const n2 = parseInt(m2[1], 10);
                    if (!Number.isNaN(n2) && n2 >= 1 && n2 <= faces.length) face = faces[n2 - 1];
                  } else {
                    face = faces.find((f) => f.link === stored || f.id === stored) || null;
                  }
                }
              } catch (e) {}
            }
            if (!face) {
              // last-resort: check URL param
              try {
                const params = new URLSearchParams(window.location.search);
                const v = params.get('view');
                if (v) {
                  const m = v.match(/^face(\d+)$/i);
                  if (m) {
                    const n = parseInt(m[1], 10);
                    if (!Number.isNaN(n) && n >= 1 && n <= faces.length) face = faces[n - 1];
                  } else {
                    face = faces.find((f) => f.link === v || f.id === v) || null;
                  }
                }
              } catch (e) {}
            }

            if (face) {
              if (callbacks.mountFaceContent) callbacks.mountFaceContent(face, slide);
              const sel2 = container.querySelector('#mobile-face-select'); if (sel2) sel2.value = face.id;
              if (callbacks.prefetchNeighbors) callbacks.prefetchNeighbors(idx);
              if (callbacks.onNavigate) callbacks.onNavigate({ faceId: face.id, userInitiated: true });
            }
          }
        }
      });
    } catch (e) {
      console.warn('mobileManager: Swiper init failed', e);
    }
    return swiper;
  }

  function destroy() {
    try {
      if (swiper) { swiper.destroy(true, true); }
    } catch (e) {}
    swiper = null;
    try { if (container) container.remove(); } catch (e) {}
    container = null;
  }

  function slideToFace(faceId) {
    if (!swiper) return;
    const idx = faces.findIndex((f) => f.id === faceId);
    if (idx < 0) return;
    try {
      if (typeof swiper.slideToLoop === 'function' && swiper.params && swiper.params.loop) swiper.slideToLoop(idx);
      else swiper.slideTo(idx);
    } catch (e) { console.warn('mobileManager.slideToFace failed', e); }
  }

  window.mobileManager = { init, destroy, slideToFace };
})();
