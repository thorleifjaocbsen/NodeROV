const Video = require('./js/classes/LibCameraVideo');
const Configuration = require('./configuration.json');
const uws = require('./js/uws');
const { isMainThread, parentPort } = require('worker_threads');

if (!isMainThread) {
  console.log = (message) => { parentPort.postMessage({ type: "info", value: message }) };
  console.info = (message) => { parentPort.postMessage({ type: "info", value: message }) };
  console.warn = (message) => { parentPort.postMessage({ type: "warn", value: message }) };
  console.error = (message) => { parentPort.postMessage({ type: "error", value: message }) };
}

const video = new Video();
video.on('start', () => { console.log('Video started') });
video.on('stop', () => { console.log('Video stopped') });
video.on('error', (err) => { console.error(`Video error: ${err}`) });
video.on('frame', (frame) => { wss.publish('video', frame, true, true); });
video.on('recordStateChange', (value) => {
  console.log(`Record state changed to ${value}`)
  const type = "recordStateChange";
  wss.publish('all', 'data ' + JSON.stringify({ type, value }), false, true);
});
video.start(Configuration.video.width, Configuration.video.height, Configuration.video.fps);

const wss = uws.SSLApp({ key_file_name: 'assets/key.pem', cert_file_name: 'assets/cert.pem' })
wss.ws('/*', {

  /* There are many common helper features */
  idleTimeout: 32,
  maxBackpressure: 1024,
  maxPayloadLength: 512,
  compression: uws.DEDICATED_COMPRESSOR_3KB,

  message: (ws, message, isBinary) => {

    const msg = Buffer.from(message).toString();

    console.log(`Received message: ${msg}`);

    if (msg == "recordToggle") {
      if (video.isRecording()) {
        video.stopRecording();
      } else {
        // Generate filename, date + time:
        let filename = new Date().toISOString().replaceAll(":", "-").split(".")[0];
        video.startRecording(`${filename}.h264`);
      }
    }

    if (msg == "video") {
      ws.isSubscribed('video') ? ws.unsubscribe('video') : ws.subscribe('video');
    }
  },

  open: (ws) => {
    ws.subscribe('all');

    const ipBuffer = Buffer.from(ws.getRemoteAddress().slice(-4));
    const ip = ipBuffer.join('.');
    console.log(`A WebSocket connected from ${ip}`);
    video.isRecording();

    /* Send start frames for video initialization */
    const startFrames = video.getInitFrames();
    startFrames.forEach((frame) => {
      ws.send(frame, true, true);
    });
  },

  close: (ws, code, message) => {
    console.log(`WebSocket closed ${code} ${Buffer.from(message).toString()}`);
  }

})

wss.listen(Configuration.video.port, (listenSocket) => {

  if (listenSocket) {
    console.log(`Listning on port ${Configuration.video.port}`);
  }

});