/*
  Created by TJWeb 2017 
  www.tjweb.no 
  thorleif@tjweb.no
  
  Datasheet: https://cdn-shop.adafruit.com/datasheets/BST-BMP180-DS000-09.pdf
  Model: BMP180
*/

var i2c = require('i2c');

var REG_ADDR = 0xF4;
var PT_READ_REG = 0xF6; // 0xF6 = MSB, 0xF7 = LSB, 0xF8 = XLSB

module.exports = function(address, device) {
  var self = {
    address      :(typeof address !== 'undefined') ?  address : 0x77,
    device       :(typeof device !== 'undefined') ?  device : '/dev/i2c-1',
    cal          : { ac1:0,ac2:0,ac3:0,ac4:0,ac5:0,ac6:0,b1:0,b2:0,mb:0,mc:0,md:0 },
    oss          : 0,
    ut           : 0,
    up           : 0,
    pressure     : 0,
    temperature  : 0,
  }
  
  self.i2c = new i2c(self.address, {device: self.device}),
  
  // Basic sleep function
  self.sleep = function(ms) {
    var waitTill = new Date(new Date().getTime() + ms);
    while(waitTill > new Date()){} 
    return true; 
  }
  
  self.initialize = function() {
    // READ Calibration data from 0xAA to 0xBE
    var b = self.i2c.readBytes(0xAA, 22, function(err, b) {});
    self.cal.ac1 = self.byteToInt(b[0], b[1]);
    self.cal.ac2 = self.byteToInt(b[2], b[3]); 
    self.cal.ac3 = self.byteToInt(b[4], b[5]);
    self.cal.ac4 = self.byteToInt(b[6], b[7]);
    self.cal.ac5 = self.byteToInt(b[8], b[9]);
    self.cal.ac6 = self.byteToInt(b[10], b[11]);
    self.cal.b1  = self.byteToInt(b[12], b[13]);
    self.cal.b2  = self.byteToInt(b[14], b[15]);
    self.cal.mb  = self.byteToInt(b[16], b[17]);
    self.cal.mc  = self.byteToInt(b[18], b[19]);
    self.cal.md  = self.byteToInt(b[20], b[21]); 
  }
  
  self.byteToInt = function(b1, b2) {
    let res = b1 << 8 | b2;
    if(b1 & (1<<7)) { res = 0xFFFF0000 | res; }
    return res;
  }
  
  self.readSensor = function() {
    var bytes, UT, UP, X1,X2,B5,T,B6,X3,B3,B4,B7,P;
    
    // Get UT
    self.i2c.writeBytes(REG_ADDR, [0x2E], function(err) {});
    self.sleep(5); // Minimum conversion time from datasheet (4.5ms);
    
    bytes = self.i2c.readBytes(PT_READ_REG, 2, function(err,b) {});
    UT = self.byteToInt(bytes[0], bytes[1]);
    
    // Get UP
    self.i2c.writeBytes(REG_ADDR, [0x34+(self.oss << 6)], function(err) {});
    self.sleep(5);
    
    bytes = self.i2c.readBytes(PT_READ_REG, 3, function(err,b) {});
    UP = (bytes[0] << 16 | bytes[1] << 8 | bytes[2]) >> (8-self.oss);

    X1 = (UT-self.cal.ac6) * self.cal.ac5 / Math.pow(2,15);  
    X2 = self.cal.mc*Math.pow(2,11)/(X1+self.cal.md);
    B5 = X1+X2;
    T = (B5+8) / Math.pow(2,4);
    
    self.temperature = parseFloat(T / 10);
    
    B6 = B5 - 4000;
    X1 = (self.cal.b2*(B6*B6/Math.pow(2,12))) / Math.pow(2,11);
    X2 = self.cal.ac2 * B6 / Math.pow(2,11);
    X3 = X1+X2;
    B3 = (((self.cal.ac1*4+X3) << self.oss) + 2) / 4;
    X1 = self.cal.ac3 * B6 / Math.pow(2,13);
    X2 = (self.cal.b1*(B6*B6/Math.pow(2,12))) / Math.pow(2,16)
    X3 = ((X1+X2)+2)/Math.pow(2,2);
    B4 = self.cal.ac4 * (X3+32768) / Math.pow(2,15);
    B7 = (UP-B3) * (50000 >> 0);
    P  = 0;
    
    if(B7 < 0x80000000) P = (B7*2)/B4; 
    else P = (B7/B4) * 2;
        X1 = (P / Math.pow(2,8)) * (P/Math.pow(2,8));
        X1 = (X1 * 3038) / Math.pow(2,16);
        X2 = (-7357*P) / Math.pow(2,16);
        P = P + (X1+X2+3791) / Math.pow(2,4);
    
    self.pressure = 0.01 * P;
  }
  
  return self;
}