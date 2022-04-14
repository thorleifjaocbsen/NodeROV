import GUI from './gui.js';
import Socket from './socket.js';
import Controls from './controls.js';
import Video from './video.js';

const gui = new GUI();
const controls = new Controls();
const socket = new Socket();
const video = new Video(document.getElementById("video"));

const rovData = {};
let vacuumTest = false;
let confirmWaterTight = false;

console.log = gui.log

/************************
 * Video Socket - Used for camera transmit
 ************************/
video.connect(location.hostname, 8282);


/************************
 * GUI Class - Initializing GUI functionality
 ************************/

gui.log("Initializing NodeROV GUI");
gui.socket = socket;

gui.accelCanvas = document.getElementById("accelerometerCanvas");
gui.compassCanvas = document.getElementById("compassCanvas");
gui.dataGraphCanvas = document.getElementById("dataGraphicsCanvas");

gui.setButton("gui-controls-button-1", "LEFT LIGHT", function (e) {
    if (gui.getButtonState(0)) {
        socket.send("setlight 0 0");
    } else {
        e.target.className = "selected";
        socket.send("setlight 0 100");
    }
});
gui.setButton("gui-controls-button-3", "RIGHT LIGHT", function (e) {
    if (gui.getButtonState(2)) {
        socket.send("setlight 1 0");
    } else {
        e.target.className = "selected";
        socket.send("setlight 1 100");
    }
});


gui.setButton("gui-controls-button-4", "TEST", function (e) {
    if (gui.buttonState("gui-controls-button-4")) {
        gui.buttonState("gui-controls-button-4", false);
    } else {
        gui.buttonState("gui-controls-button-4", true);;
    }
    // Generate random number between 0 and 100
    let randomNumber = Math.floor(Math.random() * 100);
    gui.animateScale("scale1", randomNumber, randomNumber);
});

gui.setButton("gui-controls-button-2", "ARM", function (e) { socket.send("armtoggle"); });
gui.setButton("gui-controls-button-5", "HEADING HOLD", function (e) { socket.send("headinghold"); });
gui.setButton("gui-controls-button-6", "DEPTH HOLD", function (e) { socket.send("depthhold"); });
gui.setButton("gui-controls-button-7", "RECORD", function (e) {
    if (gui.buttonState("gui-controls-button-7")) {
        video.stopRecord();
        gui.buttonState("gui-controls-button-7", false);
    } else {
        video.startRecord();
        gui.buttonState("gui-controls-button-7", true);
    }

});
video.on("recordStateChange", (state) => {
    gui.buttonState("gui-controls-button-7", state == "recording");
    gui.log(`Recording state changed to ${state}`);
})

gui.setButton("gui-controls-button-8", "FULLSCREEN", function (e) {
    const videoEl = document.getElementById("video");
    videoEl.classList.toggle("fullscreen");
    gui.buttonState("gui-controls-button-8", videoEl.classList.contains("fullscreen"));
    videoEl.onclick = () => { gui.pressButton("gui-controls-button-8"); };
});
gui.setButton("gui-controls-button-9", "SET FLAT", function (e) { socket.send("setflat"); });
gui.setButton("gui-controls-button-10", "CALIBRATE GYRO", function (e) { socket.send("calibrategyro"); });
gui.setButton("gui-log-button-1", "ADD EVENT", function (e) {
    var msg = "<p>Enter message: <input id='eventmsg' type='text' value='' /></p>";
    popup("Add event", msg, "Add", "Cancel", function () {
        gui.log("Custom event: " + $("#eventmsg").val());
        popup_hide();
    });
    $("#eventmsg").focus();
});
gui.setButton("gui-log-button-2", "SCREENSHOT", function (e) {
    var data = player.canvas.toDataURL("image/jpeg", 1);
    var filename = "noderov_" + (Date.now() / 1000) + ".jpg";
    gui.log("Screenshot saved (" + filename + ")");
    $("<a download='" + filename + "' href='" + data + "'></a>")[0].click();

});




gui.setInfo(1, 0, "Int. temp:");
gui.setInfo(2, 0, "Int. pressure:");
gui.setInfo(3, 0, "Ext. temp:");
gui.setInfo(4, 0, "Ext. pressure:");
gui.setInfo(5, 0, "Core temp:");
gui.setInfo(6, 0, "mAh:");
gui.setInfo(7, 0, "Gain:");
gui.setInfo(8, 0, "Turns:");
gui.setInfo(9, 0, "Heading Hold:");
gui.setInfo(10, 0, "Depth Hold:");
gui.setInfo(11, "", "-");
gui.setInfo(12, 0, "Latency:");

/************************
  * Controls on press e.t.c
 ************************/
controls.onPress(controls.map.gainUp, () => { socket.send("setgain " + (rovData.gain + 50)); });
controls.onPress(controls.map.gainDown, () => { socket.send("setgain " + (rovData.gain - 50)); });
controls.onPress(controls.map.lightsUp, () => {
    socket.send("setlight 0 " + (rovData.lights[0] + 10));
    socket.send("setlight 1 " + (rovData.lights[1] + 10));
}, 100);
controls.onPress(controls.map.lightsDown, () => {
    socket.send("setlight 0 " + (rovData.lights[0] - 10));
    socket.send("setlight 1 " + (rovData.lights[1] - 10));
}, 100);
controls.onPress(controls.map.cameraUp, () => { socket.send("setcamera " + (rovData.cameraPosition - 1)); }, 10);
controls.onPress(controls.map.cameraDown, () => { socket.send("setcamera " + (rovData.cameraPosition + 1)); }, 10);
controls.onPress(controls.map.fullscreen, () => { gui.pressButton("gui-controls-button-8"); }, 1000)
controls.onPress(controls.map.arm, () => { socket.send("arm"); });
controls.onPress(controls.map.disarm, () => { socket.send("disarm"); });
controls.onPress(controls.map.depthhold, () => { socket.send("depthhold"); });
controls.onPress(controls.map.gripOpen, () => { socket.send("gripopen"); }, 50);
controls.onPress(controls.map.gripClose, () => { socket.send("gripclose"); }, 50);

/************************
 *
 *
 * Data Socket - Used for telemetry
 *
 *
 ************************/

var voltWarnLevel = 0;

socket.connect(location.hostname, location.port);
socket.on("hb", (data) => {
    const [sendtTime, latency] = data.split(" ");
    socket.send("hb " + sendtTime);
    gui.setInfo(12, latency)
})
socket.on("telemetryData", function (data) {
    rovData = JSON.parse(data);

    gui.setInfo(1, parseFloat(rovData.inside.temp).toFixed(2))
    gui.setInfo(2, parseFloat(rovData.inside.pressure / 1000 * 14.5037738).toFixed(2))
    gui.setInfo(3, parseFloat(rovData.outside.temp).toFixed(2))
    gui.setInfo(4, parseFloat(rovData.outside.pressure / 1000 * 14.5037738).toFixed(2))

    gui.setInfo(5, parseFloat(rovData.inside.coreTemp).toFixed(2))
    gui.setInfo(6, parseInt(rovData.mAmpUsed))
    gui.setInfo(7, parseInt(rovData.gain))
    gui.setInfo(8, parseInt(rovData.heading.turns))

    gui.setInfo(9, rovData.heading.hold ? parseInt(rovData.heading.totalHeading) + "/" + parseInt(rovData.heading.wanted) : "OFF")
    //gui.setInfo(11, "Unused")
    //gui.setInfo(12, "Unused")


    // Update lights gui
    for (i in rovData.lights) { gui.setButtonState(2 * i, rovData.lights[i] > 0); }

    // Update armed gui
    gui.setButtonState(1, rovData.armed);
    gui.setButtonState(5, rovData.depth.hold);
    gui.setButtonState(4, rovData.heading.hold);

    var insidePressure = parseFloat(rovData.inside.pressure / 1000 * 14.5037738).toFixed(2);
    if (insidePressure < 14 && !vacuumTest) {
        popup("Vacuum test - Stage 1", "<p>Starting automatic vacuum test due to lower internal pressure.<br />Be sure the LiPo battery is not inside and you use a vacuum safe battery.<br /><br />Current pressure is: <span class='currpress'>" + insidePressure + "</span></p>");
        gui.log("Vacuum Test: Stage 1 starting")
        vacuumTest = 1;
    } else if (insidePressure < 12 && insidePressure > 4.5 && vacuumTest == 1) {
        $(".currpress").html(insidePressure);
    } else if (insidePressure <= 5 && vacuumTest == 1) {
        popup("Vacuum test - Stage 2", "<p>Vacuum test at wanted pressure. Stop pumping now:<br /><br />Time passed: <span class='timepassed'>0</span> sec of 900<br />Current pressure is: <span class='currpress'>" + insidePressure + "</span></p>");
        gui.log("Vacuum Test: Stage 2 starting")
        vacuumTest = Date.now();
    } else if (vacuumTest && insidePressure > 14) {
        popup_hide();
        vacuumTest = false;
        gui.log("Vacuum Test: Cancelled")
    }
    if (vacuumTest >= 4) {
        var passed = (Date.now() - vacuumTest) / 1000;
        $(".timepassed").html(Math.round(passed));
        $(".currpress").html(insidePressure);

        if (passed > 900 && insidePressure <= 5) {
            vacuumTest = 3;
            gui.log("Vacuum Test: Passed, pressure after 15 minutes are " + insidePressure + " PSI");

            popup("Vacuum test - Passed", "<p>ROV seems tight, internal pressure did not go above 5PSI in the period of 60 seconds.<br /><br />Release pressure before you continue then press 'Confirm'</p>", "Confirm", false, function () {
                vacuumTest = false;
                popup_hide();
            });
        } else if (insidePressure > 5) {
            vacuumTest = 3;
            gui.log("Vacuum Test: FAILED, pressure after " + (passed / 60) + " minutes are " + insidePressure + " PSI");
            popup("Vacuum test - Fail", "<p>ROV seems leaky, internal pressure did pass 4.5PSI during the test period.<br />It hit " + insidePressure + " in only " + passed + " seconds..<br /><br />Release pressure before you continue then press 'Confirm' then check for leaks</p>", "Confirm", false, function () {
                popup_hide();
                vacuumTest = false;
            });
        }
    }

    // On Screen Warnings:
    if (rovData.volt < 10.5 && voltWarnLevel == 0) {
        gui.overlayText("Voltage warning", 3);
        voltWarnLevel = 1;
    } else if (rovData.volt < 9.8 && voltWarnLevel == 1) {
        gui.overlayText("Voltage warning", 3);
        voltWarnLevel = 2;
    } else if (rovData.volt < 9 && voltWarnLevel == 2) {
        gui.overlayText("Battery dying", 100);
        voltWarnLevel = 3;
    }


});
socket.on("log", function (data) {
    try {
        data = JSON.parse(data);
        gui.log(data.message, data.time, true);
    } catch (e) { }
})


/************************
 *
 *
 * Start system loop
 *
 *
 ************************/

let tempCounter = 0;

function systemLoop() {
    if (controls.changedSinceReturn) {
        socket.send('controls ' + JSON.stringify(controls.returnObject()));
    }

    // ! < add it below to enable gp warning again (before controls.warned)
    if (!controls.checkGamepad() && controls.warned) {
        popup("Connect Gamepad", "Please connect the gamepad to continue.");
        controls.warned = true;
    } else if (controls.checkGamepad() && controls.warned) {
        popup_hide();
        controls.warned = false;
    } else if (confirmWaterTight == false && controls.warned == false) {
        //popup("Confirm water tightness of chambers", "Check for loose connectors and that vacuum plugs are connected before pressing confirm!", "Confirm");
        confirmWaterTight = true;
    }

    if (controls.checkGamepad()) controls.update();
    if (rovData.heading) {
        gui.drawCompass(rovData.heading.current);
    }

    /* Temp to show gui working */
    if (tempCounter > 30) {
        var compass = Math.floor(Math.random() * 360);
        var roll = Math.floor(Math.random() * 14) - 7;
        var pitch = Math.floor(Math.random() * 6) - 3;
        var depth = Math.floor(Math.random() * 100);

        gui.animateDataGraph();
        gui.drawCompass(compass);
        gui.drawAccelerometer(pitch, roll);
        gui.animateScale("scale1", depth, depth);
        gui.animateScale("scale2", depth, depth);
        gui.animateScale("scale3", depth, depth);
        tempCounter = 0;
    }
    else tempCounter++;

    if (rovData.outside) {
        var PSI = parseFloat(rovData.outside.pressure / 1000 * 14.5037738).toFixed(2);
        gui.animateScale(1, gui.map(parseInt(PSI), 0, 1450, 0, 100), PSI + " PSI");
        gui.animateScale(2, parseInt(rovData.outside.depth), rovData.outside.depth.toFixed(2) + " M");
        gui.animateScale(3, gui.map(parseInt(rovData.outside.temp), -30, 30, 0, 100), rovData.outside.temp.toFixed(2) + " &deg;");
    }

    let d = new Date().toISOString();
    document.getElementsByTagName("time")[0].innerHTML = d.split('T')[1].split('.')[0] + " UTC";
    document.getElementsByTagName("time")[1].innerHTML = d.split('T')[0];

    requestAnimationFrame(systemLoop);
}

systemLoop();


/*

function popup(title, message, button1, button2, button1_callback, button2_callback) {
    if (!button1_callback && button1) {
        button1_callback = popup_hide;
    }
    if (!button2_callback && button2) {
        button2_callback = popup_hide;
    }

    $(".msgbox button").css("display", "none");
    $(".msgbox button").off();

    if (button1) {
        $(".msgbox button:first").html(button1);
        $(".msgbox button:first").on('click', button1_callback);
        $(".msgbox button:first").css("display", "");
    }
    if (button2) {
        $(".msgbox button:last").html(button2);
        $(".msgbox button:last").on('click', button2_callback);
        $(".msgbox button:last").css("display", "");
    }

    $(".msgbox h1").html(title);
    $(".msgbox div:first").html(message);
    $(".msgbox").fadeIn();
    $(".msgbox-bg").fadeIn();

    $(".msgbox").css("margin-top", $(".msgbox").height() * -1);
}

function popup_hide() {
    $(".msgbox").fadeOut();
    $(".msgbox-bg").fadeOut();
}

$(".msgbox").keyup(function (e) {
    e.preventDefault();
    if (e.keyCode == 13) $(".msgbox button:first").click();
    if (e.keyCode == 27) $(".msgbox button:last").click();
});*/