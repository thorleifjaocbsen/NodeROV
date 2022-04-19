
const SystemController = require('./js/classes/SystemController')

const sc = new SystemController();



sc.setFan(true);

setInterval(function() {
  sc.getDiskInfo().then(function(disk) {
    console.log("disk", disk);
  });
  
  sc.getMemory().then(function(mem) {
    console.log("memory", mem);
  })
  
  sc.getCPULoad().then(function(load) {
    console.log("load", load);
  })
  
  sc.getCoreTemperature().then(function(temp) { 
    console.log("temp", temp);
  });
}, 1000);

// process.on('SIGINT', sc.sigint);

// ['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException', 'SIGTERM'].forEach((eventType) => {
//   process.on(eventType, sc.exit.bind());
// })