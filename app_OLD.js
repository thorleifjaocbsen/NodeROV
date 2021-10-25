const WebSocketServer = require('ws').WebSocket.WebSocketServer;


const ws       = new WebSocketServer({ port: 8080 })
var express     = require('express');
var app         = express();
var http        = require('http').Server(app);
var logger      = require('./js/logger.js');
var hb          = require('./js/heartbeat.js');
var utils       = require('./js/utils.js');
var L3GD20      = require('./js/L3GD20.js');
var MS5837      = require('./js/MS5837.js');
var BMP180      = require('./js/BMP180.js');
var LSM303      = require('./js/LSM303.js');
var RemoteOperatedVehicle = require('./js/rov.js');
var battery     = require('./js/battery.js');
var exec        = require('child_process').exec;
var controls    = { forward : 0, strafe : 0, climb : 0, yaw : 0 };
var config      = utils.readConfig();
var client      = null;
var telemTick   = 0;
var gyro        = new L3GD20();
var ptSensorExt = new MS5837();
var ptSensorInt = new BMP180();
var accmag      = new LSM303();

// LOOP
// 1hz - Update ping
// 10hz - Update gyro
// 50Hz - Update PWM
// 0.5Hz - Send data to client

/************************
 *
 * Initialize scripts
 *
 ************************/

// Replace logging functions on different classes
hb.log          = function(level, text) { logger.log(level, text); }
// rov.log         = function(level, text) { logger.log(level, text); }
ptSensorExt.log = function(level, text) { logger.log(level, text); }

// Initialize all classes which need some initializing.
const rov = new RemoteOperatedVehicle()
// rov.initialize();
gyro.initialize();
ptSensorExt.initialize();
ptSensorInt.initialize();
accmag.initialize();

// Calibrate gyro, 10 samples, 10ms appart

// Create pid controllers used on the script
rov.depth.PID   = utils.PID(5, 0, 0, 0, -400, 400);
rov.heading.PID = utils.PID(3, 0, 0, 0, -400, 400);

// Populate accel & mag calibration:
accmag.acc.offset = config.acc.offset;
accmag.acc.max    = config.acc.max;
accmag.acc.min    = config.acc.min;
accmag.mag.offset = config.mag.offset;
accmag.mag.max    = config.mag.max;
accmag.mag.min    = config.mag.min;
accmag.acc.flat   = config.acc.flat;

// Change power sensor i2c data
// battery.setVoltMultiplier(9.776923076923078);
// battery.setAmpMultiplier(18.072289157);


/************************
 *
 * Web server start
 *
 ************************/
logger.log('info','Starting webserver');
app.use('/', express.static(__dirname+'/client'));
http.listen(config.port, function() { logger.log('info', 'Webserver started on port %s', config.port); });


/************************
 *
 * Web socket start
 *
 ************************/
var wss = new uws({ perMessageDeflate: false, port: config.socketPort });
logger.log('info','Websocket: Listning on '+config.socketPort);
wss.on('connection', function(c) {
  client = c;
  try { logger.remove(logger.transports.socketIO); }
  catch(e) { }
  logger.log('info','Websocket: Remote connection from: '+client._socket.remoteAddress+':'+client._socket.remotePort);
  logger.add(logger.socketIOTransport,client);
  logger.log('info','Websocket: Starting heartbeat');
  hb.start(client);
  client.on('message', wss.parseMessage);
});

/************************
 *
 *
 * Web Socket message parser
 *
 *
 ************************/
wss.parseMessage = function(data) {
  logger.log("debug", "WS Data: "+data);
  if(typeof data == "string") {
    var cmd = data.split(" ")[0];
    var data = data.substr(cmd.length+1);

    switch(cmd) {
      case "hb":
        hb.pulse(data.split(" ")[0]);
        break;

      case "clog":
        logger.log('info', 'CLIENT: '+data);
        break;

      case "setlight":
        var d = data.split(" ");
        rov.setLight(d[0], parseInt(d[1]));
        break;

      case "armtoggle":
        if(rov.armed) { rov.disarm(); }
        else { rov.arm(); }
        break;

      case "arm":
        if(!rov.armed) rov.arm();
        break;

      case "disarm":
        if(rov.armed) rov.disarm();
        break;

      case "depthhold":
        if(!rov.armed) { logger.log('info', 'Depth hold not activated, ROV not armed'); break; }
        rov.depth.PID.reset();
        rov.depth.wanted = parseInt(ptSensorExt.pressure);
        if(rov.depth.hold) rov.depth.hold = false;
        else rov.depth.hold = true;
        logger.log('info', 'Depth hold is: '+(rov.depth.hold?'Activated' : 'Deactivated'));
        break;

      case "headinghold":
        if(!rov.armed) {
          logger.log('info', 'Heading hold not activated, ROV not armed');
          return;
        }
        rov.heading.PID.reset();
        rov.heading.wanted = rov.heading.totalHeading*10;
        if(rov.heading.hold) rov.heading.hold = false;
        else rov.heading.hold = true;
        logger.log('info', 'Heading hold is: '+(rov.heading.hold?'Activated' : 'Deactivated'));
        break;

      case "setdepth":
        rov.depth.wanted = parseInt(data);
        break;

      case "setgain":
        rov.gain = parseInt(data);
        if(rov.gain > 400) rov.gain = 400;
        if(rov.gain < 50)  rov.gain = 50;
        break;

      case "setflat":
        accmag.setFlat();
        config.acc.flat = accmag.acc.flat;
        utils.writeConfig(config);
        logger.log('info', 'ROV Flat calibration set');
        break;

      case "calibrategyro":
        gyro.calibrate(100,10);
        logger.log('info', 'ROV Gyro Calibration starting. Do not move ROV');
        break;

      case "setcamera":
        rov.setCamera(data);
        break;
		
	  case "gripopen":
	    rov.setGripper(1);
	    break;
	  case "gripclose":
	    rov.setGripper(-1);
	    break;
		
      case "controls":
        controls = JSON.parse(data);
        break;

      default:
        logger.log('warn', 'Websocket: Unknown command: '+cmd+' ('+data+')');
        break;
    }
  }
  else {
    logger.log('warn', 'Websocket: Bad data received: '+data);
  }
}


/************************
 *
 * Main loop
 *
 ************************/

setInterval(function() { // Send data to client
  /************************
   *
   * Check client connectivity
   *
   ************************/
  if(!hb.connected) {
    // Warning lights!! Lost topsite connecton, do stop everything!
    if(rov.armed) rov.disarm(); // Disarm

    if((hb.offTime > 5) && (client != null)) {
      client.close(); // Kill connection
      client = null; // Allow new connection
    }
    return;
  }


  /************************
   *
   * Calibration stuff? :P
   *
   ************************/
    /* Calibration of accelerometer and magnometer starting */
  if(config.accMagCalibration > 0) {
    if(config.accMagCalibration % 10 == 0) {
      if(accmag.calibrate()) { config.accMagCalibrationUpdates = config.accMagCalibration; }
    }

    let lastUpdate = config.accMagCalibration - config.accMagCalibrationUpdates

    config.accMagCalibration ++;

    if(lastUpdate >= 500) {
      accmag.finishCalibration();
      console.log("DONE");
      console.log("DONE");
      console.log("DONE");
      config.accMagCalibration = 0;
    }
  }

  /************************
   *
   * Update ROV controls and stuff
   *
   ************************/

  let pwmLo = rov.gain*-1;
  let pwmHi = rov.gain;

  let forward_command   = utils.map(controls.forward, -100, 100, pwmLo, pwmHi); // -400 to 400 from joystick
  let strafe_command    = utils.map(controls.strafe,  -100, 100, pwmLo, pwmHi); // -400 to 400 from joystick
  let yaw_command       = utils.map(controls.yaw,     -100, 100, pwmLo, pwmHi); // -400 to 400 from joystick
  let climb_command     = utils.map(controls.climb,   -100, 100, pwmLo, pwmHi); // -400 to 400 from joystick
  let fwd_factor        = 1.41;
  let strafe_factor     = 1.41;
  let yaw_factor        = 0.9;
  let base_command      = rov.centerCommand;

  /************************
   * DEPTH HOLD FUNCTION  *
   ************************/
  if(rov.depth.hold && rov.armed) {
    // Getting input, set wished depth to current depth
    if(climb_command != 0) { rov.depth.wanted = parseInt(ptSensorExt.pressure); }
    // No more input, lets hold the depth we wanted!
    else {
      var output  = rov.depth.PID.update(rov.depth.wanted, parseInt(ptSensorExt.pressure));
      climb_command = parseInt(output);
    }
  }
  else if(rov.depth.hold && !rov.armed) rov.depth.hold = false;

  /*************************
   * HEADING HOLD FUNCTION *
   *************************/
  if(rov.heading.hold && rov.armed && false == true) {
    // Getting input, set wished heading to current heading
    if(yaw_command != 0) { rov.heading.wanted = rov.heading.totalHeading*10; }
    // No more input, lets hold the heading we wanted!
    else {
      var output = rov.heading.PID.update(rov.heading.wanted, rov.heading.totalHeading*10);
      yaw_command = output;
    }
  }
  else if(rov.heading.hold && !rov.armed) rov.heading.hold = false;

  
  /****************************
   * MOTOR THRUST CALCULATION *
   ****************************/
  rov.motors.frontleft  = base_command + fwd_factor*forward_command - strafe_factor*strafe_command - yaw_factor*yaw_command;
  rov.motors.backleft   = base_command + fwd_factor*forward_command + strafe_factor*strafe_command - yaw_factor*yaw_command;
  rov.motors.backright  = base_command + fwd_factor*forward_command - strafe_factor*strafe_command + yaw_factor*yaw_command;
  rov.motors.frontright = base_command + fwd_factor*forward_command + strafe_factor*strafe_command + yaw_factor*yaw_command;
  rov.motors.upleft     = base_command - climb_command;
  rov.motors.upright    = base_command + climb_command;
  
  // Limit all motors to output of 1000 and 2000 maximum
  for(var i in rov.motors) {
    if(rov.motors[i] > 1950) rov.motors[i] = 1950;
    if(rov.motors[i] < 1150) rov.motors[i] = 1150;
  }

  // Sends thruster data to thrusters, will only happen if "armed"
  rov.updateThrusters();
  
  // Reset gripper if its been over 2 seconds since update.
  var lgm = Date.now() - rov.lastGripper;
  if((lgm > 100) && ( rov.gripper != 0)) { rov.setGripper(0); }
  
  /************************
   *
   * Send telemetry data every 10tick (20*10 = 200ms)
   *
   ************************/
  if(telemTick == 5) {
    var returnObject              = {};
    returnObject.volt             = battery.volt;
    returnObject.mAmp             = battery.mAmp;
    returnObject.mAmpUsed         = battery.mAmpUsed;
    returnObject.motors           = rov.motors;
    returnObject.armed            = rov.armed;
    returnObject.depth            = rov.depth;
    returnObject.heading          = rov.heading;
    returnObject.roll             = rov.roll;
    returnObject.pitch            = rov.pitch;
    returnObject.gain             = rov.gain;
    returnObject.lights           = rov.lights;
    returnObject.disk             = rov.disk;
    returnObject.cpu              = rov.cpu;
    returnObject.memory           = rov.memory;
    returnObject.cameraPosition   = rov.cameraPosition;
    returnObject.accel            = accmag.acc;
    returnObject.outside          = { temp : ptSensorExt.temperature, depth : ptSensorExt.depth(), pressure : ptSensorExt.pressure }
    returnObject.inside           = { temp : ptSensorInt.temperature, pressure : ptSensorInt.pressure, coreTemp : rov.coreTemp }
    client.send("telemetryData "+JSON.stringify(returnObject));

    telemTick = 0;
  }
  telemTick++;


}, 10);


/************************
*
* Update sensors and get data
*
************************/

// Battery, Pressure Sensor (External & Internal)
setInterval(function() {
  battery.readSensor();
  ptSensorExt.readSensor();
  ptSensorInt.readSensor();
}, 100);


var lastSensorUpdate = Date.now();

gyro.readSensor();
accmag.readSensor();

rov.roll = accmag.roll;
rov.pitch = accmag.pitch;
rov.heading.current = accmag.heading;

setInterval(function() {
  gyro.readSensor();
  accmag.readSensor();

  // Calculate roll and pitch (98% gyro 2% accel, using the complementary filter)
  let DT = (Date.now() - lastSensorUpdate) / 1000;

  let oH = rov.heading.current;
  let rot = gyro.z * DT;

  rov.roll = 0.98 * (rov.roll + gyro.x * DT) + 0.02 * accmag.roll;
  rov.pitch = 0.98 * (rov.pitch + gyro.y * DT) + 0.02 * accmag.pitch;
  rov.heading.current = 0.98 * (rov.heading.current + gyro.z * DT) + 0.02 * accmag.heading;
  if(Math.abs(rov.heading.current - accmag.heading) > 100) rov.heading.current = accmag.heading;
  let nH = rov.heading.current;

  // Turn Calculator - Thanks to IaTsI for helping me.
  let diff = Math.abs(oH-nH);
  if(diff > 180 && oH > nH) { rov.heading.turns ++; }
  if(diff > 180 && nH > oH) { rov.heading.turns --; }
  // End of Fun! :/

  rov.heading.totalHeading = rov.heading.current + rov.heading.turns * 360;

  lastSensorUpdate = Date.now();
}, 20)


setInterval(function() {
  exec("cat /sys/class/thermal/thermal_zone0/temp", function (error, stdout, stderr) {
    rov.coreTemp = parseFloat(stdout)/1000;
  });
  exec("df -hT / | awk 'BEGIN{''} END{print $4,$5}'", function(error, stdout, stderr) {
    var used = parseFloat(stdout.split(" ")[0].trim().slice(0,-1));
    var total = parseFloat(stdout.split(" ")[1].trim().slice(0,-1));
    rov.disk = { used : used, total:total };
  });
  exec("grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$4+$5)} END {print usage}'", function(error, stdout, stderr) {
    rov.cpu = parseFloat(stdout);
  });
  exec("free -m | awk '/Mem:/ { print $2,$3 }'", function(error, stdout, stderr) {
    rov.memory = { total : parseInt(stdout.split(" ")[0]), used : parseInt(stdout.split(" ")[1]) }
  })

}, 10000)
