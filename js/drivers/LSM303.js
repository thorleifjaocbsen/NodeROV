/*
  Created by TJWeb 2017
  www.tjweb.no
  thorleif@tjweb.no

  Datasheet: http://www.st.com/content/ccc/resource/technical/document/datasheet/56/ec/ac/de/28/21/4d/48/DM00027543.pdf/files/DM00027543.pdf/jcr:content/translations/en.DM00027543.pdf
  Model: LSM303
*/

var i2c = require('i2c');
var CTRL_REG1 = 0x20,
    CTRL_REG2 = 0x21,
    CTRL_REG3 = 0x22,
    CTRL_REG4 = 0x23,
    CTRL_REG5 = 0x24,
    OUT_X_L_A = 0x28,
    MR_REG_M  = 0x02,
    CRA_REG_M = 0x00,
    CRB_REG_M = 0x01,
    OUT_X_H_M = 0x03;



module.exports = function(acc, mag, device) {
  var self = {
    accAddress: (typeof acc !== 'undefined') ?  acc : 0x19,
    magAddress: (typeof mag !== 'undefined') ?  mag : 0x1E,
    device    : (typeof device !== 'undefined') ?  device : '/dev/i2c-1',

    acc       : {
      raw     : { x: 0, y: 0, z: 0 },
      g       : { x: 0, y: 0, z: 0 },
      scale   : 4,
      max     : { x: 0, y: 0, z: 0 },
      min     : { x: 0, y: 0, z: 0 },
      offset  : { x: 0, y: 0, z: 0 },
      flat    : { roll: 0, pitch: 0 }
    },
    mag       : {
      threshold   : 10,
      avrgcounter : 0,
      raw     : { x: 0, y: 0, z: 0 },
      maraw   : { x: 0, y: 0, z: 0 },
      mtesla  : { x: 0, y: 0, z: 0 },
      max     : { x: 0, y: 0, z: 0 },
      min     : { x: 0, y: 0, z: 0 },
      offset  : { x: 0, y: 0, z: 0 },
      flat    : { x: 0, y: 0, z: 0 }
    },
    heading   : 0,
    roll      : 0,
    pitch     : 0,
    rollRaw   : 0,
    pitchRaw  : 0,
  }

  self.acc.i2c = new i2c(self.accAddress, {device: self.device}),
  self.mag.i2c = new i2c(self.magAddress, {device: self.device}),

  self.initialize = function() {
    // Normal / low-power mode (100 Hz)
    // Enable X Y and Z
    // 0101 0111
    self.acc.i2c.writeBytes(CTRL_REG1, [0x57], function() {});
    // Set accelerometer scale
    self.setAccScale(4);
    // Enable magnometer with "Continuous-conversion mode"
    self.mag.i2c.writeBytes(MR_REG_M, [0x00], function(err) {});
    // Set gain to bin 00100000
    // GN = 001 (+/- 1.3 gauss full scale)
    self.mag.i2c.writeBytes(CRB_REG_M, [0x20], function(err) {});
    // Enable temp sensor and set data rate to 15hz
    self.mag.i2c.writeBytes(CRA_REG_M, [0x90], function(err) {});

  }


  self.setAccScale = function(scale) {
    let bytes;
    if(scale == 16)     bytes = 0x38;  // 0011 1000 // 16G
    else if(scale == 8) bytes = 0x28;  // 0010 1000 // 8G
    else if(scale == 4) bytes = 0x18;  // 0001 1000 // 4G
    else if(scale == 2) bytes = 0x08;  // 0000 1000 // 2G
    else { return; }

    // bit = Full-scale selection. +- 'SCALE' G && High resolution output mode

    self.acc.i2c.writeBytes(CTRL_REG4, [bytes], function() {});
    self.acc.scale   = scale;
  }

  self.calibrate = function() {
    var ret = false;
    if(self.acc.raw.x > self.acc.max.x) { self.acc.max.x = self.acc.raw.x; ret = true; console.log("max acc X",self.acc.raw.x); }
    if(self.acc.raw.x < self.acc.min.x) { self.acc.min.x = self.acc.raw.x; ret = true; console.log("min acc X",self.acc.raw.x); }
    if(self.acc.raw.y > self.acc.max.y) { self.acc.max.y = self.acc.raw.y; ret = true; console.log("max acc Y",self.acc.raw.x); }
    if(self.acc.raw.y < self.acc.min.y) { self.acc.min.y = self.acc.raw.y; ret = true; console.log("min acc Y",self.acc.raw.x); }
    if(self.acc.raw.z > self.acc.max.z) { self.acc.max.z = self.acc.raw.z; ret = true; console.log("max acc Z",self.acc.raw.x); }
    if(self.acc.raw.z < self.acc.min.z) { self.acc.min.z = self.acc.raw.z; ret = true; console.log("min acc Z",self.acc.raw.x); }

    if(self.mag.raw.x > self.mag.max.x) { self.mag.max.x = self.mag.raw.x; ret = true; console.log("max mag X",self.mag.raw.x); }
    if(self.mag.raw.x < self.mag.min.x) { self.mag.min.x = self.mag.raw.x; ret = true; console.log("min mag X",self.mag.raw.x); }
    if(self.mag.raw.y > self.mag.max.y) { self.mag.max.y = self.mag.raw.y; ret = true; console.log("max mag Y",self.mag.raw.x); }
    if(self.mag.raw.y < self.mag.min.y) { self.mag.min.y = self.mag.raw.y; ret = true; console.log("min mag Y",self.mag.raw.x); }
    if(self.mag.raw.z > self.mag.max.z) { self.mag.max.z = self.mag.raw.z; ret = true; console.log("max mag Z",self.mag.raw.x); }
    if(self.mag.raw.z < self.mag.min.z) { self.mag.min.z = self.mag.raw.z; ret = true; console.log("min mag Z",self.mag.raw.x); }

    return ret;
  }

  self.finishCalibration = function() {
    self.mag.offset.x = (self.mag.min.x + self.mag.max.x) / 2;
    self.mag.offset.y = (self.mag.min.y + self.mag.max.y) / 2;
    self.mag.offset.z = (self.mag.min.z + self.mag.max.z) / 2;
  }

  self.setFlat = function() {
    self.acc.flat.roll = self.rollRaw * -1
    self.acc.flat.pitch = self.pitchRaw * -1
  console.log(self.acc.flat);
  }
  self.readSensor = function() {
    self.readAccSensor();
    self.readMagSensor();

    // Calculate roll and pitch
    var Xa = self.acc.g.x;
    var Ya = self.acc.g.y;
    var Za = self.acc.g.z;
    var Xm = self.mag.mtesla.x;
    var Ym = self.mag.mtesla.y;
    var Zm = self.mag.mtesla.z;
    var Phi, Theta, Psi, Xh, Yh;

    // roll: Rotation around the X-axis. -180 <= roll <= 180
    // a positive roll angle is defined to be a clockwise rotation about the positive X-axis
    //
    //                    y
    //      roll = atan2(---)
    //                    z
    //
    // where:  y, z are returned value from accelerometer sensor
    Phi = Math.atan2(Ya, Za);

    // pitch: Rotation around the Y-axis. -180 <= roll <= 180
    // a positive pitch angle is defined to be a clockwise rotation about the positive Y-axis
    //
    //                                 -x
    //      pitch = atan(-------------------------------)
    //                    y * sin(roll) + z * cos(roll)
    //
    // where:  x, y, z are returned value from accelerometer sensor
    var tmp =      Ya * Math.sin(Phi) + Za * Math.cos(Phi);
    if (tmp == 0)  Theta = Xa > 0 ? (Math.PI / 2) : (-Math.PI / 2);
    else           Theta = Math.atan(-Xa / tmp);

    // heading: Rotation around the Z-axis. -180 <= roll <= 180
    // a positive heading angle is defined to be a clockwise rotation about the positive Z-axis
    //
    //                                       z * sin(roll) - y * cos(roll)                           < Yh
    //   heading = atan(--------------------------------------------------------------------------)
    //                    x * cos(pitch) + y * sin(pitch) * sin(roll) + z * sin(pitch) * cos(roll))  < Xh
    //
    // where:  x, y, z are returned value from magnetometer sensor
    Yh = Zm * Math.sin(Phi) - Ym * Math.cos(Phi);
    Xh = Xm * Math.cos(Theta) +
         Ym * Math.sin(Theta) * Math.sin(Phi) +
         Zm * Math.sin(Theta) * Math.cos(Phi);
    Psi = Math.atan2(-Yh, Xh);

    // Convert angular data to degree
    Phi   = Phi   * 180 / Math.PI;
    Theta = Theta * 180 / Math.PI;
    Psi   = Psi   * 180 / Math.PI;
    if(Psi < 0) Psi += 360;

    self.rollRaw    = Phi;
    self.pitchRaw   = Theta;
    self.heading    = Psi;

  // Level compensated roll / pitch
  self.roll = self.rollRaw + self.acc.flat.roll;
  self.pitch = self.pitchRaw + self.acc.flat.pitch;
  }

  self.readAccSensor = function() {
    var b = self.acc.i2c.readBytes(OUT_X_L_A | 0x80, 6, function(err,b) {});

    // convert raw values
    self.acc.raw.x = b[0] | b[1] << 8;
    self.acc.raw.y = b[2] | b[3] << 8;
    self.acc.raw.z = b[4] | b[5] << 8;

    // Convert to unsigned int "javascript way"
    if(self.acc.raw.x > 32768) { self.acc.raw.x -= 65536; }
    if(self.acc.raw.y > 32768) { self.acc.raw.y -= 65536; }
    if(self.acc.raw.z > 32768) { self.acc.raw.z -= 65536; }

    //FLAT TEST:


    // convert to G
    self.acc.g.x = self.acc.raw.x / (32768 / self.acc.scale);
    self.acc.g.y = self.acc.raw.y / (32768 / self.acc.scale);
    self.acc.g.z = self.acc.raw.z / (32768 / self.acc.scale);
  }

  self.readMagSensor = function() {
    var b = self.mag.i2c.readBytes(OUT_X_H_M, 6, function(err,b) {});

    // convert raw values
    self.mag.raw.x = b[0] << 8 | b[1];
    self.mag.raw.z = b[2] << 8 | b[3];
    self.mag.raw.y = b[4] << 8 | b[5];

    // Convert to unsigned int "javascript way"
    if(self.mag.raw.x > 32768) { self.mag.raw.x -= 65536; }
    if(self.mag.raw.y > 32768) { self.mag.raw.y -= 65536; }
    if(self.mag.raw.z > 32768) { self.mag.raw.z -= 65536; }

    // Add offset
    self.mag.raw.x -= self.mag.offset.x;
    self.mag.raw.y -= self.mag.offset.y;
    self.mag.raw.z -= self.mag.offset.z;


    // Glitch peeks filter
    //if (Math.abs(self.mag.raw.x - self.mag.maraw.x/self.mag.avrgcounter) > self.mag.threshold) self.mag.raw.x = self.mag.maraw.x / self.mag.avrgcounter;
    //if (Math.abs(self.mag.raw.y - self.mag.maraw.y/self.mag.avrgcounter) > self.mag.threshold) self.mag.raw.y = self.mag.maraw.y / self.mag.avrgcounter;
    //if (Math.abs(self.mag.raw.z - self.mag.maraw.z/self.mag.avrgcounter) > self.mag.threshold) self.mag.raw.z = self.mag.maraw.z / self.mag.avrgcounter;

    // Moving Average filter
    self.mag.maraw.x += self.mag.raw.x;
    self.mag.maraw.y += self.mag.raw.y;
    self.mag.maraw.z += self.mag.raw.z;
    self.mag.avrgcounter ++;

    // Combine average if counter reaches 10
    if(self.mag.avrgcounter >= 10) {

      // convert to microtesla
      self.mag.mtesla.x = (self.mag.maraw.x / self.mag.avrgcounter) / 1100 * 100;
      self.mag.mtesla.y = (self.mag.maraw.y / self.mag.avrgcounter) / 1100 * 100;
      self.mag.mtesla.z = (self.mag.maraw.z / self.mag.avrgcounter) / 980 * 100;

      self.mag.maraw = { x:0, y:0, z:0 }

      self.mag.avrgcounter = 0;
    }




  }

  return self;
}
