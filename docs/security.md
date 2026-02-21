# Security

## Origin Validation

Both nodes **must** specify the expected origin. This prevents:

- Unauthorized iframes injected into the parent page
- Malicious pages embedding your child and calling its methods

```typescript
// Insecure — accepts any origin
expose(api, { allowedOrigin: "*" });

// Secure — only the trusted parent can call
expose(api, { allowedOrigin: "https://trusted-parent.com" });
```

## Method Exposure Limits

Only **own properties** of the API object are exposed. Prototype methods are blocked:

```typescript
// Blocked — prototype methods are not callable
await remote.toString();
await remote.constructor();

// Allowed — only explicitly exposed methods
await remote.greet("World");
```

## Error Sanitization

Stack traces are excluded from cross-origin error messages to prevent leaking implementation details.

## Nonce-Based Handshake

A random nonce prevents rogue iframes from faking readiness — even if an attacker knows the origin, they cannot predict the nonce.
