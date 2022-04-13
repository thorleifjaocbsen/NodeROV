/************************
 * Scaling
 ************************/

const containerEl = document.getElementById('container');
const videoEl = document.getElementById('video');
const containerMaxWidth = containerEl.offsetWidth;
const containerMaxHeight = containerEl.offsetHeight;
const videoMaxWidth = videoEl.offsetWidth;
const videoMaxHeight = videoEl.offsetHeight;
function resize() {
    const sWidth = window.innerWidth;
    const sHeight = window.innerHeight;
    containerEl.style.zoom = Math.min(sWidth / containerMaxWidth, sHeight / containerMaxHeight);

    // Get canvas inside of video element
    const canvasEl = videoEl.getElementsByTagName('canvas')[0];

    if (canvasEl) {
        canvasEl.style.zoom = Math.min(videoMaxWidth / canvasEl.width, videoMaxHeight / canvasEl.height);
    }
};

resize();
window.addEventListener("resize", resize);


// Fix canvas width/height.
const allCanvas = document.getElementsByTagName("canvas");
for (let i = 0; i < allCanvas.length; i++) {
    allCanvas[i].height = allCanvas[i].offsetHeight;
    allCanvas[i].width = allCanvas[i].offsetWidth;
}