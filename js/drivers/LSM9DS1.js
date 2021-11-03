const i2c = require('i2c-bus')


/* WHO_AM_I VALUES */
const AG_ID = 0x68
const MAG_ID = 0x3D

const CTRL_REG1_G = 0x10
const WHO_AM_I = 0x0F
const CTRL_REG2_G = 0x11
const CTRL_REG3_G = 0x12
const OUT_TEMP_L = 0x15
const STATUS_REG = 0x17
const OUT_X_G = 0x18
const CTRL_REG4 = 0x1E
const CTRL_REG5_XL = 0x1F
const CTRL_REG6_XL = 0x20
const CTRL_REG7_XL = 0x21
const CTRL_REG8 = 0x22
const CTRL_REG9 = 0x23
const CTRL_REG10 = 0x24
const OUT_X_XL = 0x28
const REFERENCE_G = 0x0B
const INT1_CTRL = 0x0C
const INT2_CTRL = 0x0D
const WHO_AM_I_M = 0x0F
const CTRL_REG1_M = 0x20
const CTRL_REG2_M = 0x21
const CTRL_REG3_M = 0x22
const CTRL_REG4_M = 0x23
const CTRL_REG5_M = 0x24
const STATUS_REG_M = 0x27
const OUT_X_L_M = 0x28

module.exports = class LSM9DS1 {


  constructor() {

    this.ag_addr = 0x6b
    this.m_addr = 0x1e
    this.bus = 1
    this.sensor = null
  }

  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

  init() {

    return new Promise(async (resolve, reject) => {
      // Create I2C Sensor
      this.sensor = i2c.openSync(this.bus)

      // Read WHO_AM_I registers for both devices
      const ag_id = this.sensor.readByteSync(this.ag_addr, WHO_AM_I)
      const mag_id = this.sensor.readByteSync(this.m_addr, WHO_AM_I)

      // If ID does not match reject the config
      if ((ag_id != AG_ID) || (mag_id != MAG_ID)) { reject('WHO_AM_I REGISTERS NOT CORRECT') }

      // Reset mag and ag
      this.sensor.writeByteSync(this.ag_addr, CTRL_REG8, 0x05)
      this.sensor.writeByteSync(this.ag_addr, CTRL_REG2_M, 0x08)

      // Wait 10ms for it to reinitialize
      await this.sleep(10)

      this.sensor.writeByteSync(this.ag_addr, CTRL_REG1_G, 0x8A)
      this.sensor.writeByteSync(this.ag_addr, CTRL_REG6_XL, 0x87)
      this.sensor.writeByteSync(this.ag_addr, INT1_CTRL, 0x01)

      this.sensor.writeByteSync(this.m_addr, CTRL_REG1_M, 0xC2)
      this.sensor.writeByteSync(this.m_addr, CTRL_REG3_M, 0x00)
      this.sensor.writeByteSync(this.m_addr, CTRL_REG4_M, 0x08)
      this.sensor.writeByteSync(this.m_addr, CTRL_REG5_M, 0x40)

      await this.sleep(1000)
      this.readTemperature()
      setInterval(() => { this.readTemperature() }, 1000)
    })
  }

  readAgData() {}

  readTemperature() {
    // const xL = this.sensor.readByteSync(this.ag_addr, OUT_X_G)
    // const xH = this.sensor.readByteSync(this.ag_addr, OUT_X_G+1)
    // const yL = this.sensor.readByteSync(this.ag_addr, OUT_X_G+2)
    // const yH = this.sensor.readByteSync(this.ag_addr, OUT_X_G+3)
    // const zL = this.sensor.readByteSync(this.ag_addr, OUT_X_G+4)
    // const zH = this.sensor.readByteSync(this.ag_addr, OUT_X_G+5)
    
    // //buf.readInt16LE
    // const x = -(xL | xH << 8)
    // const y = yL | yH << 8
    // const z = zL | zH << 8

    let tempBuffer = Buffer.alloc(2)
    this.sensor.readI2cBlockSync(this.ag_addr, OUT_TEMP_L, 2, tempBuffer)
console.log(tempBuffer.readInt16LE(), tempBuffer)
    // const dataH = this.sensor.readByteSync(this.g_xl_addr, OUT_TEMP_L+1)
    // const data = dataL | dataH << 8
    // console.log(x,y,z)

    
  }
}