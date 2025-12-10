import { cloneTemplate } from '../utils/dom.js';

export function createNotifier({ containerId = 'notify-container' } = {}) {
  const container = document.getElementById(containerId);

  function show(message, type = 'info', timeout = 4000) {
    if (!container) return;
    const banner = cloneTemplate('tpl-notification');
    banner.classList.add(`notify-${type}`);
    const msg = banner.querySelector('.notify-msg');
    if (msg) msg.textContent = message;
    const btn = banner.querySelector('.notify-close');
    const remove = () => {
      banner.classList.remove('notify-show');
      window.setTimeout(() => banner.remove(), 250);
    };
    if (btn) btn.addEventListener('click', remove);
    container.appendChild(banner);
    window.requestAnimationFrame(() => banner.classList.add('notify-show'));
    window.setTimeout(remove, timeout);
  }

  return {
    show,
    success: (msg, timeout) => show(msg, 'success', timeout),
    error: (msg, timeout) => show(msg, 'error', timeout),
    warning: (msg, timeout) => show(msg, 'warning', timeout)
  };
}
