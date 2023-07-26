# WORK IN PROGRESS / NOT TESTED

# NodeROV

NodeROV is a project created by me (Thorleif Jacobsen) to run and control an underwater remote controlled vehicle easily with and Raspberry PI, some sensors and a gamepad.

I have had 5+ successful trips at the current date (21st April 17) but are still adding improvements and want to make it much more user friendly than it currently is.

# Screenshot:

![Screenshot](https://d3vv6lp55qjaqc.cloudfront.net/items/2x2n2W0d2b423f021U2f/noderov-screen1.png)

# Setup Raspberry PI

1. Install Raspberry Pi OS Lite (64 Bit)
2. Do the following:
   * `sudo apt update && sudo apt upgrade`
   * `sudo raspi-config`
   * Advanced Options -> Expand File System
   * Enable Camera (Might not be needed anymore)
   * Interface Options -> I2C -> Yes to enable
   * Finish & Yes to reboot
3. Enable i2c read-write: 
   * `sudo chmod o+rw /dev/i2c*`
4. install NodeJS and NPM with:
   * `sudo sudo apt-get install -y nodejs npm`
   * `sudo npm install -g n && sudo n stable && sudo npm install -g npm`
   * `PATH="$PATH"`

# Extra setup (Recommended)

* Allow node to gain access to ports below 1024 if you want to use port 80 and 82
   * `sudo setcap 'cap_net_bind_service=+ep' $(which node)`
* Disable HDMI add the following to ***/etc/rc.local***
   * `sudo /opt/vc/bin/tvservice -o`
* Enable pi to run the script at boot, add to ***/etc/rc.local***:
   * `sudo -H -u $USER bash -c 'sh ~/NodeROV/start.sh`

# Installing NodeROV

1. Login as your user on your RaspberryPI
2. Run command: `cd ~`
3. Run command: `git clone https://github.com/thorleifjaocbsen/NodeROV.git```
4. Run command: `cd ~/NodeROV`
5. Run command: `npm install`
6. Reboot your Pi (`sudo reboot`)

# User Interface

By default it listens to port 8000 so visit `https://noderov-ip-address:8000` to get the GUI. Accept the self-signed certificates and voila.

# DISCLAIMER

Use this software at own risk, I do NOT recommend you to use this software if you do now know what you are doing. It is not 100% finished and stuff might go haywire at any second! I might remove this disclaimer when I'm done with the project, but who knows? Who wants to take responsibility for anything these days! :)
