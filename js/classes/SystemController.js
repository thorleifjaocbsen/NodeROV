
const exec = require('child_process').exec;
const Gpio = require('onoff').Gpio; //include onoff to interact with the GPIO
const EventEmitter = require('stream');

module.exports = class Systemcontroller extends EventEmitter {

  #fan;

  constructor(autoRead = true, readInterval = 10000) {

    super();

    this.#fan = new Gpio(22, 'out');

    // Auto Read Sensor
    this.autoRead = autoRead == true;
    this.readInterval = parseInt(readInterval);
    if (this.readInterval < 1000) { this.readInterval = 1000; }
    if (autoRead) this.read();

    // Default values
    this.memory = { total: 0, used: 0 };
    this.disk = { used: 0, total: 0 };
    this.cpuTemperature = 0;
    this.cpuLoad = 0;
  }

  read() {

    this.getMemory()
      .then(memory => { this.memory = Math.round(memory * 100) / 100; })
      .then(() => this.getDiskInfo())
      .then(disk => { this.disk = Math.round(disk * 100) / 100; })
      .then(() => this.getCoreTemperature())
      .then(temp => { this.cpuTemperature = Math.round(temp * 100) / 100; })
      .then(() => this.getCPULoad())
      .then(load => { this.cpuLoad = Math.round(load); })
      .then(() => this.emit('read'))
      .catch(err => this.emit("readFailed", err))
      .finally(() => {
        if (this.autoRead) {
          setTimeout(() => this.read(), this.readInterval);
        }
      })
  }


  getDiskInfo() {

    return new Promise((resolve, reject) => {

      exec("df -hT / | awk 'BEGIN{''} END{print $4,$5}'", function (error, stdout, stderr) {
        if (error) reject(error);
        const used = parseFloat(stdout.split(" ")[0].trim().slice(0, -1));
        const total = parseFloat(stdout.split(" ")[1].trim().slice(0, -1));
        const percentage = (used / total) * 100;
        resolve(percentage);
      });
    });
  }


  getCoreTemperature() {

    return new Promise((resolve, reject) => {

      exec("cat /sys/class/thermal/thermal_zone0/temp", function (error, stdout, stderr) {
        if (error) reject(error);
        var temp = parseFloat(stdout.trim()) / 1000;
        resolve(temp);
      });
    });
  }

  // CPU Load in percentage
  getCPULoad() {

    return new Promise((resolve, reject) => {

      exec("grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$4+$5)} END {print usage}'", function (error, stdout, stderr) {
        if (error) reject(error);
        var load = parseFloat(stdout.trim());
        resolve(load);
      });
    });
  }

  getMemory() {

    return new Promise((resolve, reject) => {

      exec("free -m | awk '/Mem:/ { print $2,$3 }'", function (error, stdout, stderr) {
        if (error) reject(error);
        const total = parseFloat(stdout.split(" ")[0].trim());
        const used = parseFloat(stdout.split(" ")[1].trim());
        const percentage = (used / total) * 100;
        resolve(percentage);
      });
    });
  }

  setFan(state) {

    return this.#fan.write(state ? 1 : 0);
  }

  exit() {

    return this.#fan.unexport();
  }

}