/*
  LSM9DS1.js

  A Node.js I2C module for the ST LSM9DS1 3D accelerometer, 3D gyroscope and 3D magnometer.

  Some code is from other repos and inspirations are from them. Here are the original source:
  
  - https://github.com/robertIanClarkson/LSM9DS1-NodeJS
  - https://github.com/sparkfun/SparkFun_LSM9DS1_Arduino_Library

*/

'use strict';

const i2c = require('i2c-bus');


module.exports = class LSM9DS1 {

  /* HARDWARE REGISTERS */
  /* Gyro(G) & Accel(X) & Temp(T) */
  #ACT_THS = 0x04;
  #ACT_DUR = 0x05;
  #INT_GEN_CFG_XL = 0x06;
  #INT_GEN_THS_X_XL = 0x07;
  #INT_GEN_THS_Y_XL = 0x08;
  #INT_GEN_THS_Z_XL = 0x09;
  #INT_GEN_DUR_XL = 0x0A;
  #REFERENCE_G = 0x0B;
  #INT1_CTRL = 0x0C;
  #INT2_CTRL = 0x0D;
  #WHO_AM_I = 0x0F; // GX - r  - ( 0x68 )
  #CTRL_REG1_G = 0x10; // G  - rw - ( rate | dps | bandwidth )
  #CTRL_REG2_G = 0x11; // G  - rw - ( INT selection configuration | Out selection configuration )
  #CTRL_REG3_G = 0x12; // G  - rw - ( Low-power mode | High-pass filter | filter cutoff frequency )
  #ORIENT_CFG_G = 0x13; // G  - rw - ( Pitch +/- | Roll +/- | Yaw +/- | [All in 3 bits] )
  #INT_GEN_SRC_G = 0x14;
  #OUT_TEMP_L = 0x15; // T - r  - ( low )
  #OUT_TEMP_H = 0x16; // T - r  - ( high )
  #STATUS_REG = 0x17;
  #OUT_X_L_G = 0x18; // G - r  - ( x-low  )
  #OUT_X_H_G = 0x19; // G - r  - ( x-high )
  #OUT_Y_L_G = 0x1A; // G - r  - ( y-low  )
  #OUT_Y_H_G = 0x1B; // G - r  - ( y-high )
  #OUT_Z_L_G = 0x1C; // G - r  - ( z-low  )
  #OUT_Z_H_G = 0x1D; // G - r  - ( z-high )
  #CTRL_REG4 = 0x1E; // G_  - rw - ( enable-z | enable-y | enable-x | Latched Interrupt | 4D option enabled on Interrupt )
  #CTRL_REG5_XL = 0x1F; // X   - rw - ( Decimation of acceleration data on OUT REG and FIFO | z-enable | y-enable | x-enable )
  #CTRL_REG6_XL = 0x20; // X   - rw - ( rate | g-scale | Bandwidth | Bandwidth selection | Anti-aliasing filter bandwidth )
  #CTRL_REG7_XL = 0x21; // X   - rw - ( High resolution mode |  cutoff frequency | Filtered data | High-pass filter enabled for acceleration sensor interrupt function on Interrupt )
  #CTRL_REG8 = 0x22; // X   - rw - ( Reboot memory content | Block data update | _ | _ | _ | _ | _ | _ )
  #CTRL_REG9 = 0x23; // GT_ - rw - ( Gyroscope sleep mode enable | Temperature data storage in FIFO enable |  Data available enable bit |  Disable I2C interface | FIFO memory enable | Enable FIFO threshold level use )
  #CTRL_REG10 = 0x24; // GX  - rw - ( Angular rate sensor self-test enable |  Linear acceleration sensor self-test enable )
  #INT_GEN_SRC_XL = 0x26;
  // #STATUS_REG    = 0x27;/* I believe this is a duplicate register */
  #OUT_X_L_XL = 0x28; // X - r  - ( x-low  )
  #OUT_X_H_XL = 0x29; // X - r  - ( x-high )
  #OUT_Y_L_XL = 0x2A; // X - r  - ( y-low  )
  #OUT_Y_H_XL = 0x2B; // X - r  - ( y-high )
  #OUT_Z_L_XL = 0x2C; // X - r  - ( z-low  )
  #OUT_Z_H_XL = 0x2D; // X - r  - ( z-high )
  #FIFO_CTRL = 0x2E; // FIFO - rw - ( mode | threshold )
  #FIFO_SRC = 0x2F; // FIFO - r  - ( threshold status | overrun status | Number of unread samples stored into FIFO )
  #INT_GEN_CFG_G = 0x30;
  #INT_GEN_THS_XH_G = 0x31;
  #INT_GEN_THS_XL_G = 0x32;
  #INT_GEN_THS_YH_G = 0x33;
  #INT_GEN_THS_YL_G = 0x34;
  #INT_GEN_THS_ZH_G = 0x35;
  #INT_GEN_THS_ZL_G = 0x36;
  #INT_GEN_DUR_G = 0x37;
  /* MAG(M) */
  #OFFSET_X_REG_L_M = 0x05;
  #OFFSET_X_REG_H_M = 0x06;
  #OFFSET_Y_REG_L_M = 0x07;
  #OFFSET_Y_REG_H_M = 0x08;
  #OFFSET_Z_REG_L_M = 0x09;
  #OFFSET_Z_REG_H_M = 0x0A;
  #WHO_AM_I_M = 0x0F; // M - r  - ( 0x3D )
  #CTRL_REG1_M = 0x20; // M - rw - ( Temperature compensation enable | X and Y performance mode | rate | FAST_ODR | Self-test )
  #CTRL_REG2_M = 0x21; // M - rw - ( sensitivity | Reboot memory content | Configuration registers and user register reset function )
  #CTRL_REG3_M = 0x22; // M - rw - ( Disable I2C interface | Low-power mode | SPI Serial Interface mode | Operating mode selection )
  #CTRL_REG4_M = 0x23; // M - rw - ( Z-axis performance | _ )
  #CTRL_REG5_M = 0x24; // M - rw - ( FAST_READ | Block data update for magnetic data )
  #STATUS_REG_M = 0x27; // M - r  - (  )
  #OUT_X_L_M = 0x28; // M - r  - ( x-low  )
  #OUT_X_H_M = 0x29; // M - r  - ( x-high )
  #OUT_Y_L_M = 0x2A; // M - r  - ( y-low  )
  #OUT_Y_H_M = 0x2B; // M - r  - ( y-high )
  #OUT_Z_L_M = 0x2C; // M - r  - ( z-low  )
  #OUT_Z_H_M = 0x2D; // M - r  - ( z-high )
  #INT_CFG_M = 0x30;
  #INT_SRC_M = 0x31;
  #INT_THS_L_M = 0x32;
  #INT_THS_H_M = 0x33;

  /* WHO_AM_I keys */
  #whoami_g_xl_key = 0x68;
  #whoami_m_key = 0x3D;

  /* INSTANCE VARIABLES */
  #sensor = undefined;
  #BUS_NO;
  #G_XL_ADDRESS;
  #M_ADDRESS;

  #isCalibrating = false;
  #isCalibrated = false;
  #isInitialized = false;

  constructor(options) {

    this.#BUS_NO = (options && options.hasOwnProperty('bus')) ? options.bus : 1;
    this.#G_XL_ADDRESS = (options && options.hasOwnProperty('agAddress')) ? options.agAddress : 0x6B;
    this.#M_ADDRESS = (options && options.hasOwnProperty('mAddress')) ? options.mAddress : 0x1E;

    this.gyro = {
      enabled: true,
      enableX: true,
      enableY: true,
      enableZ: true,
      scale: 245,
      sampleRate: 6,
      bandwidth: 0,
      lowPowerEnable: false,
      HPFEnable: false,
      HPFCutoff: 0,
      flipX: false,
      flipY: false,
      flipZ: false,
      orientation: 0,
      latchInterrupt: true,
      resolution: 0,
      x: 0,
      y: 0,
      z: 0
    }

    this.accel = {
      enabled: true,
      enableX: true,
      enableY: true,
      enableZ: true,
      scale: 2,
      sampleRate: 6,
      bandwidth: -1,
      highResEnable: false,
      highResBandwidth: 0,
      resolution: 0,
      x: 0,
      y: 0,
      z: 0
    }

    this.mag = {
      enabled: true,
      scale: 4,
      sampleRate: 7,
      tempCompensationEnable: false,
      XYPerformance: 3,
      ZPerformance: 3,
      lowPowerEnable: false,
      operatingMode: 0,
      resolution: 0,
      x: 0,
      y: 0,
      z: 0
    }

    this.temp = {
      offset: 25,
      value: 0
    }

    this.gBias = [0, 0, 0];
    this.aBias = [0, 0, 0];
    this.mBias = [0, 0, 0];
    this.gBiasRaw = [0, 0, 0];
    this.aBiasRaw = [0, 0, 0];
    this.mBiasRaw = [0, 0, 0];

  }

  init() {

    return i2c.openPromisified(this.#BUS_NO)
      .then(bus => this.#sensor = bus)
      .then(() => this.constrainScalesAndCalculateResolutions())
      // Chec the WHO_AM_I register of the gyroscope and accelerometer, and the WHO_AM_I register of the magnetometer
      .then(() => this.#sensor.readByte(this.#G_XL_ADDRESS, this.#WHO_AM_I))
      .then(xg => { if (this.#whoami_g_xl_key != xg) throw new Error('Gyroscope not found') })
      .then(() => this.#sensor.readByte(this.#M_ADDRESS, this.#WHO_AM_I_M))
      .then(m => { if (this.#whoami_m_key != m) throw new Error('Magnetometer not found') })
      .then(() => this.initGyro()) // Gyro initalization
      .then(() => this.initAccel()) // Accel initalizationw
      .then(() => this.initMag()) // Mag initalization
      .then(() => this.#isInitialized = true) // Gyro ODR
      .catch(err => { throw err })

  }

  initGyro() {

    // CTRL_REG1_G (Default value: 0x00)
    // [ODR_G2][ODR_G1][ODR_G0][FS_G1][FS_G0][0][BW_G1][BW_G0]
    // ODR_G[2:0] - Output data rate selection
    // FS_G[1:0] - Gyroscope full-scale selection
    // BW_G[1:0] - Gyroscope bandwidth selection

    // To disable gyro, set sample rate bits to 0. We'll only set sample
    // rate if the gyro is enabled.
    let CTRL_REG1_G = 0;
    if (this.gyro.enabled) {
      CTRL_REG1_G = (this.gyro.sampleRate & 0x07) << 5;
    }

    switch (this.gyro.scale) {
      case 500: CTRL_REG1_G |= (0x1 << 3); break;
      case 2000: CTRL_REG1_G |= (0x3 << 3); break;
      // Otherwise we'll set it to 245 dps (0x0 << 4)
    }
    CTRL_REG1_G |= (this.gyro.bandwidth & 0x3);

    // CTRL_REG2_G (Default value: 0x00)
    // [0][0][0][0][INT_SEL1][INT_SEL0][OUT_SEL1][OUT_SEL0]
    // INT_SEL[1:0] - INT selection configuration
    // OUT_SEL[1:0] - Out selection configuration
    let CTRL_REG2_G = 0x00;

    // CTRL_REG3_G (Default value: 0x00)
    // [LP_mode][HP_EN][0][0][HPCF3_G][HPCF2_G][HPCF1_G][HPCF0_G]
    // LP_mode - Low-power mode enable (0: disabled, 1: enabled)
    // HP_EN - HPF enable (0:disabled, 1: enabled)
    // HPCF_G[3:0] - HPF cutoff frequency
    let CTRL_REG3_G = this.gyro.lowPowerEnable ? (1 << 7) : 0;
    if (this.gyro.HPFEnable) {
      CTRL_REG3_G |= (1 << 6) | (this.gyro.HPFCutoff & 0x0F);
    }

    // CTRL_REG4 (Default value: 0x38)
    // [0][0][Zen_G][Yen_G][Xen_G][0][LIR_XL1][4D_XL1]
    // Zen_G - Z-axis output enable (0:disable, 1:enable)
    // Yen_G - Y-axis output enable (0:disable, 1:enable)
    // Xen_G - X-axis output enable (0:disable, 1:enable)
    // LIR_XL1 - Latched interrupt (0:not latched, 1:latched)
    // 4D_XL1 - 4D option on interrupt (0:6D used, 1:4D used)
    let CTRL_REG4 = 0;
    if (this.gyro.enableZ) CTRL_REG4 |= (1 << 5);
    if (this.gyro.enableY) CTRL_REG4 |= (1 << 4);
    if (this.gyro.enableX) CTRL_REG4 |= (1 << 3);
    if (this.gyro.latchInterrupt) CTRL_REG4 |= (1 << 1);

    // ORIENT_CFG_G (Default value: 0x00)
    // [0][0][SignX_G][SignY_G][SignZ_G][Orient_2][Orient_1][Orient_0]
    // SignX_G - Pitch axis (X) angular rate sign (0: positive, 1: negative)
    // Orient [2:0] - Directional user orientation selection
    let ORIENT_CFG_G = 0;
    if (this.gyro.flipX) tempRegValue |= (1 << 5);
    if (this.gyro.flipY) tempRegValue |= (1 << 4);
    if (this.gyro.flipZ) tempRegValue |= (1 << 3);

    return Promise.all([
      this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG1_G, CTRL_REG1_G),
      this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG2_G, CTRL_REG2_G),
      this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG3_G, CTRL_REG3_G),
      this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG4, CTRL_REG4),
      this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#ORIENT_CFG_G, ORIENT_CFG_G)
    ])
  }

  initAccel() {

    //	CTRL_REG5_XL (0x1F) (Default value: 0x38)
    //	[DEC_1][DEC_0][Zen_XL][Yen_XL][Zen_XL][0][0][0]
    //	DEC[0:1] - Decimation of accel data on OUT REG and FIFO.
    //		00: None, 01: 2 samples, 10: 4 samples 11: 8 samples
    //	Zen_XL - Z-axis output enabled
    //	Yen_XL - Y-axis output enabled
    //	Xen_XL - X-axis output enabled
    let CTRL_REG5_XL = 0;
    if (this.accel.enableZ) CTRL_REG5_XL |= (1 << 5);
    if (this.accel.enableY) CTRL_REG5_XL |= (1 << 4);
    if (this.accel.enableX) CTRL_REG5_XL |= (1 << 3);

    // CTRL_REG6_XL (0x20) (Default value: 0x00)
    // [ODR_XL2][ODR_XL1][ODR_XL0][FS1_XL][FS0_XL][BW_SCAL_ODR][BW_XL1][BW_XL0]
    // ODR_XL[2:0] - Output data rate & power mode selection
    // FS_XL[1:0] - Full-scale selection
    // BW_SCAL_ODR - Bandwidth selection
    // BW_XL[1:0] - Anti-aliasing filter bandwidth selection
    let CTRL_REG6_XL = 0;
    // To disable the accel, set the sampleRate bits to 0.
    if (this.accel.enabled) {
      CTRL_REG6_XL |= (this.accel.sampleRate & 0x07) << 5;
    }
    switch (this.accel.scale) {
      case 4: CTRL_REG6_XL |= (0x2 << 3); break;
      case 8: CTRL_REG6_XL |= (0x3 << 3); break;
      case 16: CTRL_REG6_XL |= (0x1 << 3); break;
      // Otherwise it'll be set to 2g (0x0 << 3)
    }
    if (this.accel.bandwidth >= 0) {
      CTRL_REG6_XL |= (1 << 2); // Set BW_SCAL_ODR
      CTRL_REG6_XL |= (this.accel.bandwidth & 0x03);
    }

    // CTRL_REG7_XL (0x21) (Default value: 0x00)
    // [HR][DCF1][DCF0][0][0][FDS][0][HPIS1]
    // HR - High resolution mode (0: disable, 1: enable)
    // DCF[1:0] - Digital filter cutoff frequency
    // FDS - Filtered data selection
    // HPIS1 - HPF enabled for interrupt function
    let CTRL_REG7_XL = 0;
    if (this.accel.highResEnable) {
      CTRL_REG7_XL |= (1 << 7); // Set HR bit
      CTRL_REG7_XL |= (this.accel.highResBandwidth & 0x3) << 5;
    }

    return Promise.all([
      this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG5_XL, CTRL_REG5_XL),
      this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG6_XL, CTRL_REG6_XL),
      this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG7_XL, CTRL_REG7_XL)
    ]);
  }

  initMag() {

    // CTRL_REG1_M (Default value: 0x10)
    // [TEMP_COMP][OM1][OM0][DO2][DO1][DO0][0][ST]
    // TEMP_COMP - Temperature compensation
    // OM[1:0] - X & Y axes op mode selection
    //	00:low-power, 01:medium performance
    //	10: high performance, 11:ultra-high performance
    // DO[2:0] - Output data rate selection
    // ST - Self-test enable
    let CTRL_REG1_M = 0;
    if (this.mag.tempCompensationEnable) CTRL_REG1_M |= (1 << 7);
    CTRL_REG1_M |= (this.mag.XYPerformance & 0x3) << 5;
    CTRL_REG1_M |= (this.mag.sampleRate & 0x7) << 2;

    // CTRL_REG2_M (Default value 0x00)
    // [0][FS1][FS0][0][REBOOT][SOFT_RST][0][0]
    // FS[1:0] - Full-scale configuration
    // REBOOT - Reboot memory content (0:normal, 1:reboot)
    // SOFT_RST - Reset config and user registers (0:default, 1:reset)
    let CTRL_REG2_M = 0;
    switch (this.mag.scale) {
      case 8: CTRL_REG2_M |= (0x1 << 5); break;
      case 12: CTRL_REG2_M |= (0x2 << 5); break;
      case 16: CTRL_REG2_M |= (0x3 << 5); break;
      // Otherwise we'll default to 4 gauss (00)
    }

    // CTRL_REG3_M (Default value: 0x03)
    // [I2C_DISABLE][0][LP][0][0][SIM][MD1][MD0]
    // I2C_DISABLE - Disable I2C interace (0:enable, 1:disable)
    // LP - Low-power mode cofiguration (1:enable)
    // SIM - SPI mode selection (0:write-only, 1:read/write enable)
    // MD[1:0] - Operating mode
    //	00:continuous conversion, 01:single-conversion,
    //  10,11: Power-down
    let CTRL_REG3_M = 0;
    if (this.mag.lowPowerEnable) CTRL_REG3_M |= (1 << 5);
    CTRL_REG3_M |= (this.mag.operatingMode & 0x3);

    // CTRL_REG4_M (Default value: 0x00)
    // [0][0][0][0][OMZ1][OMZ0][BLE][0]
    // OMZ[1:0] - Z-axis operative mode selection
    //	00:low-power mode, 01:medium performance
    //	10:high performance, 10:ultra-high performance
    // BLE - Big/little endian data
    let CTRL_REG4_M = 0;
    CTRL_REG4_M = (this.mag.ZPerformance & 0x3) << 2;

    // CTRL_REG5_M (Default value: 0x00)
    // [0][BDU][0][0][0][0][0][0]
    // BDU - Block data update for magnetic data
    //	0:continuous, 1:not updated until MSB/LSB are read
    let CTRL_REG5_M = 0;

    return Promise.all([
      this.#sensor.writeByte(this.#M_ADDRESS, this.#CTRL_REG4_M, CTRL_REG1_M),
      this.#sensor.writeByte(this.#M_ADDRESS, this.#CTRL_REG2_M, CTRL_REG2_M),
      this.#sensor.writeByte(this.#M_ADDRESS, this.#CTRL_REG3_M, CTRL_REG3_M),
      this.#sensor.writeByte(this.#M_ADDRESS, this.#CTRL_REG4_M, CTRL_REG4_M),
      this.#sensor.writeByte(this.#M_ADDRESS, this.#CTRL_REG5_M, CTRL_REG5_M)
    ]);

  }

  accelAvailable() {

    return this.#sensor.readByte(this.#G_XL_ADDRESS, this.#STATUS_REG)
      .then(status => { return status & (1 << 0); })
      .catch(err => { return false; });
  }

  gyroAvailable() {

    return this.#sensor.readByte(this.#G_XL_ADDRESS, this.#STATUS_REG)
      .then(status => { return (status & (1 << 1)) >> 1; })
      .catch(err => { return false; });
  }

  tempAvailable() {

    return this.#sensor.readByte(this.#G_XL_ADDRESS, this.#STATUS_REG)
      .then(status => { return (status & (1 << 2)) >> 2; })
      .catch(err => { return false; });
  }

  magAvailable(axis) {

    return this.#sensor.readByte(this.#M_ADDRESS, this.#STATUS_REG_M)
      .then(status => { return (status & (1 << axis)) >> axis; })
      .catch(err => { throw err; })
  }

  readGyro(force = false) {

    if (this.#isCalibrating && !force) return Promise.reject("Calibration in progress");

    return this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_X_L_G, 6, Buffer.alloc(6))
      .then((data) => {

        this.gyro.x = data.buffer.readInt16LE(0); // Store x-axis values
        this.gyro.y = data.buffer.readInt16LE(2); // Store y-axis values
        this.gyro.z = data.buffer.readInt16LE(4); // Store z-axis values

        if (this.#isCalibrated) {
          this.gyro.x -= this.gBiasRaw[0];
          this.gyro.y -= this.gBiasRaw[1];
          this.gyro.z -= this.gBiasRaw[2];
        }
      })
      .catch(err => { throw err });

  }

  readMag() {

    return this.#sensor.readI2cBlock(this.#M_ADDRESS, this.#OUT_X_L_M, 6, Buffer.alloc(6))
      .then((data) => {

        this.mag.x = data.buffer.readInt16LE(0); // Store x-axis values
        this.mag.y = data.buffer.readInt16LE(2); // Store y-axis values
        this.mag.z = data.buffer.readInt16LE(4); // Store z-axis values

        if (this.#isCalibrated) {
          this.mag.x -= this.mBiasRaw[0];
          this.mag.y -= this.mBiasRaw[1];
          this.mag.z -= this.mBiasRaw[2];
        }
      })
      .catch(err => { throw err });
  }

  readAccel(force = false) {

    if (this.#isCalibrating && !force) return Promise.reject("Calibration in progress");

    return this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_X_L_XL, 6, Buffer.alloc(6))
      .then((data) => {

        this.accel.x = data.buffer.readInt16LE(0); // Store x-axis values
        this.accel.y = data.buffer.readInt16LE(2); // Store y-axis values
        this.accel.z = data.buffer.readInt16LE(4); // Store z-axis values

        if (this.#isCalibrated) {
          this.accel.x -= this.aBiasRaw[0];
          this.accel.y -= this.aBiasRaw[1];
          this.accel.z -= this.aBiasRaw[2];
        }
      })
      .catch(err => { throw err });
  }

  readTemp() {

    return this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_TEMP_L, 2, Buffer.alloc(2))
      .then((data) => {
        // The value is expressed as two’s complement sign extended on the MSB.
        let value = data.buffer.readInt16LE(0);

        // Remove the first 4 bits of the data as it is 12 bits only.
        // The first 4 bits are duplicates of the 12th bit (sign bit).
        // We do a bitwise and operation.
        value &= 0b0000111111111111;

        // Two's complement on value, if the last bit is 1 we are in the negative number area.
        // So basically the last bit is -2048 instead of 2048.
        if (value > 2048) { value -= 4096; }

        // Adjust for sensitivity of the temperature sensor. 
        value /= 16;

        // Add offset, with 0 degrees it is +25 degrees according to the datasheet.
        value += this.temp.offset;

        this.temp.value = value;

      })
      .catch((err) => { throw err })
  }

  calcGyro(value) {
    return value * this.gyro.resolution;
  }

  calcAccel(value) {
    return value * this.accel.resolution;
  }

  calcMag(value) {
    return value * this.mag.resolution;
  }

  enableFIFO(enable) {

    // Read old data from REG9 and flip the bit based on FIFO enabled or not.
    return this.#sensor.readByte(this.#G_XL_ADDRESS, this.#CTRL_REG9)
      .then(data => {
        if (enable) data |= (1 << 1);
        else data &= ~(1 << 1);
        return this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG9, data);
      })
      .catch(err => { throw err });
  }

  setFIFO(fifoMode, fifoThs) {

    // Limit threshold - 0x1F (31) is the maximum. If more than that was asked
    // limit it to the maximum.
    let threshold = fifoThs <= 0x1F ? fifoThs : 0x1F;
    let temp = ((fifoMode & 0x7) << 5) | (threshold & 0x1F);
    return this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#FIFO_CTRL, temp)
  }

  // This is a function that uses the FIFO to accumulate sample of accelerometer and gyro data, average
  // them, scales them to  gs and deg/s, respectively, and then passes the biases to the main sketch
  // for subtraction from all subsequent data. There are no gyro and accelerometer bias registers to store
  // the data as there are in the ADXL345, a precursor to the LSM9DS0, or the MPU-9150, so we have to
  // subtract the biases ourselves. This results in a more accurate measurement in general and can
  // remove errors due to imprecise or varying initial placement. Calibration of sensor data in this manner
  // is good practice.
  calibrate() {

    this.#isCalibrating = true;

    let samples = 0;
    let aBiasRawTemp = [0, 0, 0];
    let gBiasRawTemp = [0, 0, 0];

    // Turn on FIFO and set threshold to 32 samples
    return this.enableFIFO(true)
      .then(() => this.setFIFO(1, 0x1F))
      .then(async () => {

        // Read the 5 first bits only of FIFO_SRC which contains the FIFO sample count
        while (samples < 31) {
          samples = await this.#sensor.readByte(this.#G_XL_ADDRESS, this.#FIFO_SRC) & 0b00111111;
        }

        // Read the gyro and accel data stored in the FIFO
        for (let i = 0; i < samples; i++) {
          await Promise.all([this.readGyro(true), this.readAccel(true)])
            .then(() => {
              gBiasRawTemp[0] += this.gyro.x;
              gBiasRawTemp[1] += this.gyro.y;
              gBiasRawTemp[2] += this.gyro.z;
              aBiasRawTemp[0] += this.accel.x;
              aBiasRawTemp[1] += this.accel.y;
              aBiasRawTemp[2] += this.accel.z - (1 / this.accel.resolution); // Assumes sensor facing up!
            })
            .catch(err => { reject(err); });
        }

        // Loop thorugh biases
        for (let i = 0; i < 3; i++) {
          this.gBiasRaw[i] = gBiasRawTemp[i] / samples;
          this.gBias[i] = this.calcGyro(this.gBiasRaw[i]);
          this.aBiasRaw[i] = aBiasRawTemp[i] / samples;
          this.aBias[i] = this.calcAccel(this.aBiasRaw[i]);
        }

        this.#isCalibrated = true;

      })
      .then(() => this.enableFIFO(false))
      .then(() => this.setFIFO(0, 0))
      .catch(err => { throw err })
      .finally(() => {
        this.#isCalibrating = false;
      });
  }

  constrainScalesAndCalculateResolutions() {
    // Sensor Sensitivity Cosntants
    // Values set according to the typical specifications provided in
    // table 3 of the LSM9DS1 datasheet. (pg 12)
    const gyroSens = { "245": 0.00875, "500": 0.0175, "2000": 0.07 };
    const accelSens = { "2": 0.000061, "4": 0.000122, "8": 0.000244, "16": 0.000732 };
    const magSens = { "4": 0.00014, "8": 0.00029, "12": 0.00043, "16": 0.00058 };

    // Constrain scales
    if (!Object.keys(gyroSens).includes(this.gyro.scale.toString())) { this.gyro.scale = 245; }
    if (!Object.keys(accelSens).includes(this.accel.scale.toString())) { this.accel.scale = 2; }
    if (!Object.keys(magSens).includes(this.mag.scale.toString())) { this.mag.scale = 4; }

    // Set resolutions
    this.gyro.resolution = gyroSens[this.gyro.scale];   // Calculate DPS / ADC tick
    this.accel.resolution = accelSens[this.accel.scale]; // Calculate g / ADC tick
    this.mag.resolution = magSens[this.mag.scale];     // Calculate Gs / ADC tick
  }
}
