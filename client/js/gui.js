class GUI {

    constructor() {
        this.accelCanvas = null;
        this.compassCanvas = null;
        this.compassRose = new Image();
        this.dataGraphCanvasContext = null;
        this.socket = null;
        this.compassRose.src = 'gfx/compass_rose.png';
    };

    map(x, in_min, in_max, out_min, out_max) {
        return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    };

    log(text, time, dontsend) {
        if (time == undefined) time = Date.now();

        if (socket != null && !dontsend) {
            socket.send("clog " + time + " " + text);
        }

        let d = new Date(time).toISOString();
        let timestamp = d.split('T')[1].split('.')[0] + " | " + d.split('T')[0];
        $(".logs table").prepend("<tr><th>" + timestamp + "</th><td>" + text + "</td></tr>");

    };

    drawAccelerometer(pitch, roll) {
        let canvas = this.accelCanvas;
        let ctx = canvas.getContext("2d");
        let width = canvas.width;
        let height = canvas.height;
        let y = height / 2;
        let x = width / 2;
        let pixelPrDegree = (height / 2) / 10;

        ctx.save();
        ctx.clearRect(0, 0, width, height);

        // Draw background lines each 5deg
        ctx.fillStyle = "rgba(145,152,169,0.2)";
        ctx.fillRect(0, pixelPrDegree * 5, width, 2); // -5 degrees
        ctx.fillRect(0, pixelPrDegree * 5 * 2, width, 2); // 0 degrees
        ctx.fillRect(0, pixelPrDegree * 5 * 3, width, 2); // +5 degrees
        // Draw square showing roll and pitch
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        if (Math.abs(roll) > 5 || Math.abs(pitch) > 5) { ctx.fillStyle = "rgba(231,96,98,.2)"; } else { ctx.fillStyle = "rgba(255,255,255,.2)"; }
        ctx.lineWidth = 2;
        ctx.translate(x, y + pitch * pixelPrDegree);
        ctx.rotate(roll * Math.PI / 180);
        ctx.translate(-x, 0);
        ctx.rect(-width / 2, 0, width * 2, height * 4);
        ctx.stroke();
        ctx.fill();
        ctx.closePath();
        ctx.restore();

        roll = Math.round(roll);
        pitch = Math.round(pitch);

        // Common text formats
        ctx.font = "bold 15px Open Sans";
        ctx.textBaseline = "middle";

        // Draw PITCH text
        ctx.fillStyle = "rgb(255,255,255)";
        ctx.fillText("PITCH", 20, y);
        ctx.fillStyle = "rgb(231,96,98)";
        ctx.fillText(pitch + "°", 20 + ctx.measureText("PITCH ").width, y)

        // Draw ROLL text
        ctx.textAlign = "right";
        ctx.fillStyle = "rgb(255,255,255)";
        ctx.fillText("ROLL", width - 20 - ctx.measureText(roll + "° ").width, y);
        ctx.fillStyle = "rgb(231,96,98)";
        ctx.fillText(roll + "°", width - 20, y)

        ctx.restore();

    };

    drawCompass(degrees) {
        if (rovData.heading == undefined) return;
        let canvas = this.compassCanvas;
        let ctx = canvas.getContext("2d");
        let width = canvas.width;
        let height = canvas.height;
        degrees = Math.round(degrees);
        ctx.clearRect(0, 0, width, height);
        var left = (width / 2 - 74) - ((1200 / 360) * degrees);
        ctx.drawImage(this.compassRose, left, 0);
        ctx.drawImage(this.compassRose, -1200 + left, 0);
        ctx.drawImage(this.compassRose, 1200 + left, 0);

        var ans = "000".substring(0, 3 - degrees.toString().length) + degrees
        $(".fvitals .compass .heading").html(ans);
    };

    animateDataGraph() {
        if (rovData.motors == undefined) return;

        let canvas = this.dataGraphCanvasContext;
        let ctx = canvas.getContext("2d");
        let width = canvas.width;
        let height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "rgba(255,255,255,.2)";
        ctx.fillRect(200, 0, 1, height);
        ctx.strokeStyle = "rgba(255,255,255,.2)";
        ctx.lineWidth = 3;

        var x = 50;
        var y = height / 2 - 100;
        var w = 100;
        var h = 200;
        var r = 10;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.stroke();

        var fl = this.map(rovData.motors.frontleft, 1150, 1950, -100, 100);
        var fr = this.map(rovData.motors.frontright, 1150, 1950, -100, 100);
        var ul = this.map(rovData.motors.upleft, 1150, 1950, -100, 100) * -1;
        var ur = this.map(rovData.motors.upright, 1150, 1950, -100, 100);
        var bl = this.map(rovData.motors.backleft, 1150, 1950, 100, -100);
        var br = this.map(rovData.motors.backright, 1150, 1950, 100, -100);

        /* FL */
        this.drawThruster(ctx, x, y, fl, 45);
        /* FR */
        this.drawThruster(ctx, x + 100, y, fr, 315);
        /* UL */
        this.drawThruster(ctx, x + 10, y + 100, ul, 0);
        /* UR */
        this.drawThruster(ctx, x + 90, y + 100, ur, 0);
        /* BL */
        this.drawThruster(ctx, x, y + 200, bl, 135);
        /* BR */
        this.drawThruster(ctx, x + 100, y + 200, br, 225);

        var grid = ((width - 200) / 6);
        var height1 = (height / 4) + 20;
        var height2 = height / 4 * 3;


        var voltPercentage = this.map(rovData.volt, 9.0, 12.6, 0, 100);
        if (voltPercentage > 100) voltPercentage = 100;
        var voltColor = voltPercentage > 30 ? 'rgba(255,255,255,1)' : 'rgba(231,96,98,1)';

        var amp = parseFloat(rovData.mAmp / 1000).toFixed(2);
        var ampPercentage = this.map(amp, 0, 90, 0, 100);
        if (ampPercentage > 100) ampPercentage = 100;
        var ampColor = ampPercentage < 50 ? 'rgba(255,255,255,1)' : 'rgba(231,96,98,1)';

        var diskSpace = Math.round(100 / rovData.disk.total * rovData.disk.used);
        var diskColor = diskSpace < 80 ? 'rgba(255,255,255,1)' : 'rgba(231,96,98,1)';
        var cpuColor = rovData.cpu < 80 ? 'rgba(255,255,255,1)' : 'rgba(231,96,98,1)';
        var memSpace = Math.round(100 / rovData.memory.total * rovData.memory.used);
        var memColor = memSpace < 80 ? 'rgba(255,255,255,1)' : 'rgba(231,96,98,1)';

        this.drawScale(ctx, 200 + grid * 1, height1, "VOLTAGE", voltPercentage, voltColor, rovData.volt);
        this.drawScale(ctx, 200 + grid * 3, height1, "AMPERE", ampPercentage, ampColor, amp);
        this.drawScale(ctx, 200 + grid * 5, height1, "UNUSED", 0, 'rgba(255,255,255,1)');

        this.drawScale(ctx, 200 + grid * 1, height2, "RAM LEFT (MB)", memSpace, memColor, rovData.memory.total - rovData.memory.used);
        this.drawScale(ctx, 200 + grid * 3, height2, "CPU (%)", rovData.cpu.toFixed(1), cpuColor);
        this.drawScale(ctx, 200 + grid * 5, height2, "DISK SPACE (GB)  ", diskSpace, diskColor, rovData.disk.used + "/" + rovData.disk.total);

    };


    drawScale(ctx, x, y, title, percentage, color, value) {
        ctx.save();
        ctx.translate(x, y);

        if (!value) value = percentage;

        ctx.font = "bold 20px 'Open Sans'";
        ctx.textAlign = "center";
        ctx.fillStyle = color;
        ctx.fillText(value, 0, 7)

        ctx.font = "bold 12px 'Open Sans'";
        ctx.textAlign = "center";
        ctx.fillStyle = color;
        ctx.fillText(title, 0, -55)

        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, 2 * Math.PI, false);
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.stroke();
        ctx.closePath();
        if (percentage > 0) {
            var pos = -0.4999 + (1.999 / 100 * percentage);
            // -0.4999 to 1.4999
            ctx.beginPath();
            ctx.arc(0, 0, 40, 1.5 * Math.PI, pos * Math.PI, false);
            ctx.lineWidth = 6.5;
            ctx.strokeStyle = color;
            ctx.stroke();
            ctx.closePath();
        }
        ctx.restore();
    };
    drawThruster(ctx, x, y, percentage, direction) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, 2 * Math.PI, false);
        ctx.fillStyle = 'rgba(255,255,255,.2)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,1)';
        ctx.stroke();
        ctx.closePath();

        if (percentage != 0) {
            var pos = -0.4999 + (1.999 / 100 * Math.abs(percentage));
            // -0.4999 to 1.4999
            ctx.beginPath();
            ctx.arc(0, 0, 15, 1.5 * Math.PI, pos * Math.PI, false);
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = 'rgba(231,96,98,1)';
            ctx.stroke();
            ctx.closePath();

            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,1)';
            ctx.fillStyle = 'rgba(255,255,255,1)';

            if (percentage < 0) {
                direction += 180;
            }

            ctx.rotate(direction * 0.0174532925);
            ctx.translate(0, -10);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(4, 6);
            ctx.lineTo(1.5, 6);
            ctx.lineTo(1.5, 10);
            ctx.lineTo(-1.5, 10);
            ctx.lineTo(-1.5, 6);
            ctx.lineTo(-4, 6);
            ctx.closePath();
            ctx.fill();

            // Two lines
            ctx.beginPath();
            ctx.moveTo(-7, 13);
            ctx.lineTo(7, 13);
            ctx.moveTo(-7, 17);
            ctx.lineTo(7, 17);
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();
    };

    animateScale(id, percentage, value) {
        $(".scale" + id + " hr").animate({ left: percentage + "%" }, 500);
        var backgroundX = ($(".scale" + id).width() / 100 * percentage);
        $(".scale" + id).animate({ "background-position-x": backgroundX - 130 }, 500);
        $(".scale" + id + " b").html(value);
    }

    setButton(name, text, callback) {
        const btn = document.getElementsByName(name)[0];
        if (!btn) return false;
        btn.innerHTML = text;
        btn.onclick = (e) => callback(e);
        return true;
    }

    buttonState(name, newState) {
        const btn = document.getElementsByName(name)[0];
        if (!btn) return null;
        else if (newState === true) { btn.classList.add("selected"); } 
        else if (newState === false) { btn.classList.remove("selected"); }
        return btn.classList.contains("selected");
    }

    pressButton(name) {
        const btn = document.getElementsByName(name)[0];
        if (!btn) return false;
        btn.click();
        return true;
    };

    overlayText(message, time) {
        $(".foverlay").html(message);
        $(".foverlay").fadeIn();
        setTimeout(function () {
            $(".foverlay").fadeOut();
        }, time * 1000);
    };

    setInfo(no, text, title = false) {
        var ulNo = Math.ceil(no / 4);
        var liNo = no - (4 * (ulNo - 1));
        if (title) $(".fdata ul:nth-of-type(" + ulNo + "n) li:nth-child(" + liNo + "n) b").html(title);
        $(".fdata ul:nth-of-type(" + ulNo + "n) li:nth-child(" + liNo + "n) span").html(text);
    };

}