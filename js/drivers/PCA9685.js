const i2cbus = require('i2c-bus');

module.exports = class PCA9685 {

  constructor(address, device) {  
    this.address = (typeof address !== 'undefined') ? address : 0x40;
    this.device = (typeof bus !== 'undefined') ? device : 1;
    this.frequency = 50;

    this.i2c = i2cbus.openSync(this.device);
  }

  sleep(ms) {
    const waitTill = new Date(new Date().getTime() + ms);
    while (waitTill > new Date()) { }
    return true;
  }

  // Initializer, needs to be run after changing frequency
  init() {
    // Calculate the prescaler based on frequency
    let prescaler = Math.round(25000000 / (4096 * this.frequency)) - 1;
    // Set all PWM to 0
    this.setAllPWM(0);
    // Set all outputs to use a totem pole structure.
    this.send(0x01, 0x04); // MODE2 -> OUTDRV 
    // Set it to respond on call on all i2c busses and sleep (Oscillator off) 
    this.send(0x00, 0x11) // MODE1 -> ALLCALL, SLEEP
    // Sleep 50µS so the oscillator can calm down
    this.sleep(1);
    // Set the prescale to precalculated scale
    this.send(0xFE, prescaler); // PRE_SCALE -> pre-calculated
    // Disable sleep so it can start up the oscillator again 
    this.send(0x00, 0x01); // MODE1 -> ALLCALL   
    // Spee 50µs so the oscillator can start up
    this.sleep(1);
    return true;
  }

  turnOffPWM() {
    this.send(0xFD, 0x10)
  }

  // Usage: setPWM(channel, microsecounds);
  setPWM(no, us) {
    const steps = this.usToSteps(us);
    // 0x06 -> 0x09 (LED0_ON_L,LED0_ON_H,LED0_OFF_L,LED0_OFF_H)
    // The 4*NO changes it so it inclines depending on NO up to 15.    

    // Steps are maxmimum between 0 and 4096
    // no is between 0 and 15 
    if (steps < 0 || steps > 4096) { return false; }
    if (no < 0 || no > 15) { return false; }

    // Lets write the start high to step 0
    this.send(0x06 + 4 * no, 0x00)
    this.send(0x07 + 4 * no, 0x00)
    // Then write the end high to steps calculated from usToSteps
    this.send(0x08 + 4 * no, steps & 0xFF )
    this.send(0x09 + 4 * no, steps >> 8)
    return true;
  }

  // Usage: setPWM(microsecounds);
  setAllPWM(us) {
    const steps = this.usToSteps(us);
    // 0xFA -> 0xFD (ALL_LED_ON_L,ALL_LED_ON_H,ALL_LED_OFF_L,ALL_LED_OFF_H)

    // Steps are maxmimum between 0 and 4096
    if (steps < 0 || steps > 4095) { return false; }
    // Lets write the start high to step 0
    this.send(0xFA, 0x00)
    this.send(0xFB, 0x00)
    // Then write the end high to steps calculated from usToSteps
    this.send(0xFC, steps & 0xFF)
    this.send(0xFD, steps >> 8)
  }

  // Calculate how many steps an specific µS can be
  usToSteps(us) {
    // E.g. 50hz cycle = 1000000µS / 50hz = 20 000µS pr cycle.
    const MicrosecoundPerCycle = 1000000 / 50;
    // Then get how many µS we get pr step by dividing steps on µS pr cycle
    const stepsPerMicrosecound = 4095 / MicrosecoundPerCycle;
    // Then return µS wanted times steps we get per µS
    return Math.round(us * stepsPerMicrosecound)
  }

  send(command, byte) {
    this.i2c.writeByteSync(this.address, command, byte)
  }

}

