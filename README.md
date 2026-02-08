# iFrame-Connector

Modern TypeScript library for type-safe, secure communication between web applications and iFrames using RPC (Remote Procedure Call).

> ⚠️ **EXPERIMENTAL - v0.2.0**
>
> This library is in early development and may contain bugs, security vulnerabilities, or breaking changes in future versions. Use at your own risk and avoid using in production environments without thorough testing. Always validate and sanitize data exchanged between frames.

## 🚀 Features

- **Type-safe RPC** - Call iframe methods as if they were local functions with full TypeScript support
- **Secure by default** - Origin validation on both sides to prevent cross-origin attacks
- **Dual API** - Choose between functional or object-oriented programming style
- **Promise-based** - All communication is async with automatic timeout handling
- **Zero dependencies** - Lightweight and self-contained
- **Handshake protocol** - Ensures both sides are ready before communication starts
- **Clean teardown** - Proper cleanup to prevent memory leaks

---

## 📦 Installation

```bash
npm install iframe-connector
```

```bash
yarn add iframe-connector
```

```bash
pnpm add iframe-connector
```

---

## 🎯 Quick Start

### Parent Page (Host Application)

```typescript
import { connectIframe } from 'iframe-connector';

// Define the API shape that the child iframe will expose
interface ChildAPI {
  greet(name: string): Promise<string>;
  add(a: number, b: number): Promise<number>;
}

const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;

// Connect to the child iframe
const { remote, destroy } = await connectIframe<ChildAPI>(iframe, {
  targetOrigin: 'https://child-domain.com',
});

// Call remote methods with full type safety
const greeting = await remote.greet('World');
console.log(greeting); // "Hello, World!"

const sum = await remote.add(5, 3);
console.log(sum); // 8

// Clean up when done
destroy();
```

### Child Page (Inside the iFrame)

```typescript
import { expose } from 'iframe-connector';

// Implement the API that the parent can call
const api = {
  async greet(name: string) {
    return `Hello, ${name}!`;
  },
  async add(a: number, b: number) {
    return a + b;
  },
};

// Expose the API to the parent
expose(api, {
  allowedOrigin: 'https://parent-domain.com',
});
```

---

## 📖 Usage Guide

### Functional API (Simple and Direct)

This is the recommended approach for most use cases. It's straightforward and familiar.

#### Parent Side (Functional)

```typescript
import { connectIframe } from 'iframe-connector';

interface ChildAPI {
  getUserData(userId: string): Promise<{ name: string; email: string }>;
  saveSettings(settings: Record<string, unknown>): Promise<void>;
}

const iframe = document.querySelector('iframe') as HTMLIFrameElement;

const connection = await connectIframe<ChildAPI>(iframe, {
  targetOrigin: 'https://child.example.com',
  handshakeTimeout: 5000,  // Wait up to 5s for handshake (default)
  callTimeout: 10000,      // Wait up to 10s per RPC call (default)
});

// Use the remote proxy
const userData = await connection.remote.getUserData('user123');
await connection.remote.saveSettings({ theme: 'dark' });

// Always clean up
connection.destroy();
```

#### Child Side (Functional)

```typescript
import { expose } from 'iframe-connector';

const api = {
  async getUserData(userId: string) {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  },

  async saveSettings(settings: Record<string, unknown>) {
    await fetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },
};

const handle = expose(api, {
  allowedOrigin: 'https://parent.example.com',
});

// Later, if you need to clean up:
// handle.destroy();
```

### Object-Oriented API (Advanced Control)

For applications that prefer OOP patterns or need more explicit lifecycle management.

#### Parent Side (OOP)

```typescript
import { IframeConnection } from 'iframe-connector';

interface ChildAPI {
  calculate(expression: string): Promise<number>;
}

const iframe = document.getElementById('calculator') as HTMLIFrameElement;

const conn = await IframeConnection.connect<ChildAPI>(iframe, {
  targetOrigin: 'https://calculator.example.com',
});

const result = await conn.remote.calculate('2 + 2 * 3');
console.log(result); // 8

conn.destroy();
```

#### Child Side (OOP)

```typescript
import { IframeExposed } from 'iframe-connector';

class CalculatorAPI {
  async calculate(expression: string): Promise<number> {
    // Safely evaluate the expression
    return eval(expression);
  }
}

const exposed = new IframeExposed(new CalculatorAPI(), {
  allowedOrigin: 'https://parent.example.com',
});

// Clean up when needed
// exposed.destroy();
```

---

## 🔧 How It Works Internally

### Architecture Overview

iFrameConnector uses a **Remote Procedure Call (RPC)** pattern over the browser's `postMessage` API to enable type-safe communication between different window contexts.

```text
┌─────────────────┐                    ┌─────────────────┐
│  Parent Page    │                    │  Child iFrame   │
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

### Core Components

#### 1. **Protocol Layer** ([protocol.ts](src/core/protocol.ts))

Defines the message format for all communication:

- **Handshake Messages**: `HandshakeRequest` and `HandshakeResponse` with a random nonce to verify both sides are ready
- **RPC Messages**: `RequestMessage` (method call), `ResponseMessage` (success), and `ErrorMessage` (failure)
- **Brand Field**: Every message includes `__ifc: "__ifc__"` to filter out unrelated postMessage traffic

```typescript
// Example protocol messages
{
  __ifc: "__ifc__",
  type: "request",
  id: "uuid-1234",
  method: "greet",
  args: ["World"]
}

{
  __ifc: "__ifc__",
  type: "response",
  id: "uuid-1234",
  result: "Hello, World!"
}
```

#### 2. **Transport Layer** ([transport.ts](src/core/transport.ts))

Wraps `postMessage` and `addEventListener('message')` with security features:

- **Origin Validation**: Only accepts messages from the configured origin
- **Message Filtering**: Verifies the `__ifc` brand before processing
- **Isolated Listeners**: Each connection has its own event handler for clean teardown
- **Callback Management**: Allows multiple subscribers per connection

#### 3. **Parent Node** ([parent.ts](src/nodes/parent.ts))

The `IframeConnection` class manages the parent-side connection:

- **Handshake**: Sends a request with a random nonce and waits for the child to echo it back
- **Proxy Creation**: Uses JavaScript Proxy to intercept method calls and convert them to RPC requests
- **Promise Management**: Tracks pending calls in a Map, matching responses by ID
- **Timeout Handling**: Rejects calls that don't receive a response within the configured time

#### 4. **Child Node** ([child.ts](src/nodes/child.ts))

The `IframeExposed` class manages the child-side API exposure:

- **Handshake Response**: Listens for handshake requests and echoes the nonce back
- **Method Dispatch**: Validates incoming requests and executes the corresponding API method
- **Security Checks**: Only allows calls to own-property methods (prevents prototype pollution)
- **Error Handling**: Catches exceptions and sends error messages back to the parent

### RPC Flow (Step by Step)

1. **Parent calls** `IframeConnection.connect()` → sends `HandshakeRequest` with nonce
2. **Child receives** handshake → validates origin → sends `HandshakeResponse` with same nonce
3. **Parent verifies** nonce match → resolves connection promise → returns proxy
4. **Parent calls** `remote.someMethod(arg1, arg2)` → proxy intercepts
5. **Proxy generates** unique ID → creates `RequestMessage` → sends via postMessage
6. **Child receives** request → validates method exists → executes `api.someMethod(arg1, arg2)`
7. **Child sends** `ResponseMessage` with result or `ErrorMessage` if failed
8. **Parent receives** response → matches ID → resolves the pending promise
9. **Caller receives** the result as if it was a local async function call

### Why RPC?

RPC abstracts the complexity of `postMessage`:
- No manual message parsing
- No need to track request/response pairs manually
- Type-safe method calls with TypeScript
- Automatic error propagation
- Built-in timeout protection

---

## ⚙️ Configuration Options

### Parent Options (`ConnectOptions`)

| Option             | Type     | Default      | Description                                                                                                                         |
| ------------------ | -------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `targetOrigin`     | `string` | **Required** | Expected origin of the child iframe (e.g., `'https://child.com'`). Use `'*'` to accept any origin (not recommended for production). |
| `handshakeTimeout` | `number` | `5000`       | Maximum time (ms) to wait for the handshake to complete.                                                                            |
| `callTimeout`      | `number` | `10000`      | Maximum time (ms) to wait for each RPC call to return.                                                                              |

### Child Options (`ExposeOptions`)

| Option          | Type     | Default      | Description                                                                                                                           |
| --------------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `allowedOrigin` | `string` | **Required** | Origin of the parent that's allowed to call methods (e.g., `'https://parent.com'`). Use `'*'` to accept any origin (not recommended). |

---

## 🔒 Security Considerations

### Origin Validation

Both sides **must** specify the expected origin. This prevents malicious pages from:
- Injecting unauthorized iframes into your parent page
- Embedding your child iframe and calling its methods

```typescript
// ❌ Insecure - accepts any origin
expose(api, { allowedOrigin: '*' });

// ✅ Secure - only your parent can call
expose(api, { allowedOrigin: 'https://trusted-parent.com' });
```

### Method Exposure Limits

The child side only exposes **own properties** of the API object. This prevents attacks like:

```typescript
// ❌ Won't work - prototype methods are blocked
await remote.toString();
await remote.constructor();

// ✅ Only explicitly exposed methods work
await remote.greet('World');
```

### Error Message Sanitization

Stack traces are intentionally excluded from error messages sent across origins to avoid leaking implementation details.

### Nonce-Based Handshake

The random nonce prevents rogue iframes from faking readiness:
- Even if an attacker knows the origin, they can't predict the nonce
- Only the legitimate child that received the handshake request can respond correctly

---

## 💡 Common Use Cases

### 1. Embedding Third-Party Widgets

```typescript
// Parent: E-commerce site
const { remote } = await connectIframe<PaymentAPI>(paymentIframe, {
  targetOrigin: 'https://payment-provider.com',
});

await remote.processPayment({
  amount: 99.99,
  currency: 'USD',
  cardToken: 'tok_123',
});
```

### 2. Micro-Frontends

```typescript
// Parent: Main application shell
const { remote: authRemote } = await connectIframe<AuthAPI>(authIframe, {
  targetOrigin: 'https://auth.myapp.com',
});

const user = await authRemote.getCurrentUser();
```

### 3. Sandboxed Code Execution

```typescript
// Parent: Code playground
const { remote: sandboxRemote } = await connectIframe<SandboxAPI>(sandboxIframe, {
  targetOrigin: 'https://sandbox.example.com',
});

const result = await sandboxRemote.executeCode('console.log("Hello")');
```

### 4. Cross-Domain Data Fetching

```typescript
// Child: Has access to a different API domain
expose({
  async fetchUserData(userId: string) {
    const res = await fetch(`https://api.example.com/users/${userId}`);
    return res.json();
  },
}, { allowedOrigin: 'https://main-app.com' });
```

---

## 📚 API Reference

### `connectIframe<T>(iframe, options)` (Function)

Connects to a child iframe and returns a proxy for calling remote methods.

**Type Parameters:**
- `T extends ApiMethods` - The shape of the child's API

**Parameters:**
- `iframe: HTMLIFrameElement` - The iframe element to connect to
- `options: ConnectOptions` - Connection configuration

**Returns:** `Promise<Connection<T>>`
- `remote: RemoteApi<T>` - Proxy for calling remote methods
- `destroy: () => void` - Function to tear down the connection

---

### `IframeConnection.connect<T>(iframe, options)` (Class Method)

Static factory method that creates an `IframeConnection` instance.

**Type Parameters:**
- `T extends ApiMethods` - The shape of the child's API

**Parameters:**
- `iframe: HTMLIFrameElement` - The iframe element to connect to
- `options: ConnectOptions` - Connection configuration

**Returns:** `Promise<IframeConnection<T>>`

**Instance Properties:**
- `remote: RemoteApi<T>` - Proxy for calling remote methods

**Instance Methods:**
- `destroy(): void` - Tear down the connection

---

### `expose<T>(api, options)` (Function)

Exposes an API object for the parent to call.

**Type Parameters:**
- `T extends ApiMethods` - The shape of your API

**Parameters:**
- `api: T` - Object with async methods to expose
- `options: ExposeOptions` - Exposure configuration

**Returns:** `ExposeHandle`
- `destroy: () => void` - Function to stop responding to calls

---

### `new IframeExposed<T>(api, options)` (Class)

Creates an instance that exposes an API to the parent.

**Type Parameters:**
- `T extends ApiMethods` - The shape of your API

**Parameters:**
- `api: T` - Object with async methods to expose
- `options: ExposeOptions` - Exposure configuration

**Instance Methods:**
- `destroy(): void` - Stop responding to RPC calls

---

## 🤝 TypeScript Support

iFrameConnector is written in TypeScript and provides full type safety:

```typescript
interface MyAPI {
  // ✅ Valid - returns Promise
  getData(id: string): Promise<Data>;

  // ❌ Invalid - must return Promise
  syncMethod(): string;
}

const { remote } = await connectIframe<MyAPI>(iframe, options);

// ✅ Type-safe and autocomplete works
const data = await remote.getData('123');

// ❌ TypeScript error - method doesn't exist
await remote.unknownMethod();
```

---

## 🌐 Compatibility

### Browser Support

iFrameConnector requires modern browser features:

- **ES6+ support** (Promises, Proxy, arrow functions, etc.)
- **postMessage API** (widely supported)
- **crypto.randomUUID()** (Chrome 92+, Firefox 95+, Safari 15.4+) or fallback to Math.random

**Recommended browsers:**

- Chrome/Edge 92+
- Firefox 95+
- Safari 15.4+
- Opera 78+

### Module Formats

- **ESM** (ECMAScript Modules) - `import { connectIframe } from 'iframe-connector'`
- **CommonJS** - `const { connectIframe } = require('iframe-connector')`
- **TypeScript** - Full type definitions included

---

## 📄 License

MIT License - Copyright (c) 2026 AdriAir

See [LICENSE](LICENSE) for full details.

**Disclaimer:** This software is provided "as is", without warranty of any kind. The authors are not liable for any damages or security issues arising from the use of this library. Users are responsible for:

- Validating all data exchanged between frames
- Properly configuring origin restrictions
- Testing security in their specific use case
- Staying updated with security patches

---

## 🐛 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

**Repository:** [https://github.com/AdriAir/iFrameConnector](https://github.com/AdriAir/iFrameConnector)

**Issues:** [https://github.com/AdriAir/iFrameConnector/issues](https://github.com/AdriAir/iFrameConnector/issues)
