class Controls {

    constructor() {

        this.gp = null;
        this.forward = 0; // [-100,+100] Forward and reverse
        this.backward = 0; // [-100,+100] Left and Right
        this.yaw = 0; // [-100,+100] Turn left, Turn right
        this.climb = 0; // [-100,+100] Up and down

        this.map = {
            gainUp: 12,
            gainDown: 13,
            lightsUp: 15,
            lightsDown: 14,
            cameraUp: 5,
            cameraDown: 7,
            fullscreen: 1,
            depthhold: 0,
            gripClose: 6,
            gripOpen: 4,
            arm: 9,
            disarm: 8,
        };
        this.callbacks = {};
        this.debounce = {};
        this.repeatInterval = {};
        this.repeatIntervalTimer = {};

        this.lastUpdate = 0;
        this.changedSinceReturn = false;
        this.warned = false;

        document.addEventListener("keydown", this.keyDown);
        document.addEventListener("keyup", this.keyUp);
    }

    checkGamepad() {
        try {
            this.gp = navigator.getGamepads()[0];
            return this.gp.connected;
        } catch (err) {
            return false;
        }
    }

    update() {
        if (!this.checkGamepad()) return false;

        if (this.lastUpdate == this.gp.timestamp) return false;
        this.lastUpdate = this.gp.timestamp;
        this.changedSinceReturn = true;

        this.forward = Math.round(this.gp.axes[1] * 100);
        this.strafe = -1 * Math.round(this.gp.axes[0] * 100);
        this.yaw = -1 * Math.round(this.gp.axes[2] * 100);
        this.climb = Math.round(this.gp.axes[3] * 100);

        // Deadband
        if (Math.abs(this.forward) < 5) this.forward = 0;
        if (Math.abs(this.strafe) < 5) this.strafe = 0;
        if (Math.abs(this.yaw) < 5) this.yaw = 0;
        if (Math.abs(this.climb) < 5) this.climb = 0;

        for (var btn in this.gp.buttons) {
            if (this.gp.buttons[btn].pressed && !this.debounce[btn] && typeof this.callbacks[btn] == "function") {
                this.callbacks[btn]();
                this.debounce[btn] = true;
                if (this.repeatInterval[btn] > 0) {
                    this.repeatIntervalTimer[btn] = setInterval(this.callbacks[btn], this.repeatInterval[btn]);
                }
            } else {
                this.debounce[btn] = false;
                clearInterval(this.repeatIntervalTimer[btn]);
            }
        }

    }

    onPress(btn, callback, bounceDelete) {
        if (isNaN(bounceDelete)) bounceDelete = 0;
        bounceDelete = parseInt(bounceDelete);
        this.callbacks[btn] = callback;
        this.repeatInterval[btn] = bounceDelete;
    }

    keyDown(e) {
        console.log("Key down: %d", e.keyCode);
    }

    keyUp(e) {
        console.log("Key up: %d", e.keyCode);
    }

    returnObject() {
        var ret = {};
        for (var i in self) {
            let t = typeof self[i];
            if (t !== "function" && t != "object") {
                ret[i] = self[i];
            }
        }
        this.changedSinceReturn = false;
        return ret;
    }
}