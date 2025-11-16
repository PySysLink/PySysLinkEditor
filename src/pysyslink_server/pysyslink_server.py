import asyncio
import dataclasses
from enum import Enum
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


def get_simulation_configuration(pslkPath: str):
    """
    Load the simulation configuration from the given PSLK path.
    """
    with open(pslkPath, "r") as f:
        system_json = json.load(f)

    sim_config_path = system_json.get("simulation_configuration", [])
    print(f"Simulation configuration path: {sim_config_path}")
    # Resolve to absolute path if not already absolute
    if not os.path.isabs(sim_config_path):
        pslk_dir = os.path.dirname(os.path.abspath(pslkPath))
        sim_config_path = os.path.normpath(
            os.path.join(pslk_dir, sim_config_path)
        )

    with open(sim_config_path, "r") as f:
        sim_config = yaml.safe_load(f)
    
    return sim_config, sim_config_path

def get_toolkit_config_path(pslkPath: str) -> str | None:
    """
    Get the toolkit configuration path from the PSLK file.
    """
    with open(pslkPath, "r") as f:
        try:
            system_json = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Invalid PSLK file format: {e}")
            return None
        
    toolkit_config_path = system_json.get("toolkit_configuration_path", None)

    if toolkit_config_path is None or toolkit_config_path == "":
        print("No toolkit configuration path specified in the PSLK file.")
        return None

    # Resolve to absolute path if not already absolute
    if not os.path.isabs(toolkit_config_path):
        pslk_dir = os.path.dirname(os.path.abspath(pslkPath))
        toolkit_config_path = os.path.normpath(
            os.path.join(pslk_dir, toolkit_config_path)
        )

    print(f"Resolved toolkit configuration path: {toolkit_config_path}")
    
    return toolkit_config_path

def try_import_toolkit():
    global _toolkit
    try:
        import pysyslink_toolkit
        _toolkit = pysyslink_toolkit
    except ImportError as e:
        raise RuntimeError(toolkit_error_msg + f"\nError: {e}")
    
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

    sim_config, sim_config_path = get_simulation_configuration(pslkPath)
    low_level_system_yaml_path = sim_config.get("low_level_system_yaml_path", "low_level_system.yaml")

    # Compile high-level to low-level YAML
    result = toolkit.compile_system(
        get_toolkit_config_path(pslkPath),
        pslkPath,
        low_level_system_yaml_path
    )
    print(f"Compilation result: {result}")

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
        get_toolkit_config_path(pslkPath),
        low_level_system_yaml_path,
        sim_config_path,  
        display_callback=display_callback
    )
    return result

class EnumEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Enum):
            return obj.value
        return super().default(obj)

async def get_libraries(pslkPath: str):
    libraries = get_toolkit().get_available_block_libraries(get_toolkit_config_path(pslkPath))
    # Return only essential information
    return json.dumps([dataclasses.asdict(library) for library in libraries], cls=EnumEncoder)

async def get_block_render_information(block: str, pslkPath: str):
    render_information = get_toolkit().get_block_render_information(get_toolkit_config_path(pslkPath), block, pslkPath)
    return render_information.to_json()

async def get_block_html(block: str, pslkPath: str):
    html_str = get_toolkit().get_block_html(get_toolkit_config_path(pslkPath), block, pslkPath)
    return { "html": html_str }
    


server = RPCServer(before_request)
server.register_method("runSimulation", run_simulation)
server.register_method("getLibraries", get_libraries)
server.register_method("getBlockRenderInformation", get_block_render_information)
server.register_method("getBlockHTML", get_block_html)

if __name__ == "__main__":
    asyncio.run(server.start())
