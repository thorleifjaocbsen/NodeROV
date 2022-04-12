scriptDir=$(dirname $(readlink -f $0))

pushd $scriptDir  > /dev/null

screen -dmS cam node app_camera
screen -dmS app node app

popd > /dev/null