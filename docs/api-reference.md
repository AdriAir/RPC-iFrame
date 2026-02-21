# API Reference

## Functions

### `connectIframe<T>(iframe, options)`

Connects to a child node and returns a typed proxy.

- **`T extends ApiMethods`** — Shape of the child's exposed service
- **`iframe: HTMLIFrameElement`** — Target iframe element
- **`options: ConnectOptions`** — Connection configuration
- **Returns:** `Promise<Connection<T>>` with `remote: RemoteApi<T>` and `destroy: () => void`

### `expose<T>(api, options)`

Exposes a service for the parent to call.

- **`T extends ApiMethods`** — Shape of your service
- **`api: T`** — Object with async methods to expose
- **`options: ExposeOptions`** — Exposure configuration
- **Returns:** `ExposeHandle` with `destroy: () => void`

---

## Classes

### `IframeConnection.connect<T>(iframe, options)`

Static factory. Same behavior as `connectIframe`, returns an `IframeConnection<T>` instance with `remote` property and `destroy()` method.

### `new IframeExposed<T>(api, options)`

Class-based equivalent of `expose`. Instantiate to start responding to RPC calls. Call `destroy()` to stop.

---

## Configuration

### Parent Options (`ConnectOptions`)

| Option             | Type     | Default      | Description                                                       |
| ------------------ | -------- | ------------ | ----------------------------------------------------------------- |
| `targetOrigin`     | `string` | **Required** | Expected origin of the child node. Use `'*'` only in development. |
| `handshakeTimeout` | `number` | `5000`       | Maximum time (ms) to wait for the handshake to complete.          |
| `callTimeout`      | `number` | `10000`      | Maximum time (ms) to wait for each RPC call to return.            |

### Child Options (`ExposeOptions`)

| Option          | Type     | Default      | Description                                                                     |
| --------------- | -------- | ------------ | ------------------------------------------------------------------------------- |
| `allowedOrigin` | `string` | **Required** | Origin of the parent node allowed to make calls. Use `'*'` only in development. |

---

## TypeScript

iFrame-Connector is written in TypeScript and provides full type inference:

```typescript
interface MyAPI {
    getData(id: string): Promise<Data>; // Valid — returns Promise
    syncMethod(): string; // Invalid — must return Promise
}

const { remote } = await connectIframe<MyAPI>(iframe, options);

await remote.getData("123"); // Type-safe, autocomplete works
await remote.unknownMethod(); // TypeScript error
```
