# flask-energenie

A small Flask web app for controlling Energenie sockets from a browser.

The UI is served from a single page and sends POST requests to switch one socket at a time or all sockets together.

## Requirements

- Python 3.9+
- Poetry
- Raspberry Pi with Pi-mote hat for Energenie mains switches

## Installation

```bash
poetry install
```

## Configuration

Create `config.json` from `config.example.json` and adjust labels as needed.

## Running the app

```bash
poetry run sudo flask run --host 0.0.0.0 --port 5000
```

To use port 80, you may need to use `sudo`:

```bash
poetry run sudo flask run --host 0.0.0.0 --port 80
```

## HTTP API

All control endpoints use `POST` and return `204 No Content` on success, or `400 Bad Request` for an invalid socket ID.

- `POST /energenie/<socket>/on`
- `POST /energenie/<socket>/off`
- `POST /energenie/all/on`
- `POST /energenie/all/off`

Note that they do not give an error if the message isn't received by the socket, since the sockets have no ability to respond.

## Formatting

Python code is formatted with `black` and `isort`. Run

```bash
poetry run isort .
poetry run black .
```
