import asyncio

from RPCServer import RPCServer


async def run_simulation(duration: float, steps: int):
    # send progress notifications via server._send(...)
    for i in range(steps):
        await asyncio.sleep(duration/steps)
        server._send({
            "type": "notification",
            "event": "progress",
            "data": {"progress": (i+1)*100//steps}
        })
    return {"status":"completed"}

server = RPCServer()
server.register_method("runSimulation", run_simulation)

if __name__=="__main__":
    asyncio.run(server.start())
