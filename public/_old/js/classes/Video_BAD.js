import Socket from './Socket.js';
import EventEmitter from './EventEmitter.js';

export default class Video extends EventEmitter {

    constructor(videoElement) {
        super();

        this.ws = new Socket();
        this.ws.onopen = this.onopen.bind(this);
        this.ws.onmessage = this.onmessage.bind(this);
        this.ws.onerror = this.onerror.bind(this);
        this.ws.onclose = this.onclose.bind(this);

        this.skipFrames = false;

        this.canvas = document.createElement('canvas');
        this.canvas.width = 1280;
        this.canvas.height = 720;
        this.canvas.style.width = 1280;
        this.canvas.style.height = 720;
        this.canvas.style.position = "absolute";
        this.ctx = this.canvas.getContext("2d");
        this.videoElement = videoElement;
        videoElement.appendChild(this.canvas);


        this.decoder = new VideoDecoder({
            output: (frame) => {
                this.canvas.width = frame.codedWidth;
                this.canvas.height = frame.codedHeight;
                this.ctx.drawImage(frame, 0, 0);
                frame.close();
            },
            error: (err) => { console.warn(err); }
        });

        const decoderConfig = {
            // "codec": 'avc1.4d401e',
            // "codec": 'avc1.4d002a',
            //"codec": 'avc1.4d0028',
             "codec": "avc1.420034",
            "optimizeForLatency": true
        }

        this.decoder.configure(decoderConfig);


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
                    super.emit('recordStateChange', this.recordState);
                    break;
                case 'stopped':
                    console.log("Somehow the software stopped!");
                    break;
                case 'connected':
                    break;
                default:
                    console.log(`Unparsed data from video recorder: ${e.data}`);
                    return false;
            }


        };
        if (this.skipFrames) { return; }
        try {
            const frame = new Uint8Array(e.data);
            const header = frame[4]; // Get 5th byte frame header.
            const forbiddenZeroBit = header >> 7  // Bit 1
            const nalRefIdc = ((header & 0b01100000) >> 5) // Bit 2,3
            const nalUnitType = header & 0b00011111; // Bit 4,5,6,7,8
            const isKeyFrame = [5,6,7,8,10,11].includes(nalUnitType);


            if (this.decoder.state == "configured" && frame.length > 0) {
                let chunk = new EncodedVideoChunk({
                    type: isKeyFrame ? 'key' : 'delta',
                    data: frame,
                    timestamp: Date.now(),
                    duration: 16
                })
                this.decoder.decode(chunk);
            }

        } catch (e) {
            console.log(e)
        }

    }

    onerror(e) { }

    onclose() {
        // Reconnect every 5 seconds
        setTimeout(() => this.connect(this.ws.ip, this.ws.port), 5000);
    }

    resizeToFit() {

        let width = this.canvas.offsetWidth
        let height = this.canvas.offsetHeight

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