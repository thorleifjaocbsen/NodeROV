const Decoder = require('./broadway/Decoder.js');
const YUVCanvas = require('./broadway/YUVCanvas.js');
const Player = require('./broadway/Player.js');
const EventEmitter = require('./EventEmitter.js');

module.exports = class Video extends EventEmitter {

    constructor(videoElement) {
        super();

        this.player = new Player({});
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
            frame = new Uint8Array(frame);
            this.player.decode(frame);
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
        const zoom = Math.min(videoMaxWidth / width, videoMaxHeight / height);
    
        this.canvas.style.zoom = zoom;
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