/*
 * Dashboard Drawer
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

class Dashboard {
  
  constructor(canvas) {

    this.canvas = canvas

    this.normalColor = 'rgba(255,255,255,1)';
    this.warningColor = 'rgba(231,96,98,1)'
    this.scales = []

    this.setScale(0, "PRESSURE",    40,   160,  30)
    this.setScale(1, "DEPTH",       90,   110,  30)
    this.setScale(2, "TEMPERATURE", 4,    30,   0)
    this.setScale(3, "VOLTAGE",     11, 16.8,   -6.8)
    this.setScale(4, "CURRENT",     20,   90,   10)
    this.setScale(5, "MAH USED",    3214, 5500, 1000)
  }

  setScale(scale, desc, value, maxValue, warningDiff) {
    
    let diff = maxValue - value;
    if(warningDiff < 0) {
      diff = diff * -1 
    }

    const color = diff < warningDiff ? this.warningColor : this.normalColor;

    this.scales[scale] = {
      desc,
      value,
      maxValue,
      percentage: Math.round(value / maxValue * 100),
      color
    }
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
    /* UL */ this.drawThruster(x + 20, y + 100, ul, 0)
    /* UR */ this.drawThruster(x + 80, y + 100, ur, 0)
    /* BL */ this.drawThruster(x, y + 200, bl, 135)
    /* BR */ this.drawThruster(x + 100, y + 200, br, 225)

    const grid = ((width - 200) / 6)
    const height1 = (height / 4) + 20
    const height2 = height / 4 * 3

    this.drawScale(200 + grid * 1, height1, this.scales[0].desc, this.scales[0].percentage, this.scales[0].color, this.scales[0].value);
    this.drawScale(200 + grid * 3, height1, this.scales[1].desc, this.scales[1].percentage, this.scales[1].color, this.scales[1].value);
    this.drawScale(200 + grid * 5, height1, this.scales[2].desc, this.scales[2].percentage, this.scales[2].color, this.scales[2].value);

    this.drawScale(200 + grid * 1, height2, this.scales[3].desc, this.scales[3].percentage, this.scales[3].color, this.scales[3].value);
    this.drawScale(200 + grid * 3, height2, this.scales[4].desc, this.scales[4].percentage, this.scales[4].color, this.scales[4].value);
    this.drawScale(200 + grid * 5, height2, this.scales[5].desc, this.scales[5].percentage, this.scales[5].color, this.scales[5].value);

  }


  drawScale(x, y, title, percentage, color, value) {

    const ctx = this.canvas.getContext('2d')

    ctx.save();
    ctx.translate(x, y);

    if (!value) value = percentage;

    ctx.font = "bold 20px Open Sans";
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.fillText(value, 0, 7)

    ctx.font = "bold 12px Open Sans";
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
