import json
from pathlib import Path
import traceback
from typing import Optional


Base = ...
StringsDict = ...
SocketType = ...
SocketList = ...


def load_config():
    with open("config.json", "r") as f:
        return json.load(f)


def _get_version() -> Optional[str]:
    dotgit = Path(".git")
    if not dotgit.exists():
        return None

    head = dotgit / "HEAD"
    assert head.exists()

    ref = head.read_text().rstrip("\n")
    if ref.startswith("ref: "):
        branchhead = dotgit / ref[5:]
        hash = branchhead.read_text().rstrip("\n")
        return ref.split("/")[-1] + ": " + hash[:10]
    else:
        hash = ref
        return hash[:10]


def get_version() -> Optional[str]:
    try:
        return _get_version()
    except Exception:
        traceback.print_exc()
        return None
