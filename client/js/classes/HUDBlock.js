/*
 * HudBlock Drawer
 * Author: Thorleif Jacobsen
 * Credits: Myself, my family and my girlfriend and child.
 */

export default class HUDBlock {
  
  constructor(canvas) {

    this.canvas = canvas
    this.compassRose = new Image()
    this.compassRose.src = "gfx/compass_rose.png"
  }


  draw(pitch = 0, roll = 0, heading = 0) {

    const width = this.canvas.width
    const height = this.canvas.height
    const ctx = this.canvas.getContext('2d')

    ctx.clearRect(0, 0, width, height);
    ctx.save()
    this.drawArtificialHorizon(pitch, roll)
    this.drawCompass(heading)
    ctx.restore()
  }


  drawArtificialHorizon(pitch, roll) {

    const width         = this.canvas.width
    const height        = this.canvas.height
    const ctx           = this.canvas.getContext('2d')
    const centerY       = height / 2
    const centerX       = width / 2
    const pixelPrDegree = (height / 2) / 30 // (Top = 30 deg bottom = -30 deg)

    

    // Draw background lines each 5deg
    ctx.fillStyle = "rgba(145,152,169,0.2)";
    ctx.fillRect(0, centerY - (pixelPrDegree * 20), width, 2) // +20 degrees
    ctx.fillRect(0, centerY - (pixelPrDegree * 10), width, 2) // +10 degrees
    ctx.fillRect(0, centerY, width, 2)                        // 0 degrees
    ctx.fillRect(0, centerY + (pixelPrDegree * 10), width, 2) // -10 degrees
    ctx.fillRect(0, centerY + (pixelPrDegree * 20), width, 2) // -20 degrees

    // Draw square showing roll and pitch
    ctx.beginPath()
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    if (Math.abs(roll) > 5 || Math.abs(pitch) > 5) { ctx.fillStyle = "rgba(231,96,98,.2)"; }
    else { ctx.fillStyle = "rgba(255,255,255,.2)"; }
    ctx.lineWidth = 2;
    ctx.save()
    ctx.translate(centerX, centerY + pitch * pixelPrDegree);
    ctx.rotate(roll * Math.PI / 180);
    ctx.translate(-centerX, 0);
    ctx.rect(-centerX, 0, width * 2, height * 4);
    ctx.restore()
    ctx.stroke();
    ctx.fill();
    ctx.closePath()    


    
    roll = Math.round(roll);
    pitch = Math.round(pitch);

    // Common text formats
    ctx.font = "bold 15px Open Sans";
    ctx.textBaseline = "middle";

    // Draw PITCH text    
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.fillText("PITCH", 20, centerY);
    ctx.fillStyle = "rgb(231,96,98)";
    ctx.fillText(pitch + "°", 20 + ctx.measureText("PITCH ").width, centerY)

    // Draw ROLL text
    ctx.textAlign = "right";
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.fillText("ROLL", width - 20 - ctx.measureText(roll + "° ").width, centerY);
    ctx.fillStyle = "rgb(231,96,98)";
    ctx.fillText(roll + "°", width - 20, centerY)

    ctx.restore()
  }


  drawCompass(heading) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.canvas.getContext("2d");

    heading = Math.round(heading)

    // Rose
    const left = (width / 2 - 74) - ((1200 / 360) * heading);
    ctx.drawImage(this.compassRose, left, 0);
    ctx.drawImage(this.compassRose, -1200 + left, 0);
    ctx.drawImage(this.compassRose, 1200 + left, 0);

    // Heading background
    ctx.save()
    ctx.beginPath()
    ctx.fillStyle = "#fb6362";
    ctx.strokeStyle = "rgba(145,152,169,1)";
    ctx.lineWidth = 2;
    ctx.rect(width/2-35,-2,70,30)
    ctx.stroke()
    ctx.fill()
    ctx.closePath()
    ctx.restore()

    // Heading
    ctx.font = "bold 25px Open Sans";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.fillText(heading.toString().padStart(3,'0'), width/2, 15);
  }


  drawGauges(no, title, value) {

  }



}
