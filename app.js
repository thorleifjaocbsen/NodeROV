/*
 * NodeROV - Application
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

require('./ascii');

const ws = require('ws');
const fs = require('fs');
const express = require('express');
const app = express();
const https = require('https');
const log = require('./js/Log.js');

console.log = log.warn;
console.error = log.error;

const Configuration = require('./configuration.json');
const defaultControls = require('./controls.json');
const RemoteOperatedVehicle = require('./js/classes/RemoteOperatedVehicle');
const AuxiliaryController = require('./js/classes/AuxiliaryController');
const HeartbeatController = require('./js/classes/Heartbeat');
const InternalPressureSensor = require('./js/classes/InternalPressureSensor');
const ExternalPressureSensor = require('./js/classes/ExternalPressureSensor');
const AnalogDigitalConverter = require('./js/classes/AnalogDigitalConverter');
const InertialMeasurementUnit = require('./js/classes/InertialMeasurementUnit');
const SystemController = require('./js/classes/SystemController');

const PCA9685 = require('./js/drivers/PCA9685.js');
const pca9685 = new PCA9685();
pca9685.init()
.then(() => console.log("PWM Initialized"))
.catch((err) => console.log(err));



/************************
 *
 * Initialize scripts
 *
 ************************/
const aux = new AuxiliaryController(Configuration.auxiliary);
const rov = new RemoteOperatedVehicle(Configuration.rov);
const ips = new InternalPressureSensor();
const eps = new ExternalPressureSensor(true, 100);
const imu = new InertialMeasurementUnit();
const adc = new AnalogDigitalConverter(Configuration.calibration.adc);
const sc  = new SystemController();

/************************
 *
 * ROV Event Handlers
 *
 ************************/
rov.on('arm', () => { log.info('ROV Armed') })
rov.on('disarm', () => { log.info('ROV Disarmed') })
rov.on('thusterOutputChanged', (output) => {
  output.forEach((output) => {
    log.info(`Pin: ${output.pin} = ${output.us}us`);
    pca9685.setPWM(output.pin, output.us);


  })

  wss.broadcast(`ts ${JSON.stringify(output)}`);

});
rov.on('environmentChanged', (variable, value) => {
  wss.broadcast("env " + variable + " " + value);
  log.debug(`Environment variable ${variable} changed to ${value}`);
});

/************************
 *
 * Internal Pressure Sensor
 *
 ************************/
ips.on('initError', (err) => log.error(`Internal Pressure Sensor initializing failed (${err})`))
ips.on('readError', (err) => log.error(`Internal Pressure Sensor read failed (${err})`))
ips.on('init', () => log.info("Internal Pressure Sensor successfully initialized"))
ips.on('change', () => {

  log.debug(`IPS Change: ${ips.temperature}c, ${ips.humidity.toFixed(0)}%, ${ips.pressure.toFixed(3)}hPa`)
  rov.update("iPressure", ips.pressure);
  rov.update("iTemperature", ips.temperature);
  rov.update("iHumidity", ips.humidity);
})

/************************
 *
 * External Pressure Sensor
 *
 ************************/
eps.on('initError', (err) => log.error(`External Pressure Sensor initializing failed (${err})`));
eps.on('readError', (err) => log.error(`External Pressure Sensor read failed (${err})`));
eps.on('init', () => log.info('External Pressure Sensor Initialized'));
eps.on('read', () => {

  log.debug(`EPS Read: ${eps.temperature()}c, ${eps.pressure()}psi, ${eps.depth()}m depth`);
  rov.update("ePressure", eps.pressure());
  rov.update("eTemperature", eps.temperature());
  rov.update("depth", eps.depth());
});


/************************
 *
 * Analog Digital Converter (ADC)
 *
 ************************/
adc.on('init', () => { log.info("ADC successfully initialized") })
adc.on('read', () => {

  log.debug(`ADS1015 Read: ${adc.getCurrent().toFixed(3)}a, ${adc.getVoltage().toFixed(2)}v, Leak: ${adc.getLeak()}, ${adc.getAccumulatedMah()}mAh`);
  rov.update("voltage", adc.getVoltage());
  rov.update("current", adc.getCurrent());
  rov.update("leak", adc.getLeak());
  rov.update("accumulatedMah", adc.getAccumulatedMah());
})

/************************
 *
 * Inertial Measurement Unit (IMU) 10hz update frequency
 *
 ************************/
imu.init(true, 10)
.then(() => {
  log.info("IMU successfully initialized");
  imu.on('read', () => {
    log.debug(`IMU Read: ${imu.getRoll()}deg, ${imu.getPitch()}deg, ${imu.getHeading()}deg`);
    rov.update("roll", imu.getRoll());
    rov.update("pitch", imu.getPitch());
    rov.update("heading", imu.getHeading());
  });

  imu.on('readError', (err) => log.error(`IMU read failed (${err})`));
})
.catch((err) => {
  log.error(`IMU initialization failed (${err})`);
});

/************************
 *
 * System Controller
 *
 ************************/
sc.on('read', () => {

  log.debug(`System Controller: temp=${sc.cpuTemperature}c, load=${sc.cpuLoad}%, memory=${sc.memory}%, disk=${sc.disk}%`);
  rov.update("cpuTemperature", sc.cpuTemperature);
  rov.update("cpuLoad", sc.cpuLoad);
  rov.update("memoryUsed", sc.memory);
  rov.update("diskUsed", sc.disk);
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
log.log('info', 'Starting webserver')
const key = fs.readFileSync('assets/server.key');
const cert = fs.readFileSync('assets/server.cert');

app.use('/', express.static(__dirname + '/client'));
app.use('/controls.json', express.static(__dirname + '/controls.json'));
const webServer = https.createServer({ key, cert }, app).listen(Configuration.port, Configuration.ip, () => { log.info(`Webserver started on port: ${Configuration.port}`) })


/************************
 *
 * Web socket start
 *
 ************************/
const wss = new ws.WebSocketServer({ perMessageDeflate: false, server: webServer })
log.info(`Websocket: Listning on ${Configuration.socketPort}`)
wss.on('connection', (client) => {

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
    log.remove(`socket_${client._socket.remoteAddress}:${client._socket.remotePort}`, client)
    client.heartbeat.stop()
    client.heartbeat.removeAllListeners();
  });

  /* Update client of env data */
  let rovEnv = rov.getEnviromentData();
  for (let type in rovEnv) {
    log.debug(`Sending enviroment data to client ${client.ip}:${client.port}: type: ${type}, value ${rovEnv[type]}, typeof: ${typeof rovEnv[type]}`)
    client.send(`env ${type} ${rovEnv[type]}`);
  }


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

  switch (cmd) {

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

    case 'gripper':
      const newState = data[0];
      let usData2 = rov.map(newState, -100, 100, 1000, 2000);
      console.log(newState,usData2);

      if(newState < -10) {
        pca9685.setPWM(9, 1400);
      }
      else if(newState > 10) {
        pca9685.setPWM(9, 1600);
      }
      else {
        pca9685.setPWM(9, 1550);
      }
      //rov.gripperOpen()
      break;

    case 'camera':
      cameraPercentage += parseInt(data[0]);
      if(cameraPercentage > 100) cameraPercentage = 100;
      if(cameraPercentage < 0) cameraPercentage = 0;
      let usData = rov.map(cameraPercentage, 0, 100, 700, 2400);
      console.log(usData,cameraPercentage);
      pca9685.setPWM(8, usData);
      break;

    case 'cameraCenter':
      cameraPercentage = 45;
      let usDataCenter = rov.map(cameraPercentage, 0, 100, 1000, 2000);
      console.log(usDataCenter,cameraPercentage);
      pca9685.setPWM(8, usDataCenter);
      break;

    case 'setflat':
      console.log("I should go flat now ! how the heck do I do that?");
      //imu.calibrateLevel();
      imu.calibrateMagnometerBias();
      break;

    case 'calibrategyro':
      console.log("I should calibrate the gyro now ! how the heck do I do that?");
      imu.calibrateAccelGyroBias();
      break;

    case 'lateral':
    case 'forward':
    case 'yaw':
    case 'ascend':
    case 'headingHold':
    case 'fullScreen':
    case 'depthHold':
    case 'camera':
    case 'gripper':
    case 'disarm':
    case 'arm':
    case 'gainIncrement':
    case 'gainDecrement':
    case 'light':
      rov.command(cmd, data[0]);
      break;

    default:
      log.warn(`Websocket: Unknown command from ${client.ip}:${client.port}`);
      log.warn(`Websocket: Unknown command: ${cmd} (${JSON.stringify(data)})`);
      break;
  }
}

let cameraPercentage = 50;



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
