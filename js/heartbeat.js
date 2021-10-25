/*
 * Hearth Beat Helper
 * Author: Thorleif Jacobsen
 */


// module.exports = class HeartBeat {

//   constructor(options) {
//     let default_values = {
//       idlePWM: 1500,
//       maxPWM: 2000,
//       minPWM: 1000,
//       motors: []
//     }


// }

Heartbeat = function () {
  var self = {
    socket    : null,
    log       : function() {},
    frequency : 1,
    latency   : 0,
    starttime : 0,
    timeout   : 2,
    connected : false,
    offTime   : 0,
    timer     : null
  }
  
  self.start = function(socket) {
    self.stop();
    self.socket = socket;
    self.startime = 0;
    self.offTime = 0;
    self.beat();
  }
  
  self.stop = function() {
    clearTimeout(self.timer);
    self.socket = null;
    self.timer = null;
    self.startime = 0;
  }
 
  self.beat = function() {
    if(self.socket == null) return;
    if(self.starttime == 0) {
      self.starttime = Date.now();
      self.socket.send('hb '+self.starttime+' '+self.latency); 
    } else {
      // No heartbeat received in a while?
      self.latency = Date.now() - self.starttime;

      if(self.latency > (self.timeout*1000)) { //
        // Packet not responded on, trying to ship out a
        // new packet instead
        self.starttime = 0;
        self.connected = false;
        self.offTime += self.timeout;
        self.log("warn", "HB: No response the last "+self.timeout+" sec, client timeout!");
      }
    }
    self.timer = setTimeout(self.beat, self.frequency*1000);
  }

  self.pulse = function(data) {
    if(data == self.starttime) {
      self.latency = Math.ceil((Date.now() - data) / 2);
      self.starttime = 0;
      self.connected = true;
      self.log("debug", "HB: Latency: "+self.latency+'ms')
    }
    else {
      self.log("warn", "HB: Last response was not expected. Disregarding it. ("+data+")");
    }
  }
  
  return self;
}

module.exports = Heartbeat();
