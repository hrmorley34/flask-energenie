from flask import Flask, render_template
from gpiozero import Energenie


app = Flask(__name__)
ENERGENIE_1 = Energenie(1)


@app.route("/")
def main_page():
    return render_template("index.html")


@app.route("/energenie/1/on", methods=["POST"])
def energenie_1_on():
    ENERGENIE_1.on()
    return "", 204


@app.route("/energenie/1/off", methods=["POST"])
def energenie_1_off():
    ENERGENIE_1.off()
    return "", 204
