// -----------------------------------------------------------------------------------
// sss.js -- show screen size
//
// Version 1.0
//
// injects a small display element into the page and displays screen dimensions 
// in the upper right corner. useful for debugging style sheet and layout issues.
//
// hidden by default when page loads
//
// keyboard control: 
//
// 1 (one) key displays the element
// 0 (zero) key hides the element
//
// url parameter control:
//
// passing parameter: ss=1 in url turns on the element
// passing parameter: ss=0 in url turns off the element
//
// programmatic control:
//
// call window.sssToggle() in the browser console to toggle the display
//
// Created 12/12/25 by ken@kendawson.online
// Last updated: 12/12/25
//
// -----------------------------------------------------------------------------------

// enable URL parameters
const urlSearchParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlSearchParams.entries());

// show alert messages when passing url parameters? (default = true)
const urlAlerts = true;

// show console message on script load? (default = true)
const consoleMsg = true;

// track state of visibility in local storage
const storageKey = 'ssState';

// Simple debounce utility for resize events
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Initialize after DOM is ready
function initScreenSizeHelper() {

    // Generate a unique ID to avoid collisions
    const devSsId = 'dev_ss_' + Math.random().toString(36).slice(2, 11);
    let devSs = document.createElement('div');
    devSs.id = devSsId;
    // Apply styles inline for self-containment
    devSs.style.display = 'none';
    devSs.style.paddingTop = '1px';
    devSs.style.textAlign = 'center';
    devSs.style.opacity = '1';
    devSs.style.fontSize = '11px';
    devSs.style.fontFamily = 'sans-serif';
    devSs.style.backgroundColor = 'white';
    devSs.style.color = 'black';
    devSs.style.width = '70px';
    devSs.style.height = '18px';
    devSs.style.position = 'absolute';
    devSs.style.top = '0';
    devSs.style.right = '0';
    devSs.style.zIndex = '3000';
    document.body.appendChild(devSs);

    // safe localStorage helpers
    function getStoredState() {
        try {
            return localStorage.getItem(storageKey) === 'true';
        } catch (e) {
            return false;
        }
    }

    function setStoredState(val) {
        try {
            localStorage.setItem(storageKey, String(val));
        } catch (e) {}
    }

    // current state: true (visible) or false (hidden)
    let isVisible = getStoredState();

    function showScreenSize() {
        if (!devSs || !isVisible) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        devSs.textContent = `${w} x ${h}`;
    }

    // Debounced version for resize events
    const debouncedShowScreenSize = debounce(showScreenSize, 100);

    function applyState(visible) {
        visible = !!visible;
        isVisible = visible;
        setStoredState(visible);
        if (devSs) devSs.style.display = visible ? 'block' : 'none';
        if (visible) {
            showScreenSize();
            window.addEventListener('resize', debouncedShowScreenSize);
        } else {
            window.removeEventListener('resize', debouncedShowScreenSize);
        }
    }

    // Expose toggle function globally for programmatic control
    window.sssToggle = () => {
        applyState(!isVisible);
        return isVisible;
    };

    // Priority: if URL param provided and valid, use it (and persist)
    if ((params.ss === '1' || params.ss === 'true') || (params.ss === '0' || params.ss === 'false')) {
        const visible = params.ss === '1' || params.ss === 'true';
        applyState(visible);
        if (urlAlerts) {
          alert(visible ? 'Turned on screen dimension display' : 'Turned off screen dimension display');  
        }
    } else {
        // no URL param: initialize from storage (default hidden)
        applyState(isVisible);
    }

    // hotkeys: 1 = on, 0 = off. Only prevent default for these keys.
    document.addEventListener('keydown', (event) => {
        let w = window.innerWidth;
        let h = window.innerHeight
        if (event.key === '1') {
            event.preventDefault();
            applyState(true);
            console.log('Turned on screen dimension display');
            console.log(`Screen Size: ${w} × ${h}`);
        } else if (event.key === '0') {
            event.preventDefault();
            applyState(false);
            console.log('Turned off screen dimension display');
        }
    });

    if (consoleMsg) {
        console.log('Show Screen Size (sss.js) loaded. Press 1 or 0 to toggle, use URL params ss=1/ss=0, or call window.sssToggle().');
    }
}

document.addEventListener('DOMContentLoaded', initScreenSizeHelper);