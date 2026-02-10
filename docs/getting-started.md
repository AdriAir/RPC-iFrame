# Getting Started

## Installation

```bash
npm install iframe-connector
```

```bash
yarn add iframe-connector
```

```bash
pnpm add iframe-connector
```

## Quick Start

### Parent (Host Application)

```typescript
import { connectIframe } from 'iframe-connector';

// Define the shape of the child's exposed service
interface ChildAPI {
  greet(name: string): Promise<string>;
  add(a: number, b: number): Promise<number>;
}

const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;

// Connect to the child node
const { remote, destroy } = await connectIframe<ChildAPI>(iframe, {
  targetOrigin: 'https://child-domain.com',
});

// Call remote methods — typed, async, transparent
const greeting = await remote.greet('World');
console.log(greeting); // "Hello, World!"

const sum = await remote.add(5, 3);
console.log(sum); // 8

// Tear down the connection
destroy();
```

### Child (Service Node inside the iFrame)

```typescript
import { expose } from 'iframe-connector';

// Implement the service that the parent can call
const api = {
  async greet(name: string) {
    return `Hello, ${name}!`;
  },
  async add(a: number, b: number) {
    return a + b;
  },
};

// Expose the service to the parent node
expose(api, {
  allowedOrigin: 'https://parent-domain.com',
});
```

---

## Usage Guide

### Functional API (Recommended)

The simplest way to connect nodes. One function to connect, one to expose.

#### Parent Node

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

const userData = await connection.remote.getUserData('user123');
await connection.remote.saveSettings({ theme: 'dark' });

connection.destroy();
```

#### Child Node

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

// Later, if you need to tear down:
// handle.destroy();
```

### Object-Oriented API

For applications that prefer explicit lifecycle management.

#### Parent Node (OOP)

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

#### Child Node (OOP)

```typescript
import { IframeExposed } from 'iframe-connector';

class CalculatorAPI {
  async calculate(expression: string): Promise<number> {
    return eval(expression);
  }
}

const exposed = new IframeExposed(new CalculatorAPI(), {
  allowedOrigin: 'https://parent.example.com',
});

// exposed.destroy();
```
