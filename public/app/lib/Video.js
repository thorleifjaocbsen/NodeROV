const Decoder = require('./broadway/Decoder.js');
const YUVCanvas = require('./broadway/YUVCanvas.js');
const Player = require('./broadway/Player.js');
const EventEmitter = require('./EventEmitter.js');

module.exports = class Video extends EventEmitter {

    constructor(videoElement) {
        super();

        this.player = new Player({
            useWorker: false,
            webgl: true
        });
        this.canvas = this.player.canvas;
        this.skipFrames = false;

        this.videoElement = videoElement;
        videoElement.appendChild(this.canvas);

        this.recordState = null;

        new ResizeObserver(() => this.resizeToFit()).observe(this.canvas)
        new ResizeObserver(() => this.resizeToFit()).observe(this.videoElement)
        this.resizeToFit();
    }

 
    decodeFrame(frame) {
        if (this.skipFrames) { return; }
        try {
            this.skipFrames = true;
            frame = new Uint8Array(frame);
            this.player.decode(frame);
            this.skipFrames = false;
        } catch (e) {
            console.log(e)
        }

    }

    resizeToFit() {

        // This makes sure the canvas is 100% in the video element without losing aspect ratio
        
        let width = this.player.canvas.offsetWidth
        let height = this.player.canvas.offsetHeight
    
        const videoMaxWidth = this.videoElement.clientWidth; // Size excluding border
        const videoMaxHeight = this.videoElement.clientHeight; // Size excluding border

        // Min will make no video dissapear, max will fill
        const zoom = Math.max(videoMaxWidth / width, videoMaxHeight / height);

        // lets center this aswell
        const left = Math.abs(videoMaxWidth - width) / 2
        const top = Math.abs(videoMaxHeight - height) / 2

        this.canvas.style.zoom = zoom;
        this.canvas.style.left = left;
        this.canvas.style.top = top;

        console.log(zoom,left,top);
    }

    startRecord() {
        return this.ws.send('record start');
    }

    stopRecord() {
        return this.ws.send('record stop');
    }

    updateRecordState() {
        return this.ws.send('record state');
    }
}