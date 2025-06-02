import asyncio
import json
import sys

from RPCServer import RPCServer


# Attempt to import pysyslink_toolkit once; record availability
toolkit_error_msg = (
        "\n[ERROR] Missing required dependency 'pysyslink_toolkit'.\n"
        "Please install it in your selected Python environment:\n"
        "    pip install pysyslink_toolkit\n"
    )

toolkit_module_name = "pysyslink_toolkit"
_toolkit = None 

def try_import_toolkit():
    global _toolkit
    try:
        import pysyslink_toolkit
        _toolkit = pysyslink_toolkit
    except ImportError:
        raise RuntimeError(toolkit_error_msg)
    
def is_toolkit_imported():
    return _toolkit is not None

def before_request():
    if not is_toolkit_imported():
        try_import_toolkit()

def get_toolkit():
    if not is_toolkit_imported():
        raise RuntimeError("Tried to access the toolkit before importing it")
    return _toolkit


async def run_simulation(duration: float, steps: int):
    """
    If pysyslink_toolkit isn't available, immediately raise to
    produce an error response. Otherwise, proceed as before.
    """
    # send progress notifications via server._send(...)
    for i in range(steps):
        await asyncio.sleep(duration / steps)
        server._send({
            "type": "notification",
            "event": "progress",
            "data": {"progress": (i + 1) * 100 // steps}
        })
    return {"status": "completed"}

async def get_libraries():
    before_request()
    libraries = get_toolkit().get_available_block_libraries("/home/pello/PySysLinkToolkit/tests/data/toolkit_config.yaml")
    # Return only essential information
    return json.dumps(libraries)

server = RPCServer(before_request)
server.register_method("runSimulation", run_simulation)
server.register_method("getLibraries", get_libraries)

if __name__ == "__main__":
    asyncio.run(server.start())
