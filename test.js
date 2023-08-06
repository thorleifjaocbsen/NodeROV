var i2cBus = require("i2c-bus");
var Pca9685Driver = require("pca9685").Pca9685Driver;

var options = {
    i2c: i2cBus.openSync(1),
    address: 0x40,
    frequency: 50,
    debug: true
};

function pulse(channel) {
    return new Promise((resolve, reject) => {
        pwm.setPulseLength(channel, 1600);
        setTimeout(() => {
            pwm.setPulseLength(channel, 1550);
            resolve();
        }, 200);
    });
}

pwm = new Pca9685Driver(options, function(err) {
    if (err) {
        console.error("Error initializing PCA9685");
        process.exit(-1);
    }
    console.log("Initialization done");


    // IDENTIFY MOTORS :P 
    setTimeout(async () => {
        for (let i = 0; i < 6; i++) {
            setTimeout(async () => { await pulse(i); }, i * 2000);
        }
    }, 2000);

    // runDelay(2000, () => { pwm.setPulseLength(7, 1500) });
    // runDelay(3000, () => { pwm.setPulseLength(7, 1000) });
    // pwm.setPulseLength(8, 1000)
});


function runDelay(time, funciton) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            funciton();
            resolve();
        }, time);
    });
}