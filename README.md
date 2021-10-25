# NodeROV

NodeROV is a project created by me (Thorleif Jacobsen) to run and control an underwater remote controlled vehicle easily with and Raspberry PI, some sensors and a gamepad.

I have had 5+ successful trips at the current date (21st April 17) but are still adding improvements and want to make it much more user friendly than it currently is.

# Screenshot:

![Screenshot](https://d3vv6lp55qjaqc.cloudfront.net/items/2x2n2W0d2b423f021U2f/noderov-screen1.png)

# Setup Raspberry PI

1. Install raspberry pi
2. Do the following:
   *. sudo raspi-config
   *. Expand File System
   *. Enable Camera
   *. Advance -> Enable I2C
   *. sudo  reboot
3. Enable i2c read-write: *sudo chmod o+rw /dev/i2c*
4. install NodeJS and NPM with:
   *. wget https://nodejs.org/dist/v6.9.5/node-v6.9.5-linux-armv7l.tar.xz
   *. sudo mv node-v6.9.5-linux-armv7l.tar.xz /
   *. cd /opt
   *. sudo tar xf node-v6.9.5-linux-armv7l.tar.xz
   *. sudo mv node-v6.9.5-linux-armv7l nodejs
   *. sudo rm node-v6.9.5-linux-armv7l.tar.xz
   *. sudo ln -s /opt/nodejs/bin/node /usr/bin/node
   *. sudo ln -s /opt/nodejs/bin/npm /usr/bin/npm

# Extra setup (Recommended)

* Allow node to gain access to ports below 1024 if you want to use port 80 and 82
   * ```sudo setcap 'cap_net_bind_service=+ep' /opt/nodejs/bin/node```
* Disable HDMI add the following to ***/etc/rc.local***
   * ```sudo /opt/vc/bin/tvservice -o```
* Enable pi to run the script at boot, add to ***/etc/rc.local***:
   * ```sudo -H -u pi bash -c 'sh ~/NodeROV/start.sh```

# Installing NodeROV

1. Login as user ***pi*** on your RaspberryPI
2. Run command: ```cd ~```
3. Run command: ```git clone https://github.com/thorleifjaocbsen/NodeROV.git```
4. Run command: ```cd ~/NodeROV```
5. Run command: ```npm install```
6. Reboot your Pi (```sudo reboot```)

# DISCLAIMER

Use this software at own risk, I do NOT recommend you to use this software if you do now know what you are doing. It is not 100% finished and stuff might go haywire at any second! I might remove this disclaimer when I'm done with the project, but who knows? Who wants to take responsibility for anything these days! :)
