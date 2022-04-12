/************************
 * Scaling
 ************************/

const container = document.getElementById('container');
const maxWidth = container.offsetWidth;
const maxHeight = container.offsetHeight;

function resize() {
    const sWidth = window.innerWidth;
    const sHeight = window.innerHeight;
    const scale = Math.min(sWidth / maxWidth, sHeight / maxHeight);
    container.style.zoom = scale;
};

resize();
window.addEventListener("resize", resize);


// Fix canvas width/height.
const allCanvas = document.getElementsByTagName("canvas");
for (let i = 0; i < allCanvas.length; i++) {
    allCanvas[i].height = allCanvas[i].offsetHeight;
    allCanvas[i].width = allCanvas[i].offsetWidth;
}