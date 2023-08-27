
const EventEmitter = require('events');
const Splitter = require('stream-split');
const spawn = require('child_process').spawn;
const exec = require('child_process').exec;
const fs = require('fs');
const NALseparator = Buffer.from([0, 0, 0, 1]);//NAL break
const RecordState = Object.freeze({ STOPPED: "stopped", WAITINGIDR: "waitingidr", RECORDING: "recording" });

module.exports = class LibCameraVideo extends EventEmitter {

    #process;
    #pipe;
    #startFrames = [];
    #recordState = RecordState.STOPPED;
    #recordWriteStream;

    constructor() {
        super();
    }

    start(width, height, fps) {
        console.log("Starting Video");

        let args = [];
        args.push('-t', '0');
        args.push('--awb', 'auto');
        // args.push('--denoise', 'cdn_fast');
        args.push('--bitrate', 1*8*1024*1024); // Megabytes first.. 1 MB now
        args.push('--brightness', '0'); // The value -1.0 produces an (almost) black image, the value 1.0 produces an almost entirely white image and the value 0.0 produces standard image brightness
        args.push('--saturation', '1.1');
        args.push('--sharpness', '2.0');
        args.push('--contrast', '1');
        //args.push('--shutter', 1000*(1000/fps)); // Longest shutter we can based on fps.. 
        args.push('--gain', '4');
        args.push('--exposure', 'normal');
        args.push('--metering', 'centre'); // centre, spot, average, custom
        args.push('--rotation', '180'); // Camera rotation
        args.push('-o', '-'); // Output to process
        args.push('--width', width);
        args.push('--height', height);
        args.push('--framerate', fps);
        args.push('--inline',) // forces the stream header information to be included with every I (intra) frame
        args.push('-n'); // No preview
        args.push('--profile', 'baseline'); // only thing broadway can decode

        this.#process = spawn('libcamera-vid', args);

        this.#process.on("error", (error) => {
            if (error.code == "ENOENT") {
                this.emit("error", "Camera Software not found");
            } else {
                this.emit("error", "Camera Software error: " + error.code);
            }
        });

        this.#process.on("close", (code, signal) => {
            this.emit("close", "Camera Software closed");

            // Stop recording if it is running
            this.stopRecording()

            // Reset variables
            this.cameraSoftware = null;
            this.pipe = null;

            // Try to restart in 5 seconds
            setTimeout(() => { this.start(width, height, fps) }, 5000);
            this.emit("error", "Restarting video in 5 seconds");
        });


        this.#pipe = this.#process.stdout.pipe(new Splitter(NALseparator));

        this.#pipe.on("data", (data) => {
            const frame = Buffer.concat([NALseparator, data]);
    
            // If recording
            if (this.#recordState == RecordState.RECORDING) {
                this.#recordWriteStream.write(frame);
            }
       
            // Save start frames for later initialization for new clients
            if (frame[4] == 0x27) { this.#startFrames[0] = frame; }
            else if (frame[4] == 0x28) { this.#startFrames[1] = frame; }
            else if (frame[4] == 0x25) {
                this.#startFrames[2] = frame;
    
                if (this.#recordState == RecordState.WAITINGIDR) {
                    // Send SPS and PPS IDR frames
                    this.#startFrames.forEach((frame) => { this.#recordWriteStream.write(frame); });
                    this.setRecordState(RecordState.RECORDING);

                }
            }

            this.emit("frame", frame);
        });

        this.emit("start");
    }

    getInitFrames() {
        return this.#startFrames;
    }

    startRecording(filename) {
        if (this.#recordState != RecordState.STOPPED) { console.log("Video Streamer Service : Already recording"); return; }
        if (!this.#pipe) { console.log("Video Streamer Service : Could not start recording, camera software pipe is not set"); return; }

        this.#recordWriteStream = fs.createWriteStream('./recordings/' + filename, { flags: 'a' });
        
        this.#recordWriteStream.on('error', (error) => {
            error = `Error while recording: ${error.code}`
            if (error.code == "ENOSPC") { error = "Recording failed, no disk space left."; }
            this.emit("error", error);
        });
            
        this.setRecordState(RecordState.WAITINGIDR);
        return true;
    }

    stopRecording() {
        if (this.#recordWriteStream) { 
            this.#recordWriteStream.close(); 
            this.#recordWriteStream = null;
            this.setRecordState(RecordState.STOPPED);
        }
        return true;
    }

    setRecordState(state) {
        this.#recordState = state;
        this.emit("recordStateChange", state);
    }

    isRecording() {
        this.setRecordState(this.#recordState);
        return this.#recordState == RecordState.RECORDING;
    }
}