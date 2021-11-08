// silly - debug - verbose - info - warn - error  

const winston  = require('winston');

const log = new winston.Logger({
  level: 'info', 
  transports: [
    new winston.transports.Console({
      timestamp: (new Date()).toLocaleTimeString(),
      colorize: true,
      level : 'silly'
    }),

    new winston.transports.File({ 
      filename: 'logs/'+new Date().toISOString().split('T')[0]+'.log',
      level: 'info'  
    })
  ]
});

log.socketIOTransport = function (client) {
    this.name  = 'socketIO';
    this.level = 'info';
    this.client = client;
    this.log = function(level, msg) {  
      if(msg.substr(0,6) == "CLIENT") { return; }  
      client.send("log " + JSON.stringify({ type : 'log', level : level, message : msg, time : Date.now() }));
    };
    this.on = function() { };
    this.removeListener = function() {};
};

module.exports = log;