#!/bin/bash
node ascii.js

scriptDir=$(dirname $(readlink -f $0))
softwareFile=$scriptDir/app.js
softwareSystemdFile=/lib/systemd/system/noderov.service

pushd $scriptDir  > /dev/null

# Uninstall
if [ "$1" == "-r" ]; then
    # Ask user if they want to install software
    echo "Uninstall NodeROV"
    echo "This will remove NodeROV system services only."
    read -p "Proceed? [y/N] " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
    rm $softwareSystemdFile > /dev/null 2>&1
    systemctl daemon-reload > /dev/null 2>&1
    echo "Removed files"
    exit 0
fi

# Check if camera and software is already installed
if [ -f $softwareSystemdFile ]; then
    # Explain how systemctl works
    echo "System service files already installed."
    echo "System service names are: noderov and noderov_camera".
    echo "If you want to uninstall, run install.sh -r"
    echo "-------------------------------------------"
    echo "To start the software, run: systemctl start <service name>"
    echo "To stop the software, run: systemctl stop <service name>"
    echo "To restart the software, run: systemctl restart <service name>"
    echo "To enable the software, run: systemctl enable <service name>"
    echo "To disable the software, run: systemctl disable <service name>"
    echo "-------------------------------------------"
    exit 0
fi

# Confirm user is root
if [ "$(whoami)" != "root" ]; then
    echo "You must be root to run this script."
    exit 1
fi

# Ask which user to start software as
read -p "Start software as user (default: $SUDO_USER): " -r startSoftwareAsUser
[ "$startSoftwareAsUser" = "" ] && startSoftwareAsUser=$SUDO_USER

# Ask user if they want to install software
read -p "Install software? (user who runs the software is '$startSoftwareAsUser'): [y/N] " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && exit 1

# Create NodeROV service file
echo "[Unit]
Description=NodeROV Service
Documentation=https://github.com/thorleifjacobsen/no.tjweb.noderov/
After=network.target

[Service]
WorkingDirectory=$scriptDir
Type=simple
User=$startSoftwareAsUser
ExecStart=/usr/local/bin/node $softwareFile
Restart=on-failure

[Install]
WantedBy=multi-user.target" > $softwareSystemdFile

systemctl daemon-reload > /dev/null 2>&1
systemctl enable noderov > /dev/null 2>&1

echo "-------------------------------------------"
echo "To start the software, run: systemctl start <service name>"
echo "Service name is: noderov"

popd > /dev/null