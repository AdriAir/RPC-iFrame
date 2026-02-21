# RPC-iFrame - Micro-frontend Demo

A realistic example demonstrating RPC-style communication between 7 independent Vite applications using `rpc-iframe`.

## Architecture

| Service   | Role             | Port  |
| --------- | ---------------- | ----- |
| **host**  | Parent orchestrator | 5173 |
| child-a   | Color Generator  | 5174  |
| child-b   | Greeter          | 5175  |
| child-c   | Counter          | 5176  |
| child-d   | Notifier         | 5177  |
| child-e   | Logger           | 5178  |
| child-f   | Status Board     | 5179  |

Each service runs on a different port, creating real cross-origin communication.

## Quick Start

```bash
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Demo Scenarios

Use the control panel in the host app:

1. **Sync Colors** - Child A generates a random color, the parent broadcasts it to all other children.
2. **Broadcast Greeting** - Child B creates a greeting, the parent sends it to the notifier and logger.
3. **Increment & Broadcast** - Child C increments its counter, the parent propagates the result.
4. **Reset All** - Clears all state across every child simultaneously.

## How It Works

The parent uses `IframeConnection.connect<T>()` to establish typed RPC connections with each child iframe. Each child uses `IframeExposed` to expose its API methods.

Communication is **unidirectional** (parent calls child). The orchestration pattern is:

1. Parent calls a method on Child X
2. Child X executes the method and returns a response
3. Parent uses that response to call methods on other children

This demonstrates decoupled coordination without any shared state or direct child-to-child communication.
