import sys
import json
import time

def send_message(msg: dict):
    """
    Send a JSON-RPC message (request, response or notification)
    by dumping to stdout and flushing.
    """
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()

def handle_run_simulation(request: dict):
    """
    Handles the 'runSimulation' method:
      params: { duration: float, steps: int }
      notifications: {"method":"progress","params":{"id":..., "progress":...}}
      result: { status: "completed", output: {...} }
    """
    req_id = request.get("id")
    params = request.get("params", {}) or {}
    duration = float(params.get("duration", 5.0))
    steps    = int(params.get("steps", 10))

    # emit an initial notification if desired
    send_message({
        "jsonrpc": "2.0",
        "method": "progress",
        "params": { "id": req_id, "progress": 0 }
    })

    # simulate work in 'steps' increments
    for i in range(1, steps + 1):
        time.sleep(duration / steps)
        pct = int((i / steps) * 100)
        send_message({
            "jsonrpc": "2.0",
            "method": "progress",
            "params": { "id": req_id, "progress": pct }
        })

    # dummy simulation result
    result = {
        "status": "completed",
        "output": {
            "dummyValue": 42,
            "message": f"Simulated for {duration}s in {steps} steps."
        }
    }

    # final JSON-RPC response
    send_message({
        "jsonrpc": "2.0",
        "id": req_id,
        "result": result
    })

def send_error(request_id, code, message):
    send_message({
        "jsonrpc": "2.0",
        "id": request_id,
        "error": { "code": code, "message": message }
    })

def main():
    """
    Main loop: read stdin line-by-line, parse JSON-RPC requests,
    dispatch them, and reply or notify.
    """
    while True:
        line = sys.stdin.readline()
        if not line:
            break  # EOF
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            # Cannot parse JSON: ignore or log
            continue

        # Basic JSON-RPC validation
        if request.get("jsonrpc") != "2.0" or "method" not in request:
            send_error(request.get("id"), -32600, "Invalid Request")
            continue

        method = request["method"]
        if method == "runSimulation":
            try:
                handle_run_simulation(request)
            except Exception as ex:
                send_error(request.get("id"), -32000, f"Server error: {ex}")
        else:
            # Method not found
            send_error(request.get("id"), -32601, f"Unknown method '{method}'")

if __name__ == "__main__":
    main()