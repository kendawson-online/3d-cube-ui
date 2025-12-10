export function createHistoryManager({ debug = false } = {}) {
  let onNavigateCb = null;
  let suppress = false;
  let expectedAfterPop = null;
  const browserHistory = window.history;

  function log(kind, payload = {}) {
    if (!debug) return;
    console.debug('[history]', kind, payload);
  }

  function currentViewParam() {
    try {
      return new URL(window.location.href).searchParams.get('view');
    } catch (e) {
      return null;
    }
  }

  function handlePop(event) {
    const view = currentViewParam();
    suppress = true;
    expectedAfterPop = view;
    if (onNavigateCb) onNavigateCb({ view, source: 'popstate', state: event.state || null });
    window.setTimeout(() => {
      suppress = false;
      expectedAfterPop = null;
    }, 500);
  }

  function init(defaultView) {
    try {
      const url = new URL(window.location.href);
      const existing = url.searchParams.get('view');
      if (!existing && defaultView) {
        url.searchParams.set('view', defaultView);
        browserHistory.replaceState({ view: defaultView }, '', url.toString());
        log('replace:init', { url: url.toString() });
      }
    } catch (e) {}
    window.addEventListener('popstate', handlePop);
  }

  function push(view, { replace = false, userInitiated = false } = {}) {
    if (!view) return false;
    try {
      const url = new URL(window.location.href);
      const current = url.searchParams.get('view');
      if (suppress && expectedAfterPop === view) {
        suppress = false;
        expectedAfterPop = null;
        return false;
      }
      if (!replace && current === view) {
        return false;
      }
      url.searchParams.set('view', view);
      if (replace) {
        browserHistory.replaceState({ view }, '', url.toString());
        log('replace', { view, userInitiated });
      } else {
        browserHistory.pushState({ view }, '', url.toString());
        log('push', { view, userInitiated });
      }
      return true;
    } catch (e) {
      console.warn('history.push failed', e);
      return false;
    }
  }

  function onNavigate(cb) {
    onNavigateCb = cb;
  }

  function dispose() {
    window.removeEventListener('popstate', handlePop);
    onNavigateCb = null;
  }

  function getView() {
    return currentViewParam();
  }

  return { init, push, onNavigate, dispose, getView };
}
