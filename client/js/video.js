import Socket from './socket.js';
import './broadway/decoder.js';
import './broadway/yuvcanvas.js';
import './broadway/player.js';
import EventEmitter from './EventEmitter.js';

export default class Video extends EventEmitter {

    constructor(videoElement) {
        super();

        this.ws = new Socket();
        this.ws.onopen = this.onopen.bind(this);
        this.ws.onmessage = this.onmessage.bind(this);
        this.ws.onerror = this.onerror.bind(this);
        this.ws.onclose = this.onclose.bind(this);

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

    connect(ip, port) {

        this.ws.connect(ip, port);
    }

    onopen() {

        this.updateRecordState();
    }

    onmessage(e) {

        if (typeof e.data == "string") {
            switch (e.data.split(' ')[0].toLowerCase()) {
                case 'recordstate':
                    this.recordState = e.data.split(' ')[1].toLowerCase();
                    this.emit('recordStateChange', this.recordState);
                    break;
                case 'stopped':
                    console.log("Somehow the software stopped!");
                    break;
                default:
                    console.log(e.data, Date.now());
                    return false;
            }

            
        };
        if (this.skipFrames) { return; }
        try {
            const frame = new Uint8Array(e.data);
            this.player.decode(frame);
        } catch (e) {
            console.log(e)
        }

    }

    onerror() {}
    onclose() {}

    resizeToFit() {
        
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