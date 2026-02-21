# Architecture

RPC-iFrame implements a **Remote Procedure Call (RPC)** layer over the browser's `postMessage` API. Each iframe becomes a node in the mesh, and every exposed method becomes a callable endpoint.

```text
┌─────────────────┐                    ┌─────────────────┐
│  Parent Node    │                    │  Child Node     │
│                 │                    │                 │
│  ┌───────────┐  │                    │  ┌───────────┐  │
│  │IframeConn │  │  1. Handshake      │  │IframeExp  │  │
│  │ection     │──┼────────────────────>  │osed       │  │
│  └───────────┘  │  (nonce exchange)  │  └───────────┘  │
│       │         │                    │       │         │
│       │         │  2. RPC Request    │       │         │
│       │         │  (method + args)   │       │         │
│       └─────────┼────────────────────>  ─────┘         │
│                 │                    │   Execute fn    │
│                 │  3. RPC Response   │       │         │
│       ┌─────────┼────────────────────<  ─────┘         │
│       │         │  (result/error)    │                 │
│    Resolve      │                    │                 │
│    Promise      │                    │                 │
└─────────────────┘                    └─────────────────┘
```

---

## Core Components

### 1. Protocol Layer ([protocol.ts](../src/core/protocol.ts))

Defines the wire format for all communication:

- **Handshake Messages**: `HandshakeRequest` and `HandshakeResponse` with a random nonce to verify both sides are ready
- **RPC Messages**: `RequestMessage` (method call), `ResponseMessage` (success), and `ErrorMessage` (failure)
- **Brand Field**: Every message includes `__ifc: "__ifc__"` to filter out unrelated postMessage traffic

```typescript
// Request
{
  __ifc: "__ifc__",
  type: "request",
  id: "uuid-1234",
  method: "greet",
  args: ["World"]
}

// Response
{
  __ifc: "__ifc__",
  type: "response",
  id: "uuid-1234",
  result: "Hello, World!"
}
```

### 2. Transport Layer ([transport.ts](../src/core/transport.ts))

Wraps `postMessage` and `addEventListener('message')` with security:

- **Origin Validation**: Only accepts messages from the configured origin
- **Message Filtering**: Verifies the `__ifc` brand before processing
- **Isolated Listeners**: Each connection has its own event handler for clean teardown

### 3. Parent Node ([parent.ts](../src/nodes/parent.ts))

The `IframeConnection` class manages the parent side:

- **Handshake**: Sends a request with a random nonce and waits for the child to echo it back
- **Proxy Creation**: Uses `Proxy` to intercept method calls and convert them to RPC requests
- **Promise Management**: Tracks pending calls in a `Map`, matching responses by ID
- **Timeout Handling**: Rejects calls that don't receive a response within the configured time

### 4. Child Node ([child.ts](../src/nodes/child.ts))

The `IframeExposed` class manages the child side:

- **Handshake Response**: Listens for handshake requests and echoes the nonce back
- **Method Dispatch**: Validates incoming requests and executes the corresponding method
- **Security**: Only allows calls to own-property methods (prevents prototype pollution)
- **Error Handling**: Catches exceptions and sends error messages back to the parent

---

## RPC Flow

1. **Parent** calls `connect()` → sends `HandshakeRequest` with nonce
2. **Child** receives handshake → validates origin → sends `HandshakeResponse` with same nonce
3. **Parent** verifies nonce → resolves connection → returns typed proxy
4. **Parent** calls `remote.someMethod(args)` → proxy intercepts → generates unique ID → sends `RequestMessage`
5. **Child** receives request → validates method exists → executes → sends `ResponseMessage` or `ErrorMessage`
6. **Parent** receives response → matches ID → resolves the pending promise
7. **Caller** receives the result as a normal async return value
