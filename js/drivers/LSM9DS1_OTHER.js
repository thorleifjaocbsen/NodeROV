// Code from:   - https://github.com/robertIanClarkson/LSM9DS1-NodeJS


const i2c = require('i2c-bus');

class LSM9DS1 {
  
  /* HARDWARE REGISTERS */
  /* Gyro(G) & Accel(X) & Temp(T) */
  #ACT_THS          = 0x04;
  #ACT_DUR          = 0x05;
  #INT_GEN_CFG_XL   = 0x06; 
  #INT_GEN_THS_X_XL = 0x07;
  #INT_GEN_THS_Y_XL = 0x08;
  #INT_GEN_THS_Z_XL = 0x09;
  #INT_GEN_DUR_XL   = 0x0A;
  #REFERENCE_G      = 0x0B;
  #INT1_CTRL        = 0x0C;
  #INT2_CTRL        = 0x0D;
  #WHO_AM_I         = 0x0F; // GX - r  - ( 0x68 )
  #CTRL_REG1_G      = 0x10; // G  - rw - ( rate | dps | bandwidth )
  #CTRL_REG2_G      = 0x11; // G  - rw - ( INT selection configuration | Out selection configuration )
  #CTRL_REG3_G      = 0x12; // G  - rw - ( Low-power mode | High-pass filter | filter cutoff frequency )
  #ORIENT_CFG_G     = 0x13; // G  - rw - ( Pitch +/- | Roll +/- | Yaw +/- | [All in 3 bits] )
  #INT_GEN_SRC_G    = 0x14; 
  #OUT_TEMP_L       = 0x15; // T - r  - ( low )
  #OUT_TEMP_H       = 0x16; // T - r  - ( high )
  #STATUS_REG       = 0x17; 
  #OUT_X_L_G        = 0x18; // G - r  - ( x-low  )
  #OUT_X_H_G        = 0x19; // G - r  - ( x-high )
  #OUT_Y_L_G        = 0x1A; // G - r  - ( y-low  )
  #OUT_Y_H_G        = 0x1B; // G - r  - ( y-high )
  #OUT_Z_L_G        = 0x1C; // G - r  - ( z-low  )
  #OUT_Z_H_G        = 0x1D; // G - r  - ( z-high )
  #CTRL_REG4        = 0x1E; // G_  - rw - ( enable-z | enable-y | enable-x | Latched Interrupt | 4D option enabled on Interrupt )
  #CTRL_REG5_XL     = 0x1F; // X   - rw - ( Decimation of acceleration data on OUT REG and FIFO | z-enable | y-enable | x-enable )
  #CTRL_REG6_XL     = 0x20; // X   - rw - ( rate | g-scale | Bandwidth | Bandwidth selection | Anti-aliasing filter bandwidth )
  #CTRL_REG7_XL     = 0x21; // X   - rw - ( High resolution mode |  cutoff frequency | Filtered data | High-pass filter enabled for acceleration sensor interrupt function on Interrupt )
  #CTRL_REG8        = 0x22; // X   - rw - ( Reboot memory content | Block data update | _ | _ | _ | _ | _ | _ )
  #CTRL_REG9        = 0x23; // GT_ - rw - ( Gyroscope sleep mode enable | Temperature data storage in FIFO enable |  Data available enable bit |  Disable I2C interface | FIFO memory enable | Enable FIFO threshold level use )
  #CTRL_REG10       = 0x24; // GX  - rw - ( Angular rate sensor self-test enable |  Linear acceleration sensor self-test enable )
  #INT_GEN_SRC_XL   = 0x26;
  // #STATUS_REG    = 0x27;/* I believe this is a duplicate register */
  #OUT_X_L_XL       = 0x28; // X - r  - ( x-low  )
  #OUT_X_H_XL       = 0x29; // X - r  - ( x-high )
  #OUT_Y_L_XL       = 0x2A; // X - r  - ( y-low  )
  #OUT_Y_H_XL       = 0x2B; // X - r  - ( y-high )
  #OUT_Z_L_XL       = 0x2C; // X - r  - ( z-low  )
  #OUT_Z_H_XL       = 0x2D; // X - r  - ( z-high )
  #FIFO_CTRL        = 0x2E; // FIFO - rw - ( mode | threshold )
  #FIFO_SRC         = 0x2F; // FIFO - r  - ( threshold status | overrun status | Number of unread samples stored into FIFO )
  #INT_GEN_CFG_G    = 0x30;
  #INT_GEN_THS_XH_G = 0x31;
  #INT_GEN_THS_XL_G = 0x32;
  #INT_GEN_THS_YH_G = 0x33;
  #INT_GEN_THS_YL_G = 0x34;
  #INT_GEN_THS_ZH_G = 0x35;
  #INT_GEN_THS_ZL_G = 0x36;
  #INT_GEN_DUR_G    = 0x37;
  /* MAG(M) */
  #OFFSET_X_REG_L_M = 0x05;
  #OFFSET_X_REG_H_M = 0x06;
  #OFFSET_Y_REG_L_M = 0x07;
  #OFFSET_Y_REG_H_M = 0x08;
  #OFFSET_Z_REG_L_M = 0x09;
  #OFFSET_Z_REG_H_M = 0x0A;
  #WHO_AM_I_M       = 0x0F; // M - r  - ( 0x3D )
  #CTRL_REG1_M      = 0x20; // M - rw - ( Temperature compensation enable | X and Y performance mode | rate | FAST_ODR | Self-test )
  #CTRL_REG2_M      = 0x21; // M - rw - ( sensitivity | Reboot memory content | Configuration registers and user register reset function )
  #CTRL_REG3_M      = 0x22; // M - rw - ( Disable I2C interface | Low-power mode | SPI Serial Interface mode | Operating mode selection )
  #CTRL_REG4_M      = 0x23; // M - rw - ( Z-axis performance | _ )
  #CTRL_REG5_M      = 0x24; // M - rw - ( FAST_READ | Block data update for magnetic data )
  #STATUS_REG_M     = 0x27; // M - r  - (  )
  #OUT_X_L_M        = 0x28; // M - r  - ( x-low  )
  #OUT_X_H_M        = 0x29; // M - r  - ( x-high )
  #OUT_Y_L_M        = 0x2A; // M - r  - ( y-low  )
  #OUT_Y_H_M        = 0x2B; // M - r  - ( y-high )
  #OUT_Z_L_M        = 0x2C; // M - r  - ( z-low  )
  #OUT_Z_H_M        = 0x2D; // M - r  - ( z-high )
  #INT_CFG_M        = 0x30;
  #INT_SRC_M        = 0x31;
  #INT_THS_L_M      = 0x32;
  #INT_THS_H_M      = 0x33;

  /* WHO_AM_I keys */
  #whoami_g_xl_key = 0x68;
  #whoami_m_key    = 0x3D;

  /* INSTANCE VARIABLES */
  #sensor          = undefined;
  #bufferSize      = 1;
  #busNo           = 1;
  #G_XL_ADDRESS;
  #M_ADDRESS;

  constructor(options) {
    this.#busNo = (options && options.hasOwnProperty('busNo')) ? options.busNo : 1;
    this.#bufferSize = (options && options.hasOwnProperty('bufferSize')) ? options.bufferSize : 1;
    this.#G_XL_ADDRESS = (options && options.hasOwnProperty('AccelGyroAddress')) ? options.AccelGyroAddress : 0x6B;
    this.#M_ADDRESS = (options && options.hasOwnProperty('MagAddress')) ? options.MagAddress : 0x1E;
  }

  #sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  init() {    
    return new Promise((resolve, reject) => {
      i2c.openPromisified(this.#busNo)
        .then(sensor => this.#sensor = sensor)
        // verify that that the device is a LSM9DS1
        .then(() => this.#sensor.readByte(this.#G_XL_ADDRESS, this.#WHO_AM_I))
        .then(whoami => { if(whoami != this.#whoami_g_xl_key) throw 'init --> FAILED WHO_AM_I check for gyro/accel' })
        .then(() => this.#sensor.readByte(this.#M_ADDRESS, this.#WHO_AM_I_M))
        .then(whoami => { if(whoami != this.#whoami_m_key) throw 'init --> FAILED WHO_AM_I check for mag' })
         // soft reset & reboot accel/gyro
        .then(() => this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG8, 0x05)) 
        // soft reset & reboot magnetometer
        .then(() => this.#sensor.writeByte(this.#M_ADDRESS, this.#CTRL_REG2_M, 0x0C))
        // wait 0.1s to reboot
        .then(() => this.#sleep(10))
        // enable gyro continuous
        .then(() => this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG1_G, 0xC0))
        // Enable the accelerometer continous
        .then(() => this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG5_XL, 0x38)) // enable X Y and Z axis
        .then(() => this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG6_XL, 0xC0)) // 1 KHz out data rate, BW set by ODR, 408Hz anti-aliasing
        // enable mag continuous
        .then(() => this.#sensor.writeByte(this.#M_ADDRESS, this.#CTRL_REG3_M, 0x00))
        .then(() => resolve('init --> Success'))
        .catch(err => reject(err));
    }) 




    // // Set default ranges for the various sensors
    // self._accel_mg_lsb = None
    // self._mag_mgauss_lsb = None
    // self._gyro_dps_digit = None
    // self.accel_range = ACCELRANGE_2G
    // self.mag_gain = MAGGAIN_4GAUSS
    // self.gyro_scale = GYROSCALE_245DPS



  }

  setBufferSize(bufferSize) {
    this.#bufferSize = bufferSize;
    console.log(`Buffer Size set to: ${bufferSize}`)
  }

  initGyro() {

    let CTRL_REG1_G = this.gyro.enabled ?  (this.gyro.sampleRate & 0x07) << 5 : 0;
    switch (this.gyro.scale) {
      case 500: CTRL_REG1_G |= (0x1 << 3); break;
      case 2000: CTRL_REG1_G |= (0x3 << 3); break;
      // Otherwise we'll set it to 245 dps (0x0 << 4)
    }
    CTRL_REG1_G |= (this.gyro.bandwidth & 0x3);

    let CTRL_REG3_G = this.gyro.lowPowerEnable ? (1 << 7) : 0;
    if (this.gyro.HPFEnable) { CTRL_REG3_G |= (1 << 6) | (this.gyro.HPFCutoff & 0x0F); }

    let CTRL_REG4 = 0;
    if (this.gyro.enableZ) CTRL_REG4 |= (1 << 5);
    if (this.gyro.enableY) CTRL_REG4 |= (1 << 4);
    if (this.gyro.enableX) CTRL_REG4 |= (1 << 3);
    if (this.gyro.latchInterrupt) CTRL_REG4 |= (1 << 1);

    let ORIENT_CFG_G = 0;
    if (this.gyro.flipX) ORIENT_CFG_G |= (1 << 5);
    if (this.gyro.flipY) ORIENT_CFG_G |= (1 << 4);
    if (this.gyro.flipZ) ORIENT_CFG_G |= (1 << 3);

    return Promise.all([
        this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG1_G,  CTRL_REG1_G),
        this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG2_G,  0x00), 
        this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG3_G,  CTRL_REG3_G),
        this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG4,    CTRL_REG4),
        this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#ORIENT_CFG_G, ORIENT_CFG_G),
    ]);
  }

  initAccel() {
    let CTRL_REG5_XL = 0;
    if (this.accel.enableZ) CTRL_REG5_XL |= (1 << 5);
    if (this.accel.enableY) CTRL_REG5_XL |= (1 << 4);
    if (this.accel.enableX) CTRL_REG5_XL |= (1 << 3);

    let CTRL_REG6_XL = this.accel.enabled ? (this.accel.sampleRate & 0x07) << 5 : 0;
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

    let CTRL_REG7_XL = 0;
    if (this.accel.highResEnable) {
        CTRL_REG7_XL |= (1 << 7); // Set HR bit
        CTRL_REG7_XL |= (this.accel.highResBandwidth & 0x3) << 5;
    }

    return Promise.all([
        this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG5_XL,  CTRL_REG5_XL),
        this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG6_XL,  CTRL_REG6_XL), 
        this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG7_XL,  CTRL_REG7_XL)
    ]);
  }

  initMag() {
    let CTRL_REG1_M = 0;

    if (this.mag.tempCompensationEnable) CTRL_REG1_M |= (1 << 7);
    CTRL_REG1_M |= (this.mag.XYPerformance & 0x3) << 5;
    CTRL_REG1_M |= (this.mag.sampleRate & 0x7) << 2;

    let CTRL_REG2_M = 0;
    switch (this.mag.scale) {
      case 8: CTRL_REG2_M |= (0x1 << 5); break;
      case 12: CTRL_REG2_M |= (0x2 << 5); break;
      case 16: CTRL_REG2_M |= (0x3 << 5); break;
      // Otherwise we'll default to 4 gauss (00)
    }

    let CTRL_REG3_M = 0;
    if (this.mag.lowPowerEnable) CTRL_REG3_M |= (1 << 5);
    CTRL_REG3_M |= (this.mag.operatingMode & 0x3);

    let CTRL_REG4_M = 0;
    CTRL_REG4_M = (this.mag.ZPerformance & 0x3) << 2;

    let CTRL_REG5_M = 0;

    return Promise.all([
        this.#sensor.writeByte(this.#M_ADDRESS, this.#CTRL_REG1_M,  CTRL_REG1_M),
        this.#sensor.writeByte(this.#M_ADDRESS, this.#CTRL_REG2_M,  CTRL_REG2_M), 
        this.#sensor.writeByte(this.#M_ADDRESS, this.#CTRL_REG3_M,  CTRL_REG3_M),
        this.#sensor.writeByte(this.#M_ADDRESS, this.#CTRL_REG4_M,  CTRL_REG4_M),
        this.#sensor.writeByte(this.#M_ADDRESS, this.#CTRL_REG5_M,  CTRL_REG5_M),
    ]);
  }

  enableFIFO(enable) {
    return new Promise((resolve, reject) => {
        this.#sensor.readByte(this.#G_XL_ADDRESS, this.#CTRL_REG9)
        .then(data => {
            if (enable) data |= (1 << 1);
            else data &= ~(1 << 1);
            this.#sensor.writeByte(this.#G_XL_ADDRESS, this.#CTRL_REG9, data)
            .then(() => resolve())
            .catch(err => reject(err))
        });
    });
  }

  #readGyroBuffer() {
    let x_low  = Buffer.alloc(this.#bufferSize)
    let x_high = Buffer.alloc(this.#bufferSize)
    let y_low  = Buffer.alloc(this.#bufferSize)
    let y_high = Buffer.alloc(this.#bufferSize)
    let z_low  = Buffer.alloc(this.#bufferSize)
    let z_high = Buffer.alloc(this.#bufferSize)
    return new Promise((resolve, reject) => {
      if(this.#sensor == undefined) reject('readGyroBuffer --> FAILED i2c bus is close')
      Promise.all([
        this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_X_L_G, this.#bufferSize, x_low ),
        this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_X_H_G, this.#bufferSize, x_high),
        this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_Y_L_G, this.#bufferSize, y_low ),
        this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_Y_H_G, this.#bufferSize, y_high),
        this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_Z_L_G, this.#bufferSize, z_low ),
        this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_Z_H_G, this.#bufferSize, z_high)
      ])
      .then(() => {
        resolve([
          x_low, x_high,
          y_low, y_high,
          y_low, z_high
        ])
      })
      .catch(err => {
        reject(`readGyroBuffer --> FAILED read: ${err}`)
      })
    })
  }

  #readAccelBuffer() {
    let x_low  = Buffer.alloc(this.#bufferSize)
    let x_high = Buffer.alloc(this.#bufferSize)
    let y_low  = Buffer.alloc(this.#bufferSize)
    let y_high = Buffer.alloc(this.#bufferSize)
    let z_low  = Buffer.alloc(this.#bufferSize)
    let z_high = Buffer.alloc(this.#bufferSize)
    return new Promise((resolve, reject) => {
      if(this.#sensor == undefined) reject('readAccelBuffer --> FAILED i2c bus is close')
      Promise.all([
        this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_X_L_XL, this.#bufferSize, x_low ),
        this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_X_H_XL, this.#bufferSize, x_high),
        this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_Y_L_XL, this.#bufferSize, y_low ),
        this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_Y_H_XL, this.#bufferSize, y_high),
        this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_Z_L_XL, this.#bufferSize, z_low ),
        this.#sensor.readI2cBlock(this.#G_XL_ADDRESS, this.#OUT_Z_H_XL, this.#bufferSize, z_high)
      ])
      .then(() => {
        resolve([
          x_low, x_high,
          y_low, y_high,
          y_low, z_high
        ])
      })
      .catch(err => {
        reject(`readAccelBuffer --> FAILED read: ${err}`)
      })
    })
  }

  #readMagBuffer() {
    let x_low  = Buffer.alloc(this.#bufferSize)
    let x_high = Buffer.alloc(this.#bufferSize)
    let y_low  = Buffer.alloc(this.#bufferSize)
    let y_high = Buffer.alloc(this.#bufferSize)
    let z_low  = Buffer.alloc(this.#bufferSize)
    let z_high = Buffer.alloc(this.#bufferSize)
    return new Promise((resolve, reject) => {
      if(this.#sensor == undefined) reject('readGyroBuffer --> FAILED i2c bus is close')
      Promise.all([
        this.#sensor.readI2cBlock(this.#M_ADDRESS, this.#OUT_X_L_M, this.#bufferSize, x_low ),
        this.#sensor.readI2cBlock(this.#M_ADDRESS, this.#OUT_X_H_M, this.#bufferSize, x_high),
        this.#sensor.readI2cBlock(this.#M_ADDRESS, this.#OUT_Y_L_M, this.#bufferSize, y_low ),
        this.#sensor.readI2cBlock(this.#M_ADDRESS, this.#OUT_Y_H_M, this.#bufferSize, y_high),
        this.#sensor.readI2cBlock(this.#M_ADDRESS, this.#OUT_Z_L_M, this.#bufferSize, z_low ),
        this.#sensor.readI2cBlock(this.#M_ADDRESS, this.#OUT_Z_H_M, this.#bufferSize, z_high)
      ])
      .then(() => {
        resolve([
          x_low, x_high,
          y_low, y_high,
          y_low, z_high
        ])
      })
      .catch(err => {
        reject(`readGyroBuffer --> FAILED read: ${err}`)
      })
    })
  }

  #convert(low, high) {
    var converted = ((high & 0xFF) * 256 + (low & 0xFF))
    if (converted > 32767) converted -= 65536
    return converted
  }

  #average(low, high) {
    let sum = 0;
    for(let i = 0; i < this.#bufferSize; i++) {
      sum += this.#convert(low[i], high[i])
    }
    return Math.floor(sum / this.#bufferSize)
  }

  readAll() {
    let div_gyro  = 256;
    let div_accel = 256;
    let div_mag   = 256;
    let gyro_x,  gyro_y,  gyro_z;
    let accel_x, accel_y, accel_z;
    let mag_x,   mag_y,   mag_z;
    return new Promise((resolve, reject) => {
      if(this.#sensor == undefined) reject('readAll --> FAILED i2c bus is close')
      this.#readGyroBuffer()
      .then(([x_low, x_high, y_low, y_high, z_low, z_high]) => {
        gyro_x = this.#average(x_low, x_high) / div_gyro
        gyro_y = this.#average(y_low, y_high) / div_gyro
        gyro_z = this.#average(z_low, z_high) / div_gyro
        this.#readAccelBuffer()
        .then(([x_low, x_high, y_low, y_high, z_low, z_high]) => {
          accel_x = this.#average(x_low, x_high) / div_accel
          accel_y = this.#average(y_low, y_high) / div_accel
          accel_z = this.#average(z_low, z_high) / div_accel
          this.#readMagBuffer()
          .then(([x_low, x_high, y_low, y_high, z_low, z_high]) => {
            mag_x = this.#average(x_low, x_high) / div_mag
            mag_y = this.#average(y_low, y_high) / div_mag
            mag_z = this.#average(z_low, z_high) / div_mag
            resolve({
              gyro: {
                x: gyro_x,
                y: gyro_y,
                z: gyro_z
              },
              accel: {
                x: accel_x,
                y: accel_y,
                z: accel_z
              },
              mag: {
                x: mag_x,
                y: mag_y,
                z: mag_z
              }
            })
          })
          .catch(err => {
            reject(`readAll --> ${err}`)
          })
        })
        .catch(err => {
          reject(`readAll --> ${err}`)
        })
      })
      .catch(err => {
        reject(`readAll --> ${err}`)
      })  
    })
  }

  close() {
    return new Promise((resolve, reject) => {
      if(this.#sensor == undefined) reject(`close --> i2c bus is already closed`)
      this.#sensor.close()
      .then(() => {
        this.#sensor = undefined
        resolve('i2c bus successfully closed')
      })
      .catch(err => {
        reject(`close --> Failed to close i2c bus : ${err}`)
      }) 
    })
  }

}

module.exports = LSM9DS1
