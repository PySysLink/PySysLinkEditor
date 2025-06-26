import asyncio
import json
import os
import sys
import yaml
import matplotlib.pyplot as plt
import mpld3
from mpld3 import plugins



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


async def run_simulation(pslkPath: str):
    toolkit = get_toolkit()

    # Compile high-level to low-level YAML
    result = toolkit.compile_system(
        "/home/pello/PySysLinkToolkit/tests/data/toolkit_config.yaml",
        pslkPath,
        "simulation_output.yaml"
    )
    print(f"Compilation result: {result}")

    with open(pslkPath, "r") as f:
        system_json = json.load(f)

    simulation_configuration_yaml_path = system_json.get("simulation_configuration", [])

    # Resolve to absolute path if not already absolute
    if not os.path.isabs(simulation_configuration_yaml_path):
        pslk_dir = os.path.dirname(os.path.abspath(pslkPath))
        simulation_configuration_yaml_path = os.path.normpath(
            os.path.join(pslk_dir, simulation_configuration_yaml_path)
        )

    with open(simulation_configuration_yaml_path, "r") as f:
        sim_config = yaml.safe_load(f)
    stop_time = sim_config.get("stop_time", 10)
    start_time = sim_config.get("start_time", 0)
    total_time = stop_time - start_time

    # Milestone tracking
    milestones = set(range(5, 101, 5))  # 5, 10, ..., 100
    last_percent = 0

    def display_callback(event):
        nonlocal last_percent
        # Print as before
        server.send_notification(
            event="displayValueUpdate",
            data={
                "displayId": event.value_id,
                "value": event.value,
                "simulationTime": event.simulation_time
            }
        )

        # Calculate progress percentage
        if total_time > 0:
            percent = int(100 * (event.simulation_time - start_time) / total_time)
            # Only send if we've crossed a new 5% milestone
            if percent >= last_percent + 5 and percent in milestones:
                last_percent = percent
                # Send notification to frontend
                server.send_notification(
                    event="progress",
                    data={"progress": percent}
                )


    result = await toolkit.run_simulation(
        "/home/pello/PySysLinkToolkit/tests/data/toolkit_config.yaml",
        "simulation_output.yaml",
        simulation_configuration_yaml_path,  
        "simulation_output.txt",
        display_callback=display_callback
    )
    return result

async def get_libraries():
    libraries = get_toolkit().get_available_block_libraries("/home/pello/PySysLinkToolkit/tests/data/toolkit_config.yaml")
    # Return only essential information
    return json.dumps(libraries)

async def get_block_render_information(block: str, pslkPath: str):
    render_information = get_toolkit().get_block_render_information("/home/pello/PySysLinkToolkit/tests/data/toolkit_config.yaml", block, pslkPath)
    return render_information.to_json()

async def get_block_html(block: str, pslkPath: str):
    html_str = get_toolkit().get_block_html("/home/pello/PySysLinkToolkit/tests/data/toolkit_config.yaml", block, pslkPath)
    return { "html": html_str }
    


server = RPCServer(before_request)
server.register_method("runSimulation", run_simulation)
server.register_method("getLibraries", get_libraries)
server.register_method("getBlockRenderInformation", get_block_render_information)
server.register_method("getBlockHTML", get_block_html)

if __name__ == "__main__":
    asyncio.run(server.start())
