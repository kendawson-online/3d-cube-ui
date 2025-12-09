// Content Manager
// Loads data/faces.json, injects fragments into cube face placeholders,
// delegates mobile carousel to mobileManager on small screens, and handles deep links/history centrally.

(async function () {
  const DATA_JSON = 'data/faces.json';
  let faces = [];
  let facesById = {};
  let currentFace = null;
  // Debug tracing helpers. Enabled by default if `window.DEBUGMODE` is true.
  const historyTrace = [];
  function traceEvent(evt) {
    // Honor debug/trace switches: only collect when enabled. You can turn on
    // tracing at runtime via `window.controllerDebug.enabled = true`.
    const tracingOn = (window.controllerDebug && window.controllerDebug.enabled) || window.DEBUGMODE;
    if (!tracingOn) return;
    const entry = Object.assign({ ts: Date.now() }, evt || {});
    // snapshot the entry so later mutations don't make console show empty objects
    let snapshot;
    try {
      if (typeof structuredClone === 'function') snapshot = structuredClone(entry);
      else snapshot = JSON.parse(JSON.stringify(entry));
    } catch (e) {
      snapshot = entry; // fallback
    }
    historyTrace.push(snapshot);
    if (historyTrace.length > 200) historyTrace.shift();
    if (window.controllerDebug && window.controllerDebug.enabled) console.debug('controller:trace', snapshot);
  }
  // expose a small debug helper for quick inspection in the browser console
  window.controllerDebug = window.controllerDebug || {
    enabled: !!window.DEBUGMODE,
    getTrace: () => historyTrace.slice(),
    clear: () => { historyTrace.length = 0; return true; },
    // Convenience: log the current trace to the console and return it
    log: () => { const t = historyTrace.slice(); console.table(t); return t; }
  };
  let notifyContainer = null;
  // Notification helper: creates a small banner at the top of the page
  function ensureNotifyContainer() {
    if (notifyContainer) return notifyContainer;
    notifyContainer = document.createElement('div');
    notifyContainer.id = 'notify-container';
    notifyContainer.style.position = 'fixed';
    notifyContainer.style.top = '0';
    notifyContainer.style.left = '0';
    notifyContainer.style.right = '0';
    notifyContainer.style.zIndex = '100000';
    notifyContainer.style.pointerEvents = 'none';
    document.body.appendChild(notifyContainer);
    return notifyContainer;
  }

  function showNotification(message, type = 'error', timeout = 4000) {
    const container = ensureNotifyContainer();
    const el = document.createElement('div');
    el.className = `notify-banner notify-${type}`;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');
    el.style.pointerEvents = 'auto';

    const msg = document.createElement('div');
    msg.className = 'notify-msg';
    msg.textContent = message;
    el.appendChild(msg);

    const btn = document.createElement('button');
    btn.className = 'notify-close';
    btn.setAttribute('aria-label', 'Dismiss');
    btn.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
    btn.addEventListener('click', () => {
      if (el.timeoutId) clearTimeout(el.timeoutId);
      el.classList.remove('notify-show');
      setTimeout(() => el.remove(), 250);
    });
    el.appendChild(btn);

    container.appendChild(el);
    // small entrance animation
    requestAnimationFrame(() => el.classList.add('notify-show'));
    el.timeoutId = setTimeout(() => {
      el.classList.remove('notify-show');
      setTimeout(() => el.remove(), 250);
    }, timeout);
  }

  // Utility: get query param
  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  // Update the URL's ?view= param. By default this pushes a new history entry.
  // Pass { replace: true } to replace the current history entry instead.
  function currentViewParam() {
    try {
      return new URL(window.location.href).searchParams.get('view');
    } catch (e) {
      return null;
    }
  }

  // Centralized history manager to encapsulate push/replace/popstate logic
  function createHistoryManager({ debug = !!window.DEBUGMODE } = {}) {
    let onNavigateCb = null;
    let suppress = false;
    let expectedAfterPop = null;
    const browserHistory = window.history;

    function trace(kind, data) { traceEvent(Object.assign({ kind }, data || {})); }

    function handlePop(ev) {
      const view = currentViewParam();
      trace('popstate', { state: ev.state, view });
      suppress = true;
      expectedAfterPop = view;
      if (onNavigateCb) onNavigateCb({ view: view, source: 'popstate' });
      // safety clear in case something fails to fire cube:facechange
      setTimeout(() => { suppress = false; expectedAfterPop = null; }, 1500);
    }

    function init(defaultView) {
      // Canonicalize base URL to include ?view=defaultView via replaceState
      try {
        const url = new URL(window.location.href);
        const q = url.searchParams.get('view');
        if (!q && defaultView) {
          url.searchParams.set('view', defaultView);
          if (browserHistory && browserHistory.replaceState) {
            browserHistory.replaceState({ view: defaultView }, '', url.toString());
          }
          trace('replace', { url: url.toString(), link: defaultView });
        }
      } catch (e) {
        // ignore
      }
      window.addEventListener('popstate', handlePop);
    }

    function push(view, { replace = false, userInitiated = false } = {}) {
      try {
        const url = new URL(window.location.href);
        const current = url.searchParams.get('view');
        // If suppressed because of popstate and the expected view matches,
        // skip pushing to avoid creating duplicates.
        if (suppress && expectedAfterPop === view) {
          trace('push:skipped:suppressed', { url: url.toString(), link: view });
          // clear suppression if it was matching
          suppress = false;
          expectedAfterPop = null;
          return false;
        }
        if (!replace && current === view) {
          trace('push:skipped:duplicate', { url: url.toString(), link: view });
          return false;
        }
        url.searchParams.set('view', view);
        if (replace) {
          if (browserHistory && browserHistory.replaceState) {
            browserHistory.replaceState({ view }, '', url.toString());
          }
          trace('replace', { url: url.toString(), link: view, userInitiated });
        } else {
          if (browserHistory && browserHistory.pushState) {
            browserHistory.pushState({ view }, '', url.toString());
          }
          trace('push', { url: url.toString(), link: view, userInitiated });
        }
        return true;
      } catch (e) {
        console.warn('historyManager.push failed', e);
        return false;
      }
    }

    function markUser() {
      trace('markUser', {});
      // This is a hint; concrete pushes should carry userInitiated flag.
    }

    function onNavigate(cb) { onNavigateCb = cb; }

    function dispose() { window.removeEventListener('popstate', handlePop); }

    return { init, push, markUser, onNavigate, dispose };
  }

  const navHistory = createHistoryManager({ debug: !!window.DEBUGMODE });

  async function fetchJSON(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Failed to load ' + path);
    return r.json();
  }

  async function fetchText(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Failed to load ' + path);
    return r.text();
  }

  // Parse HTML content. If file is a full document, extract body.innerHTML.
  function extractFragment(htmlText) {
    try {
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');
      if (doc && doc.body) return doc.body.innerHTML;
    } catch (e) {
      // fallback to raw text
    }
    return htmlText;
  }

  async function loadHtmlInto(container, src) {
    try {
      const text = await fetchText(src);
      container.innerHTML = extractFragment(text);
    } catch (e) {
      console.error('loadHtmlInto', src, e);
      container.innerHTML = '<p>Error loading content.</p>';
    }
  }

  function createIframe(container, src, title) {
    // Avoid creating duplicate iframes
    if (container.querySelector('iframe')) return;
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.loading = 'lazy';
    iframe.title = title || '';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    container.appendChild(iframe);
  }

  // Load content for a face into a cube placeholder (or slide placeholder)
  async function mountFaceContent(face, container, options = {}) {
    if (!container) return;
    // if content already present, skip (idempotent)
    if (container.dataset.loaded === 'true') return;

    const srcPath = face.src.startsWith('data/') ? face.src : 'data/' + face.src;
    if (face.type === 'iframe') {
      // for iframe, create iframe element
      createIframe(container, srcPath, face.title);
      container.dataset.loaded = 'true';
    } else {
      // html fragment or full doc -> fetch and inject
      await loadHtmlInto(container, srcPath);
      container.dataset.loaded = 'true';
    }
  }

  // Prefetch neighbors (for carousel)
  function prefetchNeighbors(idx) {
    if (!faces || faces.length === 0) return;
    const wrap = (n) => { const len = faces.length; return ((n % len) + len) % len; };
    const containerEl = document.querySelector('.mobile-swiper-container');
    [idx - 1, idx + 1].forEach((i) => {
      const wi = wrap(i);
      const f = faces[wi];
      if (!f) return;
      const slide = containerEl && containerEl.querySelector(`.swiper-slide[data-face="${f.id}"] .slide-content`);
      if (slide && !slide.dataset.loaded) mountFaceContent(f, slide);
    });
  }

  // Initialize carousel DOM and Swiper
  // Delegate mobile/swiper responsibilities to mobileManager when available
  function initSwiper(initialFaceId) {
    if (window.mobileManager && mobileManager.init) {
      mobileManager.init(faces, {
        initialFaceId,
        mountFaceContent,
        prefetchNeighbors,
        onNavigate: ({ faceId, userInitiated = false } = {}) => {
          currentFace = faceId;
          localStorage.setItem('ui-current-face', currentFace);
          if (navHistory && navHistory.push) navHistory.push(faceId, { userInitiated });
        }
      });
      return true;
    }
    return null;
  }

  function destroySwiper() {
    if (window.mobileManager && mobileManager.destroy) mobileManager.destroy();
  }

  // Show/hide scene
  function showScene() {
    const scene = document.getElementById('scene');
    if (scene) scene.style.display = '';
  }
  function hideScene() {
    const scene = document.getElementById('scene');
    if (scene) scene.style.display = 'none';
  }

  // MatchMedia handler
  function handleBreakpoint(m) {
    if (m.matches) {
      // small screen -> init swiper
      hideScene();
      // hide desktop menu on small screens
      const menu = document.querySelector('.menu');
      if (menu) menu.style.display = 'none';
      initSwiper(currentFace);
    } else {
      // large -> destroy swiper and show cube
      destroySwiper();
      showScene();
      // restore desktop menu
      const menu = document.querySelector('.menu');
      if (menu) menu.style.display = '';
      // ensure cube shows currentFace
      if (window.cubeGoToFace && currentFace) window.cubeGoToFace(currentFace);
    }
  }

  // Medium-screen menu toggle (750 - 1149px)
  let mediumMq = null;
  let menuToggleBtn = null;

  function applyMenuCollapsed(collapsed) {
    const menu = document.querySelector('.menu');
    if (!menu) return;
    if (collapsed) {
      menu.classList.add('menu-collapsed');
      menu.classList.remove('menu-expanded');
      document.body.classList.add('menu-collapsed');
    } else {
      menu.classList.remove('menu-collapsed');
      menu.classList.add('menu-expanded');
      document.body.classList.remove('menu-collapsed');
    }
    // persist
    localStorage.setItem('ui-menu-collapsed', collapsed ? '1' : '0');
    // update collapse toggle icon if present
    const t = document.getElementById('menu-collapse-toggle');
    if (t) {
      // When expanded show "box-arrow-in-left" (to indicate collapse),
      // when collapsed show "box-arrow-in-right" (to indicate expand)
      t.innerHTML = collapsed ? '<i class="bi bi-box-arrow-in-right" aria-hidden="true"></i>' : '<i class="bi bi-box-arrow-in-left" aria-hidden="true"></i>';
      t.setAttribute('aria-expanded', String(!collapsed));
    }
  }

  function createMenuToggle() {
    // We don't create a separate floating toggle here — the markup includes
    // a footer button inside the `.menu` with id `menu-collapse-toggle`.
    // Ensure it exists and wire its click handler.
    const t = document.getElementById('menu-collapse-toggle');
    if (!t) return;
    menuToggleBtn = t;
    menuToggleBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      const collapsed = localStorage.getItem('ui-menu-collapsed') === '1';
      applyMenuCollapsed(!collapsed);
    });
  }

  // Listen for direct user clicks on face buttons so we can mark the
  // following navigation as user-initiated. We use capture phase so we see
  // the event before other handlers (like the cube renderer) process it.
  document.addEventListener('click', (ev) => {
    const btn = ev.target && (ev.target.closest && ev.target.closest('.menu .btn')) || null;
    if (btn) {
      const face = btn.dataset && btn.dataset.face;
      if (face) {
        // signal the history manager that a user interaction occurred
        if (navHistory && navHistory.markUser) navHistory.markUser();
      }
    }
  }, true);

  // Respond to cube face changes (from the cube renderer)
  window.addEventListener('cube:facechange', (ev) => {
    const face = ev.detail && ev.detail.face;
    if (!face) return;
    currentFace = face;
    localStorage.setItem('ui-current-face', face);
    const f = facesById[face];
    const rotation = ev.detail && ev.detail.rotation;
    const explicitUser = ev.detail && ev.detail.userInitiated;
    traceEvent({ kind: 'cube:facechange', face, rotation, userInitiated: !!explicitUser });

    // Use the centralized history manager to push only when appropriate.
    if (f && navHistory && navHistory.push) {
      // Prefer explicit userInitiated info from the renderer, fall back to
      // the click-capture hint (history.markUser() was called on click).
      navHistory.push(f.link || f.id, { userInitiated: !!explicitUser });
    }
  });

  // Initialize controller
  async function init() {
    traceEvent({ kind: 'init:start', href: window.location.href });
    try {
      faces = await fetchJSON(DATA_JSON);
      traceEvent({ kind: 'init:facesLoaded', count: faces.length });
    } catch (e) {
      console.error('Failed to load faces.json', e);
      return;
    }
    faces.forEach((f) => (facesById[f.id] = f));

    // Determine initial face from ?view=. If no view param, default to the Front Face.
    // We intentionally treat the base URL as Front Face so removing ?view will go to front.
    const view = getQueryParam('view');
    if (view) {
      const found = faces.find((f) => f.link === view || f.id === view);
      if (found) {
        currentFace = found.id;
      } else {
        // invalid view -> notify and fallback to front face below
        showNotification('The requested URL does not exist. Loading Front Face.', 'error', 4000);
      }
    }
    if (!currentFace) {
      currentFace = faces[0].id;
      localStorage.setItem('ui-current-face', currentFace);
    }

    // Initialize history manager (canonicalizes URL when needed)
    if (navHistory && navHistory.init) {
      const canonical = (facesById[currentFace] && (facesById[currentFace].link || facesById[currentFace].id)) || currentFace;
      navHistory.init(canonical);
    }

    // Inject HTML fragments for cube placeholders (load HTML types eagerly, leave iframe types to lazy load)
    faces.forEach((f) => {
      const container = document.getElementById(`face-${f.id}-content`);
      if (!container) return;
      if (f.type === 'html') {
        // load into cube placeholder
        mountFaceContent(f, container);
      } else if (f.type === 'iframe') {
        // only load iframe for currently selected face to avoid heavy loads
        if (f.id === currentFace) {
          mountFaceContent(f, container);
        }
      }
    });

    // Setup matchMedia for mobile
    const mq = window.matchMedia('(max-width: 749px)');
    mq.addEventListener('change', () => handleBreakpoint(mq));
    // call initially
    handleBreakpoint(mq);

    // Setup medium breakpoint for menu collapse toggle
    createMenuToggle();
    mediumMq = window.matchMedia('(min-width: 750px) and (max-width: 1149px)');
    const AUTO_COLLAPSE_WIDTH = 920; // when no persisted pref, collapse under this width
    const mediumHandler = () => {
      if (mediumMq.matches) {
        // show toggle
        if (menuToggleBtn) menuToggleBtn.style.display = '';
        const persisted = localStorage.getItem('ui-menu-collapsed');
        let collapsed;
        if (persisted === null) {
          // no user preference -> auto-collapse when window is narrow within medium range
          collapsed = window.innerWidth < AUTO_COLLAPSE_WIDTH;
        } else {
          collapsed = persisted === '1';
        }
        applyMenuCollapsed(collapsed);
      } else {
        // hide toggle and ensure menu shown
        if (menuToggleBtn) menuToggleBtn.style.display = 'none';
        applyMenuCollapsed(false);
      }
    };
    mediumMq.addEventListener('change', mediumHandler);
    mediumHandler();

    // If we started in small mode and swiper wasn't initialized yet, ensure currentFace synced
    localStorage.setItem('ui-current-face', currentFace);
    // Update UI (set active buttons via the cube renderer's exposed function) by navigating cube
    if (window.cubeGoToFace && !mq.matches) {
      window.cubeGoToFace(currentFace);
    }

    // Wire history manager navigation callback so popstate-driven navigations
    // are handled centrally.
    if (navHistory && navHistory.onNavigate) {
      navHistory.onNavigate(({ view }) => {
        // Translate view -> face id (support face#/id aliases)
        let found = null;
        if (!view) {
          found = faces[0];
        } else {
          found = faces.find((f) => f.link === view || f.id === view) || null;
        }
        if (!found) {
          showNotification('The requested URL does not exist. Loading Front Face.', 'error', 4000);
          found = faces[0];
        }
        currentFace = found.id;
        localStorage.setItem('ui-current-face', currentFace);
        if (mq.matches && window.mobileManager && mobileManager.slideToFace) {
          mobileManager.slideToFace(currentFace);
        } else if (window.cubeGoToFace) {
          // programmatic: mark as non-user-initiated
          window.cubeGoToFace(currentFace, { userInitiated: false });
        }
      });
    }

  }

  // kick off
  document.addEventListener('DOMContentLoaded', init);
})();
