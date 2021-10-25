
// var config          = { width : 1296, height: 730, fps : 15, port : 8282 }
var config          = { width : 320, height: 240, fps : 5, port : 8282 }

var spawn           = require('child_process').spawn;
var Splitter        = require('stream-split');
var ws              = require('ws');
var fs              = require('fs');
var exec            = require('child_process').exec;
var wss             = new ws.WebSocketServer({ perMessageDeflate: false, port: config.port })
var NALseparator    = Buffer.from([0,0,0,1]);//NAL break
var streamer, readStream, sck = null;

console.log("Video Streamer Service : Listning");

wss.on('connection', function(socket) {

  console.log("Video Streamer Service : Incomming connection");
  console.log("Video Streamer Service : Accepted connection");
  socket.send("Video Streamer Service - Connected");
  
  socket.on("message", function(data){
    data = data.toString()
    var cmd = "" + data, action = data.split(' ')[0];
    console.log("Video Streamer Service : Incomming data: %s",data);
  
    if(action == "REQUESTSTREAM") {
      console.log("Video Streamer Service : Starting data stream");
      start_stream(data == "REQUESTSTREAM RECORD");      
    }
    if(action == "STOPSTREAM")
      readStream.pause();
  });
  
  socket.on('close', function() {
    readStream.end();
    streamer.kill('SIGHUP');
    console.log('Video Streamer Service : Client Closed Connection');
    sck.close();
    sck = null;
  });
  
  sck = socket;
  sck.buzy = false;
});


function start_stream(record) {
  try {
    readStream.end();
    streamer.kill('SIGHUP');
    sck.buzy = false;
  }
  catch(e) { }
  
  
  
  streamer = spawn('raspivid', ['-t', '0', 
                                '-awb', 'auto',
                                '-ex', 'auto',
                                //'-ISO', '800',
                                //'-b', 10 * 1000000, //2bps bitrate
                                //'-ss', 1/250 * 1000000, //1/20s shutter speed
                                '-mm', 'average',
                                '-o', '-', 
                                '-w', config.width, 
                                '-h', config.height, 
                                '-fps', config.fps, 
                                '-vf', '-hf', 
                                '-pf', 'baseline']);
                                  
  streamer.on("exit", function(code){ if(code != null) console.log("Failure", code); });
  readStream = streamer.stdout.pipe(new Splitter(NALseparator));
  
  //  
  
  var file = new Date().toISOString().split('T')[0]+'_'+new Date().toISOString().split('T')[1].split('.')[0]+'.h264';
  if(record) {
    streamer.stdout.pipe(fs.createWriteStream('./recordings/' + file, {flags: 'a'}))
    console.log('Video Streamer Service : Started recording ('+file+')');
    sck.send('Video Streamer Service: Starting data stream and recording ('+file+')');
  }
  else {
    sck.send("Video Streamer Service: Starting data stream without recording");
  }
  
  // Free memory
  exec('sudo /sbin/sysctl vm.drop_caches=3');

  
  readStream.on("data", function(data) {  
    if(sck.buzy && data.length > 10) { 
      console.log("Video Streamer Service : Dropping frame, TCP socket busy");
      return; 
    }

    sck.buzy = true;
    sck.send(Buffer.concat([NALseparator, data]), { binary: true}, function(error) { sck.buzy = false; });
  });

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
