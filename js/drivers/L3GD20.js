/*
  Created by TJWeb 2017
  www.tjweb.no
  thorleif@tjweb.no

  Datasheet: https://www.pololu.com/file/0J731/L3GD20H.pdf
  Model: L3GD20H
*/

var i2c = require('i2c');

var WHO_AM_I  = 0x0f,
    CTRL_REG1 = 0x20,
    CTRL_REG2 = 0x21,
    CTRL_REG3 = 0x22,
    CTRL_REG4 = 0x23,
    CTRL_REG5 = 0x24,
    OUT_X_L   = 0x28,
    OUT_X_H   = 0x29,
    OUT_Y_L   = 0x2a,
    OUT_Y_H   = 0x2b,
    OUT_Z_L   = 0x2c,
    OUT_Z_H   = 0x2d,
    OUT_TEMP  = 0x26,
    LOW_ODR   = 0x39;

module.exports = function(address, device) {
  var self = {
    address:(typeof address !== 'undefined') ?  address : 0x6b,
    device :(typeof device !== 'undefined') ?  device : '/dev/i2c-1',
    resolution : 0.00875, // Default 250dps res
    calibrateCount: 0,
    offset : {x:0,y:0,z:0},
    x      : 0,
    y      : 0,
    z      : 0,
    raw    : {x:0,y:0,z:0}
  }

  self.i2c = new i2c(self.address, {device: self.device}),

  self.setResolution = function(res) {
    if(res == 250)  { self.resolution = 0.00875; self.i2c.writeBytes( CTRL_REG4 , [0x00], function(err,data){}); }
    if(res == 500)  { self.resolution = 0.0175;  self.i2c.writeBytes( CTRL_REG4 , [0x10], function(err,data){}); }
    if(res == 2000) { self.resolution = 0.07;    self.i2c.writeBytes( CTRL_REG4 , [0x20], function(err,data){}); }
  }

  self.initialize = function() {
    var whoAmI = self.i2c.readBytes( WHO_AM_I , 1, function(err,data){});
    if(whoAmI[0] != 0xD7) { return false; }
    self.resetGyro();
    self.setResolution(250);
    self.enableGyro();
    return true;
  }

  self.calibrate = function(samples, ms) {
    if(self.calibrationNumber == 0) { self.offset = {x:0,y:0,z:0}; }

    if(samples <= 0) {
      self.saveCalibration();
      return;
    }

    setTimeout(function() {
      self.readSensor()
      self.offset.x += self.raw.x;
      self.offset.y += self.raw.y;
      self.offset.z += self.raw.z;
      self.calibrateCount ++;
      self.calibrate(samples-1, ms);
    }, ms);
  }

  self.saveCalibration = function() {
    self.offset.x /= self.calibrateCount;
    self.offset.y /= self.calibrateCount;
    self.offset.z /= self.calibrateCount;
    self.calibrateCount = 0;
  }

  self.enableGyro = function() {
    self.i2c.writeBytes( CTRL_REG1 , [0x0f], function(err,data){});
  }

  self.disableGyro = function() {
    self.i2c.writeBytes( CTRL_REG1 , [0x00], function(err,data){});
  }

  self.resetGyro = function() {
    self.i2c.writeBytes( LOW_ODR , [0x04], function(err,data){});
  }

  self.readSensor = function() {
    var b = self.i2c.readBytes( OUT_X_L | 0x80 , 6, function(err,data){});

    self.raw.x = b[0] | b[1] << 8;
    self.raw.z = b[2] | b[3] << 8; // Swapped Z and Y cuz of 90deg rotate, hack!!)
    self.raw.y = b[4] | b[5] << 8;

    if(self.raw.x > 32767) self.raw.x -= 65535;
    if(self.raw.y > 32767) self.raw.y -= 65535;
    if(self.raw.z > 32767) self.raw.z -= 65535;

    self.raw.z = self.raw.z *-1;
    self.raw.y = self.raw.y *-1;

    // Calibration offset (only if NOT calibrating!)
    if(self.calibrateCount == 0) {
      self.raw.x -= self.offset.x;
      self.raw.y -= self.offset.y;
      self.raw.z -= self.offset.z;
    }

    self.x = self.raw.x * self.resolution;
    self.y = self.raw.y * self.resolution;
    self.z = self.raw.z * self.resolution;
  }

  self.measureTemperature = function(){
    var data = self.i2c.readBytes( OUT_TEMP , 1, function(err,data){});
    var range = 125;  // -40℃ to +85℃
    var tmp = (data.readInt8() + 128) / 256 * range - 40;
    return tmp;
  }

  return self;
}
