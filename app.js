/*
 * NodeROV - Application
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

require('./ascii')

const ws        = require('ws')
const express   = require('express')
const app       = express()
const http      = require('http').Server(app)
const log       = require('./js/Log.js')
const hb        = require('./js/heartbeat.js')

const Configuration               = require('./configuration.json')
const RemoteOperatedVehicleClass  = require('./js/RemoteOperatedVehicle.js');
const ThrusterControllerClass     = require('./js/ThrusterController.js');
const AuxiliaryControllerClass    = require('./js/AuxiliaryController.js')


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
const ThrusterController  = new ThrusterControllerClass(Configuration.thrusters)
const AuxiliaryController = new AuxiliaryControllerClass(Configuration.auxiliary)
const ROVController       = new RemoteOperatedVehicleClass(Configuration.rov)

/************************
 *
 * ROV Event Handlers
 *
 ************************/
ROVController.on('arm', () => { log.info('ROV Armed') })
ROVController.on('disarm', () => { log.info('ROV Disarmed') })
ROVController.on('controlInputChange', (newInput) => { 
  log.info("Controller input changed")
  ThrusterController.calculateOutput(newInput)
})

/************************
 *
 * Thruster Event Handlers
 *
 ************************/
ThrusterController.on('thrusterOutputChange', (thrusters) => {
  thrusters.forEach(thruster => {
    log.debug(`Setting PWM for pin ${thruster.pin} to ${thruster.us}uS`)
    // TODO: Add PWM Controller to SET PWM
  });
})


/************************
 *
 * Auxiliary Event Handlers
 *
 ************************/
AuxiliaryController.on('deviceOutputChange', (device) => {
  log.debug(`PWM Signal change on ${device.id} (pin: ${device.pin}, us: ${device.us})`)
  // TODO: Add PWM Controller to SET PWM
})




// TEST: Testing that everything works on paper for now.
ROVController.arm();
ROVController.setControlInput({climb: 1, yaw: 0.1})
AuxiliaryController.calculateOutput("camera", 1)


/************************
 *
 * Web server start
 *
 ************************/
 log.log('info','Starting webserver')
 app.use('/', express.static(__dirname+'/client'))
 http.listen(Configuration.port, () => { log.info(`Webserver started on port: ${Configuration.port}`) })
 

/************************
 *
 * Web socket start
 *
 ************************/
const wss = new ws.WebSocketServer({ perMessageDeflate: false, port: Configuration.socketPort })
log.info(`Websocket: Listning on ${Configuration.socketPort}`)
wss.on('connection', function(c) {
  client = c
  try { log.remove(log.transports.socketIO); }
  catch(e) {  }
  log.info(`Websocket: Remote connection from: ${client._socket.remoteAddress}:${client._socket.remotePort}`)
  log.add(log.socketIOTransport,client)
  log.info('Websocket: Starting heartbeat')
  hb.start(client)
  client.on('message', wss.parseMessage)

});


/************************
 *
 *
 * Web Socket message parser
 *
 *
 ************************/
wss.parseMessage = function (data) {
  log.debug("WS Data: " + data);
  data = data.toString()
  if (typeof data == "string") {
    var cmd = data.split(" ")[0];
    var data = data.substr(cmd.length + 1);

    switch (cmd) {
      case "hb":
        hb.pulse(data.split(" ")[0]);
        break;

      case "clog":
        log.log('info', 'CLIENT: ' + data);
        break;

      case "setlight":
        var d = data.split(" ");
        ROVController.setLight(d[0], parseInt(d[1]));
        break;

      case "armtoggle":
        ROVController.toggleArm()
        break;

      case "arm":
        ROVController.arm()
        break;

      case "disarm":
        ROVController.disarm()
        break;

      case "depthhold":
        if (!ROVController.armed) { log.info('Depth hold not activated, ROV not armed'); break; }
        ROVController.depth.PID.reset();
        ROVController.depth.wanted = parseInt(ptSensorExt.pressure);
        if (ROVController.depth.hold) ROVController.depth.hold = false;
        else ROVController.depth.hold = true;
        log.log('info', 'Depth hold is: ' + (ROVController.depth.hold ? 'Activated' : 'Deactivated'));
        break;

      case "headinghold":
        if (!ROVController.armed) {
          log.log('info', 'Heading hold not activated, ROV not armed');
          return;
        }
        ROVController.heading.PID.reset();
        ROVController.heading.wanted = ROVController.heading.totalHeading * 10;
        if (ROVController.heading.hold) ROVController.heading.hold = false;
        else ROVController.heading.hold = true;
        log.log('info', 'Heading hold is: ' + (ROVController.heading.hold ? 'Activated' : 'Deactivated'));
        break;

      case "setdepth":
        ROVController.depth.wanted = parseInt(data);
        break;

      case "setgain":
        ROVController.gain = parseInt(data);
        if (ROVController.gain > 400) ROVController.gain = 400;
        if (ROVController.gain < 50) ROVController.gain = 50;
        break;

      case "setflat":
        accmag.setFlat();
        config.acc.flat = accmag.acc.flat;
        utils.writeConfig(config);
        log.log('info', 'ROV Flat calibration set');
        break;

      case "calibrategyro":
        gyro.calibrate(100, 10);
        log.log('info', 'ROV Gyro Calibration starting. Do not move ROV');
        break;

      case "setcamera":
        ROVController.setCamera(data);
        break;

      case "gripopen":
        ROVController.setGripper(1);
        break;
      case "gripclose":
        ROVController.setGripper(-1);
        break;

      case "controls":
        controls = JSON.parse(data);
        break;

      default:
        log.log('warn', 'Websocket: Unknown command: ' + cmd + ' (' + data + ')');
        break;
    }
  }
  else {
    log.log('warn', 'Websocket: Bad data received: ' + data);
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
    if(ROVController.armed) ROVController.disarm(); // Disarm

    if((hb.offTime > 5) && (client != null)) {
      client.close(); // Kill connection
      client = null; // Allow new connection
    }
    return;
  }


  // /************************
  //  *
  //  * Calibration stuff? :P
  //  *
  //  ************************/
  //   /* Calibration of accelerometer and magnometer starting */
  // if(config.accMagCalibration > 0) {
  //   if(config.accMagCalibration % 10 == 0) {
  //     if(accmag.calibrate()) { config.accMagCalibrationUpdates = config.accMagCalibration; }
  //   }

  //   let lastUpdate = config.accMagCalibration - config.accMagCalibrationUpdates

  //   config.accMagCalibration ++;

  //   if(lastUpdate >= 500) {
  //     accmag.finishCalibration();
  //     console.log("DONE");
  //     console.log("DONE");
  //     console.log("DONE");
  //     config.accMagCalibration = 0;
  //   }
  // }

  // /************************
  //  *
  //  * Update ROV controls and stuff
  //  *
  //  ************************/

  // let pwmLo = rov.gain*-1;
  // let pwmHi = rov.gain;

  // let forward_command   = utils.map(controls.forward, -100, 100, pwmLo, pwmHi); // -400 to 400 from joystick
  // let strafe_command    = utils.map(controls.strafe,  -100, 100, pwmLo, pwmHi); // -400 to 400 from joystick
  // let yaw_command       = utils.map(controls.yaw,     -100, 100, pwmLo, pwmHi); // -400 to 400 from joystick
  // let climb_command     = utils.map(controls.climb,   -100, 100, pwmLo, pwmHi); // -400 to 400 from joystick
  // let fwd_factor        = 1.41;
  // let strafe_factor     = 1.41;
  // let yaw_factor        = 0.9;
  // let base_command      = rov.centerCommand;

  // /************************
  //  * DEPTH HOLD FUNCTION  *
  //  ************************/
  // if(rov.depth.hold && rov.armed) {
  //   // Getting input, set wished depth to current depth
  //   if(climb_command != 0) { rov.depth.wanted = parseInt(ptSensorExt.pressure); }
  //   // No more input, lets hold the depth we wanted!
  //   else {
  //     var output  = rov.depth.PID.update(rov.depth.wanted, parseInt(ptSensorExt.pressure));
  //     climb_command = parseInt(output);
  //   }
  // }
  // else if(rov.depth.hold && !rov.armed) rov.depth.hold = false;

  // /*************************
  //  * HEADING HOLD FUNCTION *
  //  *************************/
  // if(rov.heading.hold && rov.armed && false == true) {
  //   // Getting input, set wished heading to current heading
  //   if(yaw_command != 0) { rov.heading.wanted = rov.heading.totalHeading*10; }
  //   // No more input, lets hold the heading we wanted!
  //   else {
  //     var output = rov.heading.PID.update(rov.heading.wanted, rov.heading.totalHeading*10);
  //     yaw_command = output;
  //   }
  // }
  // else if(rov.heading.hold && !rov.armed) rov.heading.hold = false;

  
  // /****************************
  //  * MOTOR THRUST CALCULATION *
  //  ****************************/
  // rov.motors.frontleft  = base_command + fwd_factor*forward_command - strafe_factor*strafe_command - yaw_factor*yaw_command;
  // rov.motors.backleft   = base_command + fwd_factor*forward_command + strafe_factor*strafe_command - yaw_factor*yaw_command;
  // rov.motors.backright  = base_command + fwd_factor*forward_command - strafe_factor*strafe_command + yaw_factor*yaw_command;
  // rov.motors.frontright = base_command + fwd_factor*forward_command + strafe_factor*strafe_command + yaw_factor*yaw_command;
  // rov.motors.upleft     = base_command - climb_command;
  // rov.motors.upright    = base_command + climb_command;
  
  // // Limit all motors to output of 1000 and 2000 maximum
  // for(var i in rov.motors) {
  //   if(rov.motors[i] > 1950) rov.motors[i] = 1950;
  //   if(rov.motors[i] < 1150) rov.motors[i] = 1150;
  // }

  // // Sends thruster data to thrusters, will only happen if "armed"
  // rov.updateThrusters();
  
  // // Reset gripper if its been over 2 seconds since update.
  // var lgm = Date.now() - rov.lastGripper;
  // if((lgm > 100) && ( rov.gripper != 0)) { rov.setGripper(0); }
  
  // /************************
  //  *
  //  * Send telemetry data every 10tick (20*10 = 200ms)
  //  *
  //  ************************/
  // if(telemTick == 5) {
  //   var returnObject              = {};
  //   returnObject.volt             = battery.volt;
  //   returnObject.mAmp             = battery.mAmp;
  //   returnObject.mAmpUsed         = battery.mAmpUsed;
  //   returnObject.motors           = rov.motors;
  //   returnObject.armed            = rov.armed;
  //   returnObject.depth            = rov.depth;
  //   returnObject.heading          = rov.heading;
  //   returnObject.roll             = rov.roll;
  //   returnObject.pitch            = rov.pitch;
  //   returnObject.gain             = rov.gain;
  //   returnObject.lights           = rov.lights;
  //   returnObject.disk             = rov.disk;
  //   returnObject.cpu              = rov.cpu;
  //   returnObject.memory           = rov.memory;
  //   returnObject.cameraPosition   = rov.cameraPosition;
  //   returnObject.accel            = accmag.acc;
  //   returnObject.outside          = { temp : ptSensorExt.temperature, depth : ptSensorExt.depth(), pressure : ptSensorExt.pressure }
  //   returnObject.inside           = { temp : ptSensorInt.temperature, pressure : ptSensorInt.pressure, coreTemp : rov.coreTemp }
  //   client.send("telemetryData "+JSON.stringify(returnObject));

  //   telemTick = 0;
  // }
  // telemTick++;


}, 10);
