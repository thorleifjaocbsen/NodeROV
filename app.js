/*
 * NodeROV - Application
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

require('./ascii')

const ws        = require('ws')
const fs        = require('fs')
const express   = require('express')
const app       = express()
const https     = require('https')
const log       = require('./js/Log.js')

console.log   = log.warn
console.error = log.error

const Configuration           = require('./configuration.json')
const defaultControls         = require('./controls.json')
const RemoteOperatedVehicle   = require('./js/RemoteOperatedVehicle.js');
const AuxiliaryController     = require('./js/AuxiliaryController.js')
const HeartbeatController     = require('./js/Heartbeat.js')
const InternalPressureSensor  = require('./js/InternalPressureSensor')
const AnalogDigitalConverter  = require('./js/AnalogDigitalConverter')
const InertialMeasurementUnit = require('./js/InertialMeasurementUnit')

const PCA9685 = require('./js/drivers/PCA9685.js');
const pca9685 = new PCA9685();
pca9685.init();

// Create interval every 1 second to update the telemtry from rov
setInterval(() => {
  wss.broadcast("telemetry " + JSON.stringify(rov.getTelemetry()));
}, 1000);

/************************
 *
 * Initialize scripts
 *
 ************************/
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
rov.on('thusterOutputChanged', (ouputInUs) => { 
  ouputInUs.forEach((output) => {
    log.info(`Pin: ${output.pin} = ${output.us}us`);
    pca9685.setPWM(output.pin, output.us);
  })

  //wss.broadcast(`thrusterOutput ${JSON.stringify(ouputInUs)}`);

})
rov.controllerInputUpdate(defaultControls)

/************************
 *
 * Internal Pressure Sensor
 *
 ************************/
ips.on('initError', (err) => { log.error(`IPS initializing failed (${err})`) })
ips.on('readError', (err) => { log.error(`IPS read failed (${err})`) })
ips.on('init', () => { log.info("IPS successfully initialized") })
ips.on('change', () => { 

  log.info(`IPS Change: ${ips.temperature}c, ${ips.humidity.toFixed(0)}%, ${ips.pressure.toFixed(3)}hPa`)
  rov.environment.internalPressure = ips.pressure
  rov.environment.internalTemp = ips.temperature
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
 const key = fs.readFileSync('assets/server.key');
 const cert = fs.readFileSync('assets/server.cert');
 
 app.use('/', express.static(__dirname+'/client'))
 const webServer = https.createServer({ key, cert }, app).listen(Configuration.port, Configuration.ip, () => { log.info(`Webserver started on port: ${Configuration.port}`) })
 

/************************
 *
 * Web socket start
 *
 ************************/
const wss = new ws.WebSocketServer({ perMessageDeflate: false, server: webServer })
log.info(`Websocket: Listning on ${Configuration.socketPort}`)
wss.on('connection', function(client) {

  client.ip = client._socket.remoteAddress;
  client.port = client._socket.remotePort;

  log.info(`Websocket: Remote connection from: ${client.ip}:${client.port}`)
  log.add(log.socketIOTransport, client)
  log.info('Websocket: Starting heartbeat')


  client.heartbeat = new HeartbeatController();

  client.heartbeat.on("timeout", () => {
    log.warn(`Heartbeat timeout, disarm ROV (${client.ip}:${client.port})`)
    rov.disarm()
  });
  client.heartbeat.on('beat', (data, latency) => { client.send(`hb ${data} ${latency}`) });
  client.heartbeat.start();

  client.on('message', parseWebsocketData)
  client.on('close', () => {
    log.info(`Websocket: Close from ${client.ip}:${client.port}`)

    rov.disarm()
    log.remove(log.transports.socketIO, client)
    client.heartbeat.stop()
    client.heartbeat.removeAllListeners();
  })
});

wss.broadcast = (package) => wss.clients.forEach((client) => { client.send(package); });


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
  const client = this;

  switch(cmd) {

    case "clog":
      log.info(`Websocket: Client data:  ${cmd} (${JSON.stringify(data)}`);
      break;

    case 'arm':
      log.info(`Websocket: Arm command from ${client.ip}:${client.port}`);
      rov.arm();
      break;

    case 'disarm':
      log.info(`Websocket: Disarm command from ${client.ip}:${client.port}`);
      rov.disarm();
      break;

    case 'togglearm':
      log.info(`Websocket: Arm toggle command from ${client.ip}:${client.port}`);
      rov.toggleArm();
      break;

    case 'hb':
      client.heartbeat.pulse(data[0]);
      break;

    case 'controls':
      log.info(`Websocket: Controls command from ${client.ip}:${client.port}`);
      data = JSON.parse(data.join(' '));
      data = {...{ axes: defaultControls.axes }, ...data};
      rov.controllerInputUpdate(data);
      break;

    default:
      log.warn(`Websocket: Unknown command from ${client.ip}:${client.port}`);
      log.warn(`Websocket: Unknown command: ${cmd} (${JSON.stringify(data)})`);
      break;
  }
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
