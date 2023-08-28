const LSM9DS1 = require("./js/drivers/LSM9DS1");

const imu = new LSM9DS1();
imu.init().then(() => {
  setInterval(() => {
    readImu().then((data) => {
      // max 5 digits
      
      let x = imu.gyro.x.toFixed(3);
      let y = imu.gyro.y.toFixed(3);
      let z = imu.gyro.z.toFixed(3);

      // Round x to max 5 digits
      // Round y to max 5 digits
      // Round z to max 5 digits


      console.log(x, y, z);
    });
  }, 100);

});


function readImu() {
  return Promise.all([
    imu.readAccel(),
    imu.readMag(),
    imu.readTemp(),
    imu.readGyro()
  ]);
}