# Examples

## Embedding Third-Party Services

```typescript
const { remote } = await connectIframe<PaymentAPI>(paymentIframe, {
  targetOrigin: 'https://payment-provider.com',
});

await remote.processPayment({ amount: 99.99, currency: 'USD', cardToken: 'tok_123' });
```

## Micro-Frontend Orchestration

```typescript
const { remote: authRemote } = await connectIframe<AuthAPI>(authIframe, {
  targetOrigin: 'https://auth.myapp.com',
});

const user = await authRemote.getCurrentUser();
```

## Sandboxed Execution

```typescript
const { remote } = await connectIframe<SandboxAPI>(sandboxIframe, {
  targetOrigin: 'https://sandbox.example.com',
});

const result = await remote.executeCode('console.log("Hello")');
```

## Cross-Domain Data Access

```typescript
expose({
  async fetchUserData(userId: string) {
    const res = await fetch(`https://api.example.com/users/${userId}`);
    return res.json();
  },
}, { allowedOrigin: 'https://main-app.com' });
```
