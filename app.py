from flask import Flask, abort, render_template
from gpiozero.boards import _EnergenieMaster

from config import get_version, load_config


app = Flask(__name__)
CONFIG = load_config()
ENERGENIE_IDS = (1, 2, 3, 4)
CONTROLLER = _EnergenieMaster(pin_factory=None)
VERSION = get_version()


def transmit(socket: int, value: bool) -> None:
    assert socket in ENERGENIE_IDS
    CONTROLLER.transmit(socket, value)


def transmit_all(value: bool) -> None:
    CONTROLLER.transmit(5, value)


@app.route("/")
def main_page():
    return render_template("index.html", config=CONFIG, version=VERSION)


@app.route("/energenie/<int:socket>/on", methods=["POST"])
def energenie_single_on(socket: int):
    if socket not in ENERGENIE_IDS:
        abort(400)
    transmit(socket, True)
    return "", 204


@app.route("/energenie/all/on", methods=["POST"])
def energenie_all_on():
    transmit_all(True)
    return "", 204


@app.route("/energenie/<int:socket>/off", methods=["POST"])
def energenie_single_off(socket: int):
    if socket not in ENERGENIE_IDS:
        abort(400)
    transmit(socket, False)
    return "", 204


@app.route("/energenie/all/off", methods=["POST"])
def energenie_all_off():
    transmit_all(False)
    return "", 204
