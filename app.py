from flask import Flask, abort, render_template
from gpiozero import Energenie

from config import get_version, load_config


app = Flask(__name__)
CONFIG = load_config()
CONTROLLERS = {
    socket["socket"]: Energenie(socket["socket"]) for socket in CONFIG["sockets"]
}
VERSION = get_version()


@app.route("/")
def main_page():
    return render_template("index.html", config=CONFIG, version=VERSION)


@app.route("/energenie/<int:socket>/on", methods=["POST"])
def energenie_single_on(socket: int):
    if socket not in CONTROLLERS:
        abort(400)
    CONTROLLERS[socket].on()
    return "", 204


@app.route("/energenie/all/on", methods=["POST"])
def energenie_all_on():
    for socket in CONTROLLERS:
        CONTROLLERS[socket].on()
    return "", 204


@app.route("/energenie/<int:socket>/off", methods=["POST"])
def energenie_single_off(socket: int):
    if socket not in CONTROLLERS:
        abort(400)
    CONTROLLERS[socket].off()
    return "", 204


@app.route("/energenie/all/off", methods=["POST"])
def energenie_all_off():
    for socket in CONTROLLERS:
        CONTROLLERS[socket].off()
    return "", 204
