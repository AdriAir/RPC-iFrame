# RPC iFrame

![npm](https://img.shields.io/npm/v/rpc-iframe)

Type-safe RPC between iframes. Call methods across frames like they're local functions.

```typescript
// Parent
const { remote } = await connectIframe<ChildAPI>(iframe, {
    targetOrigin: "https://child.example.com",
});

const result = await remote.add(2, 3); // 5 — typed, async, done.
```

```typescript
// Child
expose(
    {
        async add(a: number, b: number) {
            return a + b;
        },
    },
    { allowedOrigin: "https://parent.example.com" },
);
```

That's it. No glue code, no message parsing, no `postMessage` boilerplate.

Works in both TypeScript and vanilla JavaScript. Types are optional.

> **v0.2.0 — Experimental.** API may change before v1.0. Not recommended for production without thorough testing.

## Use cases

- Micro-frontends communicating across domains
- Embedded widgets (payments, auth, analytics)
- Secure sandboxed apps

## Features

- Typed RPC over `postMessage`
- Promise-based async calls
- Automatic handshake + origin validation
- Functional and OOP APIs
- Works cross-origin, no server, no bundler required
- ESM + CJS builds

## How it works

The child exposes an API.
The parent connects via a secure handshake.
All method calls are proxied over `postMessage` as typed async RPC.

> If using the `sandbox` attribute on your iframe, make sure to allow `allow-scripts` and `allow-same-origin`.

## Why RPC-iFrame

If you work with iframes, you know the pain: raw `postMessage`, manual serialization, no types, origin checks scattered everywhere, zero error context when something breaks.

RPC-iFrame replaces all of that with a single abstraction: **typed RPC**. You define an interface, expose it from the child, and call it from the parent. The runtime handles handshakes, security, and cleanup.

## Install

```bash
npm install rpc-iframe
```

## What's next

Future versions will add:

- Contract validation (fail-fast if the child doesn't expose what the parent expects)
- API discovery (the child advertises its schema during handshake)
- Dev diagnostics (structured logs for every connection and call)
- Micro-frontend lifecycle helpers (lazy loading, reconnection, health checks)

Check the full [Roadmap](docs/roadmap.md) for details.

## Docs

| Document                                   | What you'll find                                          |
| ------------------------------------------ | --------------------------------------------------------- |
| [Getting Started](docs/getting-started.md) | Installation, quick start, functional & OOP API usage     |
| [API Reference](docs/api-reference.md)     | Full API surface, configuration options, TypeScript types |
| [Architecture](docs/architecture.md)       | Internal design, protocol, transport, RPC flow diagram    |
| [Security](docs/security.md)               | Origin validation, method exposure, nonce handshake       |
| [Examples](docs/examples.md)               | Payments, micro-frontends, sandboxing, cross-domain data  |
| [Compatibility](docs/compatibility.md)     | Browser support table, module formats (ESM/CJS)           |
| [Roadmap](docs/roadmap.md)                 | v0.1 → v1.0 — every milestone and what it unlocks         |

## Contributing

Contributions are welcome. Open a PR or file an issue.

**Repository:** [github.com/AdriAir/RPC-iFrame](https://github.com/AdriAir/RPC-iFrame)
**Issues:** [github.com/AdriAir/RPC-iFrame/issues](https://github.com/AdriAir/RPC-iFrame/issues)

## License

MIT — Copyright (c) 2026 AdriAir. See [LICENSE](LICENSE).
