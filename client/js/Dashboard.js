/*
 * Dashboard Drawer
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

class Dashboard {
  
  constructor(canvas) {

    this.canvas = canvas
  }


  draw() {

    const width = this.canvas.width
    const height = this.canvas.height
    const ctx = this.canvas.getContext('2d')

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "rgba(255,255,255,.2)"
    ctx.fillRect(200, 0, 1, height)
    ctx.strokeStyle = "rgba(255,255,255,.2)"
    ctx.lineWidth = 3

    var x = 50
    var y = height / 2 - 100
    var w = 100
    var h = 200
    var r = 10
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.stroke()

    const fl = 30
    const fr = 50
    const ul = 80
    const ur = 90
    const bl = -50
    const br = -30

    /* FL */ this.drawThruster(x, y, fl, 45)
    /* FR */ this.drawThruster(x + 100, y, fr, 315)
    /* UL */ this.drawThruster(x + 10, y + 100, ul, 0)
    /* UR */ this.drawThruster(x + 90, y + 100, ur, 0)
    /* BL */ this.drawThruster(x, y + 200, bl, 135)
    /* BR */ this.drawThruster(x + 100, y + 200, br, 225)

    const grid = ((width - 200) / 6)
    const height1 = (height / 4) + 20
    const height2 = height / 4 * 3


    const voltPercentage = 32
    if (voltPercentage > 100) voltPercentage = 100
    const voltColor = voltPercentage > 30 ? 'rgba(255,255,255,1)' : 'rgba(231,96,98,1)'

    const amp = 34.22
    const ampPercentage = 40
    if (ampPercentage > 100) ampPercentage = 100
    const ampColor = ampPercentage < 50 ? 'rgba(255,255,255,1)' : 'rgba(231,96,98,1)'

    const diskSpace = Math.round(100 / 80 * 40);
    const diskColor = diskSpace < 80 ? 'rgba(255,255,255,1)' : 'rgba(231,96,98,1)';
    const cpuColor = 30 < 80 ? 'rgba(255,255,255,1)' : 'rgba(231,96,98,1)';
    const memSpace = Math.round(100 / 4095 * 2032);
    const memColor = memSpace < 80 ? 'rgba(255,255,255,1)' : 'rgba(231,96,98,1)';

    this.drawScale(200 + grid * 1, height1, "VOLTAGE", voltPercentage, voltColor, 13.5);
    this.drawScale(200 + grid * 3, height1, "AMPERE", ampPercentage, ampColor, amp);
    this.drawScale(200 + grid * 5, height1, "UNUSED", 0, 'rgba(255,255,255,1)');

    this.drawScale(200 + grid * 1, height2, "RAM LEFT (MB)", memSpace, memColor, 2132);
    this.drawScale(200 + grid * 3, height2, "CPU (%)", 32.1, cpuColor);
    this.drawScale(200 + grid * 5, height2, "DISK SPACE (GB)  ", diskSpace, diskColor, 4 + "/" + 16);

  }


  drawScale(x, y, title, percentage, color, value) {

    const ctx = this.canvas.getContext('2d')

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
  }


  drawThruster(x, y, percentage, direction) {

    const ctx = this.canvas.getContext('2d')

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
      
      // Arrow
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
  }
}
