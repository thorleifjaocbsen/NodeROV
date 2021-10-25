var i2c = require('i2c');

Battery = function(address, device) {

  var self = {
    address: (typeof address !== 'undefined') ?  address : 0x28,
    device    :(typeof device !== 'undefined') ?  device : '/dev/i2c-1',
    frequency : 50,
    volt : 0,
    mAmp : 0,
    mAmpUsed : 0
  }

  self.i2c = new i2c(self.address, {device: self.device}),
  
  // Basic sleep function
  self.sleep = function(ms) {
    var waitTill = new Date(new Date().getTime() + ms);
    while(waitTill > new Date()){} 
    return true; 
  }
  
  self.readSensor = function() {
    self.updateVoltage();
    self.updateAmperage();
    self.updateAmperageUsed();
  }
  
  self.updateVoltage = function() {
    self.i2c.readBytes(0x02, 4, function(err, b) {
      if(err == null) {
        var mV = b[3] << 24 | b[2] << 16 | b[1] << 8 | b[0] << 0;
        self.volt = (mV / 1000).toFixed(1);
      }
    });
  }
  self.updateAmperage = function() {
    self.i2c.readBytes(0x03, 4, function(err, b) {
      if(err == null) {
        var mA = b[3] << 24 | b[2] << 16 | b[1] << 8 | b[0] << 0;
        self.mAmp = mA;
      }
    });
  }
  self.updateAmperageUsed = function() {
    self.i2c.readBytes(0x04, 4, function(err, b) {
      if(err == null) {
        var mAh = b[3] << 24 | b[2] << 16 | b[1] << 8 | b[0] << 0;
        self.mAmpUsed = mAh;
      }
    });
  }
  
  self.setVoltMultiplier = function(number) {
    var number = Math.round(number*100000);
    var b1 = number >> 0  & 0xFF;
    var b2 = number >> 8  & 0xFF;
    var b3 = number >> 16 & 0xFF;
    var b4 = number >> 24 & 0xFF;    
    self.i2c.writeBytes(0x00, [b1,b2,b3,b4], function() {});   
  }

  self.setAmpMultiplier = function(number) {
    var number = Math.round(number*100000);
    var b1 = number >> 0  & 0xFF;
    var b2 = number >> 8  & 0xFF;
    var b3 = number >> 16 & 0xFF;
    var b4 = number >> 24 & 0xFF;    
    self.i2c.writeBytes(0x01, [b1,b2,b3,b4], function() {});   
  }
  
  return self;
}

module.exports = Battery();
