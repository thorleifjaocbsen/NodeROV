/*
  Created by TJWeb 2017 
  www.tjweb.no 
  thorleif@tjweb.no
  
  Datasheet: http://www.mouser.com/ds/2/418/MS5837-30BA-736494.pdf
  Model: MS5837 30BA
*/

var i2c = require('i2c');

var ADC_READ   = 0x00,
    CONVERT_D2 = 0x5A,
    CONVERT_D1 = 0x4A,
    RESET      = 0x1E,
    PROM_READ  = 0xA0;

module.exports = function(address, device) {

  var self = {
    address      : (typeof address !== 'undefined') ?  address : 0x76,
    device       : (typeof device !== 'undefined') ?  device : '/dev/i2c-1',
    fluidDensity : 1029,
    pressure     : 0,
    temperature  : 0,
    D1           : 0,
    D2           : 0,
    C            : [],
  }

  self.i2c = new i2c(self.address, {device: self.device}),
  self.log = function(level, data) { console.log(level.toUpperCase() + ": " + data); }
  
  // Basic sleep function
  self.sleep = function(ms) {
    var waitTill = new Date(new Date().getTime() + ms);
    while(waitTill > new Date()){} 
    return true; 
  }
  
  // Initializer, needs to be run after changing frequency
  self.initialize = function() {
  	// Reset the MS5837, per datasheet
    self.i2c.writeBytes(RESET, [], function() {});
    
    // Wait for reset to complete
    self.sleep(10);
    
  	// Read calibration values and CRC
  	for(i = 0; i < 8; i++) {
    	var b = self.i2c.readBytes(PROM_READ+i*2, 2, function(err,b) {});
      self.C[i] = b[0] << 8 | b[1];
    }
        
  	// Verify that data is correct with CRC
  	var crcRead = self.C[0] >> 12;
  	var crcCalculated = self.crc4(self.C);
    
    // Success
  	if ( crcCalculated == crcRead ) { self.log("info", "MS5387: CRC4 check success and intializing."); } 
  	// Failure - try again?
  	else { self.log("warn", "MS5387: Failure CRC4 check, please try initializign and check every connection again."); return false; }

  }

  
  self.readSensor = function() {
    var bytes;
    
	  // Request D1 conversion
    self.i2c.writeBytes(CONVERT_D1, [], function() {});
    self.sleep(20); // Max conversion time per datasheet
    bytes   = self.i2c.readBytes(ADC_READ, 3, function(err,b) {});
    self.D1 = bytes[2] | bytes[1] << 8 | bytes[0] << 16;

	  // Request D2 conversion
    self.i2c.writeBytes(CONVERT_D2, [], function() {});
    self.sleep(20); // Max conversion time per datasheet
    bytes   = self.i2c.readBytes(ADC_READ, 3, function(err,b) {});
    self.D2 = bytes[2] | bytes[1] << 8 | bytes[0] << 16;

    // Calculation or depth + pressure
    var dT   = parseInt(self.D2 - self.C[5] * Math.pow(2,8));
    var TEMP = parseInt(2000 + (dT * self.C[6] / Math.pow(2,23)));
    
    var OFF  = parseInt(self.C[2] * Math.pow(2,16) + (self.C[4]*dT)/Math.pow(2,7));
    var SENS = parseInt(self.C[1] * Math.pow(2,15) + (self.C[3]*dT)/Math.pow(2,8));
    
    var P    = parseInt((self.D1 * SENS / Math.pow(2,21) - OFF) / Math.pow(2,13));
    
    //Second order compensation for super accuracy
	  var Ti, OFFi, SENSi;
	  
		if((TEMP/100)<20){         //Low temp
  		Ti    = 3 * Math.pow(dT,2) / Math.pow(2,33);
  		OFFi  = 3 * Math.pow(TEMP - 2000,2) / Math.pow(2,1);
  		SENSi = 5 * Math.pow(TEMP - 2000,2) / Math.pow(2,3);
    }
    if((TEMP/100)<-15){    //Very low temp
  		OFFi  = OFFi + 7 * Math.pow(TEMP + 1500,2);
  		SENSi = SENSi + 4 * Math.pow(TEMP - 1500,2);
		}
		else if((TEMP/100)>=20){    //High temp
  		Ti    = 2 * Math.pow(dT,2) / Math.pow(2,37);
  		OFFi  = 1 * Math.pow(TEMP - 2000,2) / Math.pow(2,4);
  		SENSi = 0;
		}
		
		var OFF2  = OFF - OFFi;
		var SENS2 = SENS - SENSi;
		var TEMP2 = (TEMP-Ti) / 100;
		var P2    = (((self.D1 * SENS2) / Math.pow(2,21) - OFF2) / Math.pow(2,13)) / 10;
		
    self.pressure    = P2; // mBar
    self.temperature = TEMP2; // Celcius
  }
  
  self.depth = function() {
           // Numbers: 9.80665 = 1Gforce
           // Numbers: 101300Pascal at sea level (1013.25mBar)
    var pascal = self.pressure * 100;
    return (pascal-101300) / (self.fluidDensity*9.80665);
  }
  
  self.altitude = function() {
           // Numbers: .3048 = convert from feet to meters
           // Numbers: 1013.25 = mBar at sea level
           // Numbers: 145366.45 = No freaking idea
    return (1 - Math.pow(pres/1013.25, .190284)) * 145366.45 * .3048;
  } 
      
  self.setTestCase = function() {
		self.C[0] = 0;
		self.C[1] = 34982;
		self.C[2] = 36352;
		self.C[3] = 20328;
		self.C[4] = 22354;
		self.C[5] = 26646;
		self.C[6] = 26146;
		self.C[7] = 0;
		self.D1 = 4958179;
		self.D2 = 6815414;
  }

  self.setFluidDensity = function(density) {
  	self.fluidDensity = density;
  }
  
  self.crc4 = function(n_prom) {
  	var n_rem = 0;
  	n_prom[0] = n_prom[0] & 0x0FFF;
  	n_prom[7] = 0;
  	for ( var i = 0 ; i < 16; i++ ) {
  		if ( i%2 == 1 ) { n_rem ^= n_prom[i>>1] & 0x00FF; } 
  		else { n_rem ^= n_prom[i>>1] >> 8;	}
  		for ( var n_bit = 8 ; n_bit > 0 ; n_bit-- ) {
  			if ( n_rem & 0x8000 ) { n_rem = (n_rem << 1) ^ 0x3000; } 
  			else { n_rem = (n_rem << 1); }
  		}
  	}
  	n_rem = ((n_rem >> 12) & 0x000F);
  	return n_rem ^ 0x00;
  }
  
  return self;
}