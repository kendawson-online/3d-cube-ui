// DEV USE: show screen size dimensions

const ss = document.getElementById('ss');

function showScreenSize() {
    if (ss) {
        var w = window.innerWidth;
        var h = window.innerHeight;
        ss.textContent = `${w} x ${h}`;
    }     
}

// show/hide display via hot keys (0 & 1)
document.addEventListener('keydown', (event) => {
    event.preventDefault();
    if (event.key === '1') {
        ss.style.display = 'block';
        console.log('Turned on screen dimension display');
    } else if (event.key === '0') {
        ss.style.display = 'none';
        console.log('Turned off screen dimension display');
    } else {
        return;
    }
});

// call function on load
showScreenSize();

// call function on resize
window.addEventListener("resize", showScreenSize);