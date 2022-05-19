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
const sc = new SystemController();
const pwm = new PCA9685();

/************************
 *
 * PWM Initialization
 *
 ************************/
pwm.init()
  .then(() => log.info("PWM Initialized"))
  .catch((err) => log.warn(err))
  .then(() => {
    rov.setLight(0);
    rov.centerCamera();
    rov.disarm(true);
  })
  .catch((err) => console.log(err))


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
    pwm.setPWM(output.pin, 1550);
  })

  wss.broadcast(`ts ${JSON.stringify(output)}`);

});
rov.on('dataChanged', (type, value) => {
  wss.broadcast(`data ${JSON.stringify({ type, value })}`)
  log.debug(`Data variable ${type} changed to ${value}`);
});

rov.on('lightChange', (newPercentage) => {
  let us = 1100; // Off!
  if (newPercentage > 0) { us = rov.map(newPercentage, 0, 100, 1300, 1900); }
  pwm.setPWM(6, us).catch((err) => console.log(err));
  pwm.setPWM(7, us).catch((err) => console.log(err));
})

rov.on('cameraChange', (newPercentage) => {
  let us = rov.map(newPercentage, 0, 100, 1100, 1950);
  pwm.setPWM(8, us).catch((err) => console.log(err));
})

rov.on('gripperChange', (newState) => {
  console.log("gripperChange", newState);
  return;
  if (newState == -1) { pwm.setPWM(9, 1400); }
  else if (newState == 1) { pwm.setPWM(9, 1600); }
  else { pwm.setPWM(9, 1550); }
})

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
  rov.update("iPressure", ips.getPressure());
  rov.update("iTemperature", ips.getTemperature());
  rov.update("iHumidity", ips.getHumidity());
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
  })
  .then(() => imu.calibrateAccelGyroBias())
  .catch((err) => log.error(`IMU calibration failed (${err})`));

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

  /* Update client with ROV data */
  let rovData = rov.getROVData();
  for (let type in rovData) {
    log.debug(`Sending data to client ${client.ip}:${client.port}: type: ${type}, value ${rovData[type]}, typeof: ${typeof rovData[type]}`)
    client.send(`data ${JSON.stringify({ type, value: rovData[type] })}`)
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
      //log.info(`Websocket: Client data:  ${cmd} (${JSON.stringify(data)}`);
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
      if (data[0] < -10) {
        rov.gripperState(-1);
      }
      else if (data[0] > 10) {
        rov.gripperState(1);
      }
      else {
        rov.gripperState(0);
      }

      break;

    case 'setflat':
      console.log("I should go flat now ! how the heck do I do that?");
      //imu.calibrateLevel();
      imu.calibrateMagnometerBias();
      break;

    case 'calibrateAccelGyroBias':
      imu.calibrateAccelGyroBias();
      break;

    case 'resetMahCounter': // OK
      adc.resetAccumulatedMah();
      break;
    case 'lateral': // OK
    case 'forward': // OK
    case 'yaw': // OK
    case 'ascend': // OK
    case 'adjustLight': // OK
    case 'adjustGain': // OK
    case 'adjustCamera': // OK 
    case 'centerCamera': // OK
    case 'headingHoldToggle': // OK
    case 'depthHoldToggle': // OK
      try {
        rov.command(cmd, data[0]);
      }
      catch (err) {
        log.warn(`Failed to execute ROV command, error was: ${err}`);
      }
      break;

    default:
      log.warn(`Websocket: Unknown command from ${client.ip}:${client.port}`);
      log.warn(`Websocket: Unknown command: ${cmd} (${JSON.stringify(data)})`);
      break;
  }
}