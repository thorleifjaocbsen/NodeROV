// * Jortenmilo's Class "Remodified"! ;D * //

class GameLoop {

    constructor(fps, tps, main) {
        this.fps = fps;
        this.tps = tps;
        this.main = main;
        this.fpsInterval = false;
        this.tpsInterval = false;
        this.then = performance.now();
        this.internalTimer = performance.now();
        this.fpsCount = 0;
        this.count = 0;
    }

    start() {
        //this.fpsInterval = setInterval(this.main.render, 1000 / this.fps);
        this.tpsInterval = setInterval(this.main.tick, 1000 / this.tps);
        this.renderLoop();
    }

    renderLoop() {
        window.requestAnimationFrame(this.renderLoop);
        let now = performance.now();
        let elapsed = now - this.then;
        if (elapsed >= 1000 / this.fps) {
            this.count++;
            if (now - this.internalTimer >= 1000) {
                this.fpsCount = this.count;
                this.count = 0;
                this.internalTimer = now - ((now - this.internalTimer) % 1000 / this.fps);
            }
            this.then = now - (elapsed % 1000 / this.fps);
            this.main.render();
        }
    }
}