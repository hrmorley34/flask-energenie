from flask import Flask, abort, render_template

from config import get_version, load_config
from energenie_control import ENERGENIE_IDS, transmit, transmit_all

app = Flask(__name__)
CONFIG = load_config()
VERSION = get_version()


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
