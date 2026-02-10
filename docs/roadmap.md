# Roadmap

> Every version is a step toward a fully typed, zero-server **Browser RPC Platform**.

## v0.1 — Runtime Introspection ✅

The foundation. Parent and child establish a secure handshake over `postMessage`, exchange a nonce, and the parent receives a dynamic proxy to call any method the child exposes. No configuration beyond origin — the runtime discovers what's available.

## v0.2 — Test Suite & NPM Distribution ✅

Full unit test coverage with Vitest. Published to NPM as `iframe-connector` with ESM, CJS, and TypeScript declarations. The infrastructure is now consumable as a dependency.

## v0.3 — Runtime Contract Validation

**The parent declares what it needs. The child must comply — or the connection fails immediately.**

The parent passes a `require` list during connection. After the handshake, iFrame-Connector compares the declared requirements against the child's actual exposed methods. If any method is missing, the connection is rejected with a `ContractViolation` error before any RPC call is made.

```typescript
const { remote } = await connectIframe<ChildAPI>(iframe, {
  targetOrigin: 'https://child.example.com',
  require: ['add', 'greet'],
});
```

Internally:

```typescript
if (!required.every(m => childApi.includes(m))) {
  throw new Error('Contract violation: missing methods');
}
```

**What this means:**

- Fail-fast on deployment — broken integrations surface at connection time, not at the first user interaction.
- Safer production — a child iframe that silently removes a method no longer causes cryptic runtime errors minutes later.
- First step toward real contracts, but still zero schemas and zero tooling overhead.

## v0.4 — Explicit Contracts (TypeScript-first)

**Contracts become first-class objects.** Instead of a list of strings, the parent declares a contract as a typed constant. iFrame-Connector validates the child's surface against that contract at runtime, while TypeScript enforces it at compile time.

```typescript
// Define the contract once, share across parent and child
export const ChildApiContract = {
  add: true,
  greet: true,
} as const;

// Parent uses the contract
const { remote } = await connectIframe<ChildAPI>(iframe, {
  targetOrigin: 'https://child.example.com',
  contract: ChildApiContract,
});
```

Or inline with generics:

```typescript
const { remote } = await connectIframe<ChildAPI>(iframe, {
  targetOrigin: 'https://child.example.com',
  contract: {
    add: true,
    greet: true,
  },
});
```

**What this means:**

- Contracts are explicit, auditable, and version-controllable — they're plain objects, not magic strings.
- TypeScript catches contract drift at compile time; the runtime catches it at connection time.
- Still lightweight: no code generation, no schema language, no extra dependencies. A frontend developer can adopt this in five minutes.

## v0.5 — Schema Export (Child → Parent)

**The child advertises its own contract.** During the handshake, the child sends its schema alongside the nonce response. The parent can inspect, validate, log, or even generate TypeScript types from what the child declares.

```typescript
// Child exposes its API with a schema
expose(api, {
  allowedOrigin: 'https://parent.example.com',
  schema: ChildApiContract,
});
```

The handshake response now includes:

```json
{ "nonce": "...", "schema": { "add": true, "greet": true } }
```

**What this means:**

- **Service discovery without a server.** The parent knows what the child can do before making a single call.
- The parent can validate the child's self-declared schema against its own expectations — two-way contract agreement.
- Opens the door for devtools, dashboards, and automated type generation — all at the browser level, with zero infrastructure.

## v0.6 — Dev Diagnostics

**A built-in observability layer for development.** Enable `debug: true` and iFrame-Connector prints structured logs for every stage of the lifecycle.

```typescript
const { remote } = await connectIframe<ChildAPI>(iframe, {
  targetOrigin: 'https://child.example.com',
  debug: true,
});
```

What you see in the console:

- Connection established / failed (with origin details)
- Methods discovered on the remote
- Per-call latency (ms)
- RPC errors with full context (method, args, error)
- Handshake timing and nonce exchange

**What this means:**

- Zero-config debugging. No browser extension, no proxy, no network tab guessing.
- Immediately answers "is my iframe connected?", "what methods does it expose?", "why is this call slow?".
- Turns an opaque `postMessage` channel into a transparent, inspectable service bus.

## v0.7 — Micro-Frontend Helpers

**First-class primitives for micro-frontend architectures.** iFrame-Connector provides helpers that handle the lifecycle of dynamically loaded iframe services.

```typescript
import { createMicroFrontend, registerChild } from 'iframe-connector';
```

- `createMicroFrontend()` — Lazy-loads an iframe, connects, and returns the typed remote. One call replaces iframe creation + src assignment + load event + handshake + proxy setup.
- `registerChild()` — Declares a child service with retry logic and health checks. If the child crashes or the iframe reloads, the connection is automatically re-established.

**What this means:**

- iFrame-Connector stops being "the thing you wrap around postMessage" and becomes the service mesh layer that manages your micro-frontend topology.
- Retries, health checks, and lazy loading are infrastructure concerns — they belong in the mesh, not in application code.

## v0.8 — Stability Pass

**Production hardening.** Before v1.0, a dedicated pass to handle every edge case and failure mode:

- Iframe reload detection and automatic reconnection
- Graceful degradation when a child becomes unresponsive
- Better error messages with actionable context
- Edge cases: rapid connect/disconnect, multiple iframes to the same origin, orphaned listeners
- Comprehensive documentation with architecture diagrams, migration guides, and real-world examples

## v1.0 — Browser RPC Platform

**The mesh is complete.**

iFrame-Connector v1.0 is a fully typed, contract-driven, runtime-validated RPC platform that runs entirely in the browser. No servers. No build steps. No framework lock-in.

| Capability              | Status    |
| ----------------------- | --------- |
| Typed RPC               | Complete  |
| Explicit Contracts      | Complete  |
| Runtime Validation      | Complete  |
| Service Discovery       | Complete  |
| Dev Diagnostics         | Complete  |
| Micro-frontend Ready    | Complete  |
| Production Hardened     | Complete  |

**This is infrastructure.** Applications built on iFrame-Connector don't "use a library" — they run on a service mesh where every iframe is a node, every method is an endpoint, and every call is a typed, validated, observable RPC.
