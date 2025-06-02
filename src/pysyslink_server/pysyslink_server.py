import asyncio
import sys

from RPCServer import RPCServer


# Attempt to import pysyslink_toolkit once; record availability
toolkit_error_msg = (
        "\n[ERROR] Missing required dependency 'pysyslink_toolkit'.\n"
        "Please install it in your selected Python environment:\n"
        "    pip install pysyslink_toolkit\n"
    )

toolkit_module_name = "pysyslink_toolkit"

def try_import_toolkit():
    try:
        import pysyslink_toolkit
    except ImportError:
        raise RuntimeError(toolkit_error_msg)
    
def is_toolkit_imported():
    return toolkit_module_name in sys.modules

def before_request():
    if not is_toolkit_imported():
        try_import_toolkit()


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


server = RPCServer(before_request)
server.register_method("runSimulation", run_simulation)

if __name__ == "__main__":
    asyncio.run(server.start())
