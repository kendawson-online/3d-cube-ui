// ------------------------------------------------------------------------
// Notification System
// Created: 12/15/25
// Displays non-blocking toast notifications at the top of the screen
// ------------------------------------------------------------------------

/**
 * Creates and displays a notification banner
 * @param {string} message - The message to display
 * @param {string} type - Notification type: 'info', 'success', 'error', 'warning'
 * @param {number} timeout - Auto-dismiss timeout in ms (default: 4000)
 */
function showNotification(message, type = 'info', timeout = 4000) {
  const container = document.getElementById('notify-container');
  if (!container) {
    console.warn('Notification container not found');
    return;
  }

  // Clone the notification banner template
  const template = container.querySelector('.notify-banner');
  if (!template) {
    console.warn('Notification banner template not found');
    return;
  }

  const banner = template.cloneNode(true);
  
  // Add type-specific class
  banner.classList.add(`notify-${type}`);
  
  // Set message text
  const msgEl = banner.querySelector('.notify-msg');
  if (msgEl) {
    msgEl.textContent = message;
  }

  // Setup close button
  const closeBtn = banner.querySelector('.notify-close');
  const remove = () => {
    banner.classList.remove('notify-show');
    setTimeout(() => {
      banner.remove();
      
      // Hide container if no notifications remain
      const remainingBanners = container.querySelectorAll('.notify-banner.notify-show');
      if (remainingBanners.length === 0) {
        container.style.display = 'none';
      }
    }, 250);
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', remove);
  }

  // Make container visible
  container.style.display = 'flex';

  // Append banner to container
  container.appendChild(banner);

  // Trigger animation
  requestAnimationFrame(() => {
    banner.classList.add('notify-show');
  });

  // Auto-dismiss after timeout
  if (timeout > 0) {
    setTimeout(remove, timeout);
  }
}

/**
 * Notification API
 */
const notify = {
  show: showNotification,
  success: (message, timeout = 4000) => showNotification(message, 'success', timeout),
  error: (message, timeout = 5000) => showNotification(message, 'error', timeout),
  warning: (message, timeout = 4500) => showNotification(message, 'warning', timeout),
  info: (message, timeout = 4000) => showNotification(message, 'info', timeout)
};

// Export for use in other modules
window.notify = notify;
