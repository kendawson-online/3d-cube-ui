export function debounce(fn, wait = 100) {
  let timer = null;
  return function debounced(...args) {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
}
