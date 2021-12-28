from typing import TypedDict

class StringsDict(TypedDict):
    header: str
    on: str
    off: str

class SocketType(StringsDict):
    socket: int

SocketList = list[SocketType]

class Base(TypedDict):
    title: str
    all: StringsDict
    sockets: SocketList

def load_config() -> Base: ...
def get_version() -> str | None: ...
