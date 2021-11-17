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

console.log   = log.debug
console.error = log.error

const Configuration           = require('./configuration.json')
const RemoteOperatedVehicle   = require('./js/RemoteOperatedVehicle.js');
const ThrusterController      = require('./js/ThrusterController.js');
const AuxiliaryController     = require('./js/AuxiliaryController.js')
const HeartbeatController     = require('./js/Heartbeat.js')
const InternalPressureSensor  = require('./js/InternalPressureSensor')
const AnalogDigitalConverter  = require('./js/AnalogDigitalConverter')
const InertialMeasurementUnit = require('./js/InertialMeasurementUnit')

/************************
 *
 * Initialize scripts
 *
 ************************/
const thrusters = new ThrusterController(Configuration.thrusters)
const aux = new AuxiliaryController(Configuration.auxiliary)
const rov = new RemoteOperatedVehicle(Configuration.rov)
const ips = new InternalPressureSensor()
const imu = new InertialMeasurementUnit()
const adc = new AnalogDigitalConverter(Configuration.calibration.adc)

/************************
 *
 * ROV Event Handlers
 *
 ************************/
rov.on('arm', () => { log.info('ROV Armed') })
rov.on('disarm', () => { log.info('ROV Disarmed') })
rov.on('controlInputChange', (newInput) => { 
  
  log.info("Controller input changed")
  thrusters.calculateOutput(newInput)
  

})


/************************
 *
 * Internal Pressure Sensor
 *
 ************************/
ips.on('initError', (err) => { log.error(`IPS initializing failed (${err})`) })
ips.on('readError', (err) => { log.error(`IPS read failed (${err})`) })
ips.on('init', () => { log.info("IPS successfully initialized") })
ips.on('read', () => { 

  log.debug(`IPS Read: ${ips.temperature}c, ${ips.humidity.toFixed(0)}%, ${ips.pressure.toFixed(3)}hPa`)
  rov.environment.internalPressure = ips.pressure
  rov.environment.humidity = ips.humidity
})

/************************
 *
 * Analog Digital Converter (ADC)
 *
 ************************/
adc.on('init', () => { log.info("ADC successfully initialized") })
adc.on('read', () => { 

  log.debug(`ADS1015 Read: V=${adc.getCurrent().toFixed(3)}a, 1=${adc.getVoltage().toFixed(2)}v, 2=${adc.getLeak()}, X=${adc.getAccumulatedMah()}mAh`)
  rov.battery.voltage = adc.getVoltage()
  rov.battery.current = adc.getCurrent()
  rov.battery.mahUsed = adc.getAccumulatedMah()
  rov.environment.leak = adc.getLeak()
})

/************************
 *
 * Inertial Measurement Unit (IMU)
 *
 ************************/
imu.on('init', () => { log.info("IMU successfully initialized") })
imu.on('read', () => {

  log.debug(`IMU Data: Roll = ${imu.roll}, Pitch = ${imu.pitch}, Heading = ${imu.heading}`)
  rov.attitude.roll = imu.roll
  rov.attitude.pitch = imu.pitch
  rov.attitude.heading = imu.heading
})

/************************
 *
 * Thruster Event Handlers
 *
 ************************/
thrusters.on('thrusterOutputChange', (thrusters) => {
  
  log.debug("Thruster Output Change")
  thrusters.forEach(thruster => {

    log.silly(`Setting PWM for pin ${thruster.pin} to ${thruster.us}uS`)
    // TODO: Add PWM Controller to SET PWM
  });
})


/************************
 *
 * Auxiliary Event Handlers
 *
 ************************/
aux.on('deviceOutputChange', (device) => {

  log.debug(`PWM Signal change on ${device.id} (pin: ${device.pin}, us: ${device.us})`)
  // TODO: Add PWM Controller to SET PWM
})

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
wss.on('connection', function(ws, req) {

  try { log.remove(log.transports.socketIO); }
  catch(e) {  }



  log.info(`Websocket: Remote connection OPENED from: ${ws._socket.remoteAddress}:${ws._socket.remotePort}`)
  log.add(log.socketIOTransport,ws)
  log.info('Websocket: Starting heartbeat')

  const hb = new HeartbeatController()
  hb.on("timeout", () => {
  
    log.warn(`Heartbeat timeout, disarm ROV  ${ws._socket.remoteAddress}:${ws._socket.remotePort}`)
    rov.disarm()
    hb.stop()
  })
 
  hb.on('beat', (data, latency) => { ws.send(`hb ${data} ${latency}`) })
  hb.start()

  ws.on('message', parseWebsocketData)
  ws.on('close', () => {
    log.info(`Websocket: Remote connection CLOSED from: ${ws._socket.remoteAddress}:${ws._socket.remotePort}`)

    rov.disarm()
    hb.stop()
    hb.removeListener('beat', sendHeartbeat)
  })

  ws.hb = hb
});


/************************
 *
 *
 * Web Socket message parser
 *
 *
 ************************/
function parseWebsocketData(data) {


  data = data.toString().split(" ")
  const cmd = data.shift(1)

  if (cmd == "hb") { this.hb.pulse(data[0]) }
  else if (cmd == "clog") { }
  else if (cmd == "controls") { 
    // Data json object?
    data = JSON.parse(data.join(' '))
    console.log(data)
  }
  else {
    log.warn(`Websocket: Unknown command: ${cmd} (${JSON.stringify(data)})`);
  }

    // switch (cmd) {


    //   case "clog":
    //     log.log('info', 'CLIENT: ' + data);
    //     break;

    //   case "setlight":
    //     var d = data.split(" ");
    //     rovController.setLight(d[0], parseInt(d[1]));
    //     break;

    //   case "armtoggle":
    //     rovController.toggleArm()
    //     break;

    //   case "arm":
    //     rovController.arm()
    //     break;

    //   case "disarm":
    //     rovController.disarm()
    //     break;

    //   case "depthhold":
    //     if (!rovController.armed) { log.info('Depth hold not activated, ROV not armed'); break; }
    //     rovController.depth.PID.reset();
    //     rovController.depth.wanted = parseInt(ptSensorExt.pressure);
    //     if (rovController.depth.hold) rovController.depth.hold = false;
    //     else rovController.depth.hold = true;
    //     log.log('info', 'Depth hold is: ' + (rovController.depth.hold ? 'Activated' : 'Deactivated'));
    //     break;

    //   case "headinghold":
    //     if (!rovController.armed) {
    //       log.log('info', 'Heading hold not activated, ROV not armed');
    //       return;
    //     }
    //     rovController.heading.PID.reset();
    //     rovController.heading.wanted = rovController.heading.totalHeading * 10;
    //     if (rovController.heading.hold) rovController.heading.hold = false;
    //     else rovController.heading.hold = true;
    //     log.log('info', 'Heading hold is: ' + (rovController.heading.hold ? 'Activated' : 'Deactivated'));
    //     break;

    //   case "setdepth":
    //     rovController.depth.wanted = parseInt(data);
    //     break;

    //   case "setgain":
    //     rovController.gain = parseInt(data);
    //     if (rovController.gain > 400) rovController.gain = 400;
    //     if (rovController.gain < 50) rovController.gain = 50;
    //     break;

    //   case "setflat":
    //     accmag.setFlat();
    //     config.acc.flat = accmag.acc.flat;
    //     utils.writeConfig(config);
    //     log.log('info', 'ROV Flat calibration set');
    //     break;

    //   case "calibrategyro":
    //     gyro.calibrate(100, 10);
    //     log.log('info', 'ROV Gyro Calibration starting. Do not move ROV');
    //     break;

    //   case "setcamera":
    //     rovController.setCamera(data);
    //     break;

    //   case "gripopen":
    //     rovController.setGripper(1);
    //     break;
    //   case "gripclose":
    //     rovController.setGripper(-1);
    //     break;

    //   case "controls":
    //     controls = JSON.parse(data);
    //     break;

    //   default:
    //     
    //     break;
    // }
  
  // else {
  //   log.log('warn', 'Websocket: Bad data received: ' + data);
  // }
}



/************************
 *
 * Main loop
 *
 ************************/

 setInterval(() => { // Send data to client
  /************************
   *
   * Check client connectivity
   *
   ************************/
  // if(!heartbeatController.isAlive()) {
  //   // Warning lights!! Lost topsite connecton, do stop everything!
  //   if(rovController.armed) rovController.disarm(); // Disarm

  //   if((heartbeatController.offTime > 5) && (client != null)) {
  //     client.close(); // Kill connection
  //     client = null; // Allow new connection
  //   }
  //   return;
  // }


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
