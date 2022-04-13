/************************
 * Scaling
 ************************/

const containerEl = document.getElementById('container');
const containerMaxWidth = containerEl.offsetWidth;
const containerMaxHeight = containerEl.offsetHeight;

function resize() {
    const sWidth = window.innerWidth;
    const sHeight = window.innerHeight;
    containerEl.style.zoom = Math.min(sWidth / containerMaxWidth, sHeight / containerMaxHeight);
};

resize();

window.addEventListener("resize", resize);


// Fix canvas width/height.
const allCanvas = document.getElementsByTagName("canvas");
for (let i = 0; i < allCanvas.length; i++) {
    allCanvas[i].height = allCanvas[i].offsetHeight;
    allCanvas[i].width = allCanvas[i].offsetWidth;
}