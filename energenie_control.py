# pyright: reportMissingTypeStubs=false, reportPrivateUsage=false

import logging

from gpiozero.boards import _EnergenieMaster
from gpiozero.exc import BadPinFactory
from gpiozero.pins.mock import MockFactory

ENERGENIE_IDS = (1, 2, 3, 4)
_LOGGER = logging.getLogger(__name__)
_controller: _EnergenieMaster | None = None


def _get_controller() -> _EnergenieMaster | None:
    global _controller

    if _controller is not None:
        return _controller

    try:
        _controller = _EnergenieMaster(pin_factory=None)
    except BadPinFactory:
        _LOGGER.warning(
            "Energenie pin factory unavailable; running in no-op transmit mode."
        )
        _controller = _EnergenieMaster(pin_factory=MockFactory())

    return _controller


def transmit(socket: int, value: bool) -> None:
    assert socket in ENERGENIE_IDS
    controller = _get_controller()
    if controller is None:
        return
    controller.transmit(socket, value)  # pyright: ignore[reportUnknownMemberType]
    _LOGGER.debug(f"Transmitted to socket {socket}: {value}")


def transmit_all(value: bool) -> None:
    controller = _get_controller()
    if controller is None:
        return
    controller.transmit(5, value)  # pyright: ignore[reportUnknownMemberType]
    _LOGGER.debug(f"Transmitted to all sockets (5): {value}")
