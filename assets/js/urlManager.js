// ------------------------------------------------------------------------
// URL Manager
// Created: 12/15/25
// Handles URL deep linking and browser history for cube navigation
// ------------------------------------------------------------------------

const validFaces = ["front", "right", "back", "left", "top", "bottom"];
let getFacesData = null;

/**
 * Initializes the URL manager with a getter function for faces data
 * @param {Array|Function} facesOrGetter - Array of face objects or getter function
 */
function init(facesOrGetter) {
  // Support both direct array and getter function for backward compatibility
  if (typeof facesOrGetter === 'function') {
    getFacesData = facesOrGetter;
  } else {
    // Store reference to the array
    getFacesData = () => facesOrGetter;
  }
}

/**
 * Gets the face ID from a link/view value
 * @param {string} link - The link value (e.g., "face1")
 * @returns {string|null} - The face ID (e.g., "front") or null if not found
 */
function getFaceFromLink(link) {
  const facesData = getFacesData ? getFacesData() : null;
  if (!facesData || !link) return null;
  
  // Check if it's already a valid face ID
  if (validFaces.includes(link)) {
    return link;
  }
  
  // Find face by link value
  const face = facesData.find(f => f.link === link);
  return face ? face.id : null;
}

/**
 * Gets the link value for a face ID
 * @param {string} faceId - The face ID (e.g., "front")
 * @returns {string} - The link value (e.g., "face1")
 */
function getLinkFromFace(faceId) {
  const facesData = getFacesData ? getFacesData() : null;
  if (!facesData) return faceId;
  
  const face = facesData.find(f => f.id === faceId);
  return face ? face.link : faceId;
}

/**
 * Gets the face from URL query parameter
 * @returns {string|null} - The face ID from URL, or null if not present/invalid
 */
function getURLFace() {
  try {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    
    if (!view) return null;
    
    const faceId = getFaceFromLink(view);
    
    // Return 'invalid' if the link doesn't match any face
    if (!faceId) return 'invalid';
    
    return faceId;
  } catch (e) {
    console.warn('Error reading URL face:', e);
    return null;
  }
}

/**
 * Updates the URL with the current face
 * @param {string} faceId - The face ID to set in URL
 * @param {boolean} replace - If true, replaces current history entry instead of pushing new one
 */
function updateURL(faceId, replace = false) {
  if (!validFaces.includes(faceId)) {
    console.warn('Invalid face for URL update:', faceId);
    return;
  }

  try {
    const url = new URL(window.location.href);
    const link = getLinkFromFace(faceId);
    const currentView = url.searchParams.get('view');
    
    // Don't update if already showing this face
    if (currentView === link) {
      return;
    }
    
    url.searchParams.set('view', link);
    
    if (replace) {
      window.history.replaceState({ face: faceId }, '', url.toString());
    } else {
      window.history.pushState({ face: faceId }, '', url.toString());
    }
  } catch (e) {
    console.warn('Error updating URL:', e);
  }
}

/**
 * Sets up the browser history listener for back/forward navigation
 * @param {Function} onNavigate - Callback function(face) called when user navigates via browser controls
 */
function setupHistoryListener(onNavigate) {
  window.addEventListener('popstate', (event) => {
    const face = getURLFace();
    
    if (face === 'invalid') {
      // Invalid URL - notify and go to front
      if (window.notify) {
        window.notify.error('The requested URL does not exist');
      }
      onNavigate('front', { skipHistory: true });
      return;
    }
    
    const targetFace = face || 'front';
    onNavigate(targetFace, { skipHistory: true });
  });
}

// Export for use in other modules
window.urlManager = {
  init,
  getURLFace,
  updateURL,
  setupHistoryListener
};
