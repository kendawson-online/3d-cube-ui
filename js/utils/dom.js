export function cloneTemplate(id) {
  const tpl = document.getElementById(id);
  if (!tpl) {
    throw new Error(`Template ${id} not found`);
  }
  return tpl.content.firstElementChild.cloneNode(true);
}

export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

export function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}
