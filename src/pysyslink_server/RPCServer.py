import json, asyncio
import sys
import time
from typing import Any, Dict, Callable
import warnings
warnings.filterwarnings("ignore")

class Protocol:
    """Serialize/deserialize and validate protocol messages."""
    @staticmethod
    def encode(msg: Dict[str, Any]) -> str:
        return json.dumps(msg)

    @staticmethod
    def decode(line: str) -> Dict[str, Any]:
        return json.loads(line)

class RPCServer:
    def __init__(self, before_request: Callable[(), None] | None = None):
        self._handlers: Dict[str, Callable] = {}
        self._tasks: Dict[int, asyncio.Task] = {}
        self._next_id = 1
        self._heartbeat_interval = 10
        self.before_request = before_request

    def register_method(self, name: str, func: Callable):
        """Decorate or register a method name → coroutine."""
        self._handlers[name] = func

    async def _read_loop(self):
        loop = asyncio.get_event_loop()
        while True:
            line = await loop.run_in_executor(None, sys.stdin.readline)
            self.print("Message arrived: {}".format(line))
            if not line:
                break
            msg = Protocol.decode(line.strip())
            await self._dispatch(msg)

    async def _dispatch(self, msg: Dict[str, Any]):
        typ = msg.get("type")
        if typ == "request":
            await self._handle_request(msg)
        elif typ == "cancel":
            self._handle_cancel(msg["id"])
        elif typ == "heartbeat" and msg.get("subtype") == "ping":
            self._send({"type":"heartbeat","subtype":"pong","timestamp":msg["timestamp"]})
        # … handle other message types …

    async def _handle_request(self, msg):
        req_id = msg["id"]
        try:
            if self.before_request != None:
                self.before_request()
        except Exception as e:
            # on any other error, send an error response
            self._send({"type": "error", "id": req_id, "error": str(e)})
            return

        method = msg["method"]
        params = msg.get("params", {})
        coro = self._handlers[method](**params)

        # wrap in a Task so we can cancel
        task = asyncio.create_task(self._run_and_respond(req_id, coro))
        self._tasks[req_id] = task

    async def _run_and_respond(self, req_id: int, coro):
        try:
            result = await coro
            self.print("Result is: {}".format(result))
            # send final success response
            self._send({"type": "response", "id": req_id, "result": result})
        except asyncio.CancelledError:
            # on cancellation, send a cancelled result
            self._send({"type": "response", "id": req_id, "result": {"status": "cancelled"}})
        except Exception as e:
            # on any other error, send an error response
            self._send({"type": "error", "id": req_id, "error": str(e)})
        finally:
            self._tasks.pop(req_id, None)

    def _handle_cancel(self, req_id: int):
        task = self._tasks.get(req_id)
        if task and not task.done():
            task.cancel()

    def _send(self, msg: Dict[str, Any]):
        sys.stdout.write(Protocol.encode(msg) + "\n")
        sys.stdout.flush()

    async def start(self):
        # start heartbeat pings
        asyncio.create_task(self._heartbeat())
        # start reading incoming
        await self._read_loop()

    def print(self, message):
        self._send({"type":"print","message":message})

    async def _heartbeat(self):
        while True:
            await asyncio.sleep(self._heartbeat_interval)
            self._send({
                "type": "heartbeat",
                "subtype": "ping",
                "timestamp": int(time.time())
            })
    
    def send_notification(self, event: str, data: dict):
        """
        Send a notification message to the frontend.
        """
        self._send({
            "type": "notification",
            "event": event,
            "data": data
        })
