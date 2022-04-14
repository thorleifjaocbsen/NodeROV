
const config = { width: 1280, height: 720, fps: 15, port: 8282 }

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
server.listen(config.port);

/* Started */
console.log("Video Streamer Service : Listning");

/* On connection */
wss.on('connection', (socket) => {

  console.log(`Video Streamer Service : Incomming connection from`);
  socket.send("Video Streamer Service - Connected");

  startFrames.forEach((frame) => {
    socket.send(frame);
  });

  socket.on("message", function (data) {
    data = data.toString().trim();
    var cmd = "" + data, action = data.split(' ')[0];
    console.log("Video Streamer Service : Incomming data: %s", data);
    if(action == "REC") {
      startRecording();
    }
    if(action == "SREC") {
      stopRecording();
    }
  });

  socket.on('close', function () {
    console.log('Video Streamer Service : Client Closed Connection');
  });

});

let cameraSoftware = null;
let pipe = null;

let recordState = false;
let writeStream = null;
let startFrames = [];

  // // Free memory
  // exec('sudo /sbin/sysctl vm.drop_caches=3');

function startCameraSoftware() {

  console.log("Video Streamer Service : Starting Camera Software");

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
  });


  pipe = cameraSoftware.stdout.pipe(new Splitter(NALseparator));

  pipe.on("data", (data) => {
    const package = Buffer.concat([NALseparator, data]);

    // If recording
    if(recordState == "recording") {
      writeStream.write(package);
    }

    // Save start frames for later initialization for new clients
    if (package[4] == 0x27) {
      startFrames[0] = package;
    }
    else if (package[4] == 0x28) {
      startFrames[1] = package;
    }
    else if(package[4] == 0x25) {
      startFrames[2] = package;

      if(recordState == "idr") {
        // Send SPS and PPS IDR frames
        startFrames.forEach((frame) => { writeStream.write(frame); });
        recordState = "recording";
        console.log('Video Streamer Service : IDR frame received, starting recording');
      }
    }


    wss.clients.forEach((client) => {
      if (client.bufferedAmount > 0) {
        console.log("Video Streamer Service : Dropping frame, TCP socket still sending");
        return;
      }
      client.send(package, { binary: true });
    });
  });
}

// Start video software
startCameraSoftware();

function startRecording() {
  if (recordState) { console.log("Video Streamer Service : Already recording"); return; }
  if (!pipe) { console.log("Video Streamer Service : Could not start recording, camera software pipe is not set"); return; }

  recordState = "idr";
  recordingFile = new Date().toJSON().replaceAll(/(:|-)/g, "").split(".").shift() + '.h264';
  writeStream = fs.createWriteStream('./recordings/' + recordingFile, { flags: 'a' });

  console.log('Video Streamer Service : Waiting for IDR frame to record');
}

function stopRecording() {
  if (!recordState) { console.log("Video Streamer Service : Not recording"); return; }

  recordState = false;
  if (writeStream) { writeStream.close(); writeStream = null; }

  console.log('Video Streamer Service : Stopped recording ('+recordingFile+')');
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
