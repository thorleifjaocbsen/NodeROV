
// var config          = { width : 1296, height: 730, fps : 15, port : 8282 }
// // Free memory
// exec('sudo /sbin/sysctl vm.drop_caches=3');

const config = require('./configuration.json').video

const spawn = require('child_process').spawn;
const Splitter = require('stream-split');
const fs = require('fs');
const exec = require('child_process').exec;
const WebSocketServer = require("ws").WebSocketServer;
const HttpsServer = require('https').createServer;
const NALseparator = Buffer.from([0, 0, 0, 1]);//NAL break

/* Start server */
const cert = fs.readFileSync("assets/server.cert");
const key = fs.readFileSync("assets/server.key");
server = HttpsServer({ cert, key });
wss = new WebSocketServer({ perMessageDeflate: false, server });
server.listen(config.port, config.ip);
console.log("Video Streamer Service : Listning");

/* On connection */
wss.on('connection', (client) => {

  console.log(`Video Streamer Service : Incomming connection from ${client._socket.remoteAddress}`);
  client.send("connected");

  // Send start frames for video initialization
  startFrames.forEach((frame) => {
    client.send(frame);
  });

  client.on('message', (message) => {
    message = message.toString().trim();

    console.log(`Video Streamer Service : Incomming data from ${client._socket.remoteAddress}: ${message}`);
    switch (message) {
      case "record start":
        startRecording();
        break;
      case "record stop":
        stopRecording();
        break;
      case "record state":
        client.send(`recordState ${recordState}`);
        break;
    }
  });

  client.on('close', function () {
    console.log(`Video Streamer Service : Client Closed Connection (${client._socket.remoteAddress})`);
  });

});

wss.broadcast = (package) => {
  const binary = typeof package != "string";

  wss.clients.forEach((client) => {
    if (client.bufferedAmount > 0 && binary) {
      console.log(`Video Streamer Service : Dropping frame, TCP socket still sending on client ${client._socket.remoteAddress}`);
      return;
    }

    client.send(package, { binary });
  });
}

let cameraSoftware = null;
let pipe = null;

let recordState = "stopped";
let writeStream = null;
let startFrames = [];

function setRecordState(state) {
  recordState = state;
  wss.broadcast("recordstate " + state);
}

function startCameraSoftware() {

  console.log("Video Streamer Service : Starting Camera Software");
  wss.broadcast("starting");

  cameraSoftware = spawn('raspivid', ['-t', '0',
    '-awb', 'auto',
    '-ex', 'auto',
    '-mm', 'average',
    '-o', '-',
    '-w', config.width,
    '-h', config.height,
    '-fps', config.fps,
    '-vf', '-hf', '-pf', 'baseline']);

  cameraSoftware.on("error", (error) => {
    if (error.code == "ENOENT") {
      console.log("Video Streamer Service : Camera Software not found");
    } else {
      console.log("Video Streamer Service : Camera Software error: " + error.code);
    }
  });

  cameraSoftware.on("close", (code, signal) => {
    console.log("Video Streamer Service : Camera Software closed");

    // Stop recording if it is running
    stopRecording()

    // Reset variables
    cameraSoftware = null;
    pipe = null;

    // Try to restart in 5 seconds
    setTimeout(startCameraSoftware, 5000);
    console.log("Video Streamer Service : Restarting Streamer in 5 seconds");

    wss.broadcast("stopped");
  });


  pipe = cameraSoftware.stdout.pipe(new Splitter(NALseparator));

  pipe.on("data", (data) => {
    const package = Buffer.concat([NALseparator, data]);

    // If recording
    if (recordState == "recording") {
      writeStream.write(package);
    }



    // Save start frames for later initialization for new clients
    if (package[4] == 0x27) { startFrames[0] = package; }
    else if (package[4] == 0x28) { startFrames[1] = package; }
    else if (package[4] == 0x25) {
      startFrames[2] = package;

      if (recordState == "waitingidr") {
        // Send SPS and PPS IDR frames
        startFrames.forEach((frame) => { writeStream.write(frame); });
        setRecordState("recording");
        console.log('Video Streamer Service : IDR frame received, starting recording');
      }
    }


    wss.broadcast(package);
  });
}

// Start video software
startCameraSoftware();

function startRecording() {
  if (recordState != "stopped") { console.log("Video Streamer Service : Already recording"); return; }
  if (!pipe) { console.log("Video Streamer Service : Could not start recording, camera software pipe is not set"); return; }

  setRecordState("waitingidr");
  recordingFile = new Date().toJSON().replaceAll(/(:|-)/g, "").split(".").shift() + '.h264';
  writeStream = fs.createWriteStream('./recordings/' + recordingFile, { flags: 'a' });

  writeStream.on('error', (error) => {
    switch (error.code) {
      case "ENOSPC":
        console.log("Video Streamer Service : No space left on disk");
        wss.broadcast("disk full");
        stopRecording();
        break;
      default:
        console.log("Video Streamer Service : Error while recording: " + error.code);
        break;
    }
  });

  console.log('Video Streamer Service : Waiting for IDR frame to record');
}

function stopRecording() {
  if (recordState == "stopped") { console.log("Video Streamer Service : Not recording"); return; }

  setRecordState("stopped");
  if (writeStream) { writeStream.close(); writeStream = null; }

  console.log('Video Streamer Service : Stopped recording (' + recordingFile + ')');

  wss.broadcast("stop")
}


/* raspivid command parameters
Image parameter commands:
 
-w, --width     : Set image width <size>. Default 1920
-h, --height    : Set image height <size>. Default 1080
-b, --bitrate   : Set bitrate. Use bits per second (e.g. 10MBits/s would be -b 10000000)
-t, --timeout   : Time (in ms) to capture for. If not specified, set to 5s. Zero to disable
-fps, --framerate       : Specify the frames per second to record
-g, --intra     : Specify the intra refresh period (key frame rate/GoP size)
-pf, --profile  : Specify H264 profile to use for encoding
-ih, --inline   : Insert inline headers (SPS, PPS) to stream
-c, --circular  : Run encoded data through circular buffer until triggered then save
 
H264 Profile options :
baseline,main,high
 
Image parameter commands
 
-sh, --sharpness        : Set image sharpness (-100 to 100)
-co, --contrast : Set image contrast (-100 to 100)
-br, --brightness       : Set image brightness (0 to 100)
-sa, --saturation       : Set image saturation (-100 to 100)
-ISO, --ISO     : Set capture ISO
-vs, --vstab    : Turn on video stabilisation
-ev, --ev       : Set EV compensation
-ex, --exposure : Set exposure mode (see Notes)
-awb, --awb     : Set AWB mode (see Notes)
-ifx, --imxfx   : Set image effect (see Notes)
-cfx, --colfx   : Set colour effect (U:V)
-mm, --metering : Set metering mode (see Notes)
-rot, --rotation        : Set image rotation (0-359)
-hf, --hflip    : Set horizontal flip
-vf, --vflip    : Set vertical flip
-roi, --roi     : Set region of interest (x,y,w,d as normalised coordinates [0.0-1.0])
-ss, --shutter  : Set shutter speed in microseconds
 
Notes
 
Exposure mode options :
auto,night,nightpreview,backlight,spotlight,sports,snow,beach,verylong,fixedfps,antishake,fireworks
 
AWB mode options :
off,auto,sun,cloud,shade,tungsten,fluorescent,incandescent,flash,horizon
 
Image Effect mode options :
none,negative,solarise,sketch,denoise,emboss,oilpaint,hatch,gpen,pastel,watercolour,film,blur,saturation,colourswap,washedout,posterise,colourpoint,colourbalance,cartoon
 
Metering Mode options :
average,spot,backlit,matrix*/
