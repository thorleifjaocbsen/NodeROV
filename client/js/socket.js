Socket = function() {
  var self = {
    ws : null,
    callbacks : {},
    reconnectTime : 5,
    ip : null,
    port : null,
    
  }
  
  self.log = function(data) {
    console.log(data);
  }
  
  self.connect = function(ip, port) {
    self.ip = ip;
    self.port = port;
    self.ws = new WebSocket('ws://'+ip+':'+port)
    self.ws.onopen = self.onopen;
    self.ws.onclose = self.onclose;
    self.ws.onerror = self.onerror;
    self.ws.onmessage = self.onmessage;
    self.ws.binaryType = 'arraybuffer';

  }
  
  self.reconnect = function() {
    self.log('Reconnecting to '+self.ip+':'+self.port)
    self.connect(self.ip, self.port);
  }
  
  self.onerror = function(e) {
    // Error
  }
  
  self.onopen = function(e) {
    self.log('Connected to '+self.ip+':'+self.port)
  }
  
  self.onclose = function(e) {   
    if(self.reconnectTime > 0) {
      setTimeout(self.reconnect, self.reconnectTime*1000); 
      self.log('Lost connection with socket on '+self.ip+':'+self.port+', reconnecting in '+self.reconnectTime+' seconds.');
    }
    else {
      self.log('Lost connection with socket on '+self.ip+':'+self.port);
    }
  }
  
  
  
  self.onmessage = function(e) {
    if(typeof e.data == 'string') {
      var cmd = e.data.split(' ')[0];
      var data = e.data.substr(cmd.length+1);
      if (typeof self.callbacks[cmd] == 'function') {
        self.callbacks[cmd](data);
      }
      else self.log('Unknown data: '+e.data);

    }
  }
  
  self.send = function(data) {
    try { self.ws.send(data); }
    catch(e) {}
  }
  
  self.on = function(cmd, callback) {
    self.callbacks[cmd] = callback;
  }
  
  return self;
}