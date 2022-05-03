// const LSM9DS1 = require('lsm9ds1-sensor');

// const sensor = new LSM9DS1();
// sensor.init()
// .then(() => {
//     setInterval(() => {

//         sensor.readAccel()
//         .then(() => sensor.readGyro())
//         .then(() => sensor.readMag())
//         .then(() => sensor.readTemp())
//         .then(() => {
        
//             let ax = sensor.calcAccel(sensor.accel.x) * 9.80665;
//             let ay = sensor.calcAccel(sensor.accel.y) * 9.80665;
//             let az = sensor.calcAccel(sensor.accel.z) * 9.80665;
//             console.log(`Acceleration (M/s): ${ax.toFixed(3)} ${ay.toFixed(3)} ${az.toFixed(3)}`);
            
//             let mx = sensor.calcMag(sensor.mag.x);
//             let my = sensor.calcMag(sensor.mag.y);
//             let mz = sensor.calcMag(sensor.mag.z);
//             console.log(`Mag (guass): ${mx.toFixed(3)} ${my.toFixed(3)} ${mz.toFixed(3)}`);
        
//             let gx = sensor.calcGyro(sensor.gyro.x*0.017453);
//             let gy = sensor.calcGyro(sensor.gyro.y*0.017453);
//             let gz = sensor.calcGyro(sensor.gyro.z*0.017453);
//             console.log(`Gyro (rad/sec): ${gx.toFixed(3)} ${gy.toFixed(3)} ${gz.toFixed(3)}`);
        
//             console.log(`Temp: ${sensor.temp.value.toFixed(3)}C`);
        
//         });
//     }, 1000);
    
// });




// // const InertialMeasurementUnit = require("./js/classes/InertialMeasurementUnit.js");
// // const imu = new InertialMeasurementUnit();

// // imu.init(true, 10)
// // .then(() => { console.log("Init done"); })
// // .catch((err) => { console.log(err) });

