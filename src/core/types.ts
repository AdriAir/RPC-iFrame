/**
 * types.ts - Public type definitions for RPC-iFrame
 *
 * Defines user-facing type contracts: API shape constraints, configuration
 * options for parent and child, and the remote proxy type.
 *
 * Key design decisions:
 * - ApiMethods constrains all methods to return Promise<unknown>, enforcing
 *   asynchronous RPC (postMessage is inherently async).
 * - RemoteApi maps the child's API type 1:1 so the parent gets full
 *   autocompletion and type safety on the proxy.
 * - Origin options are mandatory (no default), making the secure path explicit.
 */

// ---------------------------------------------------------------------------
// API shape constraints
// ---------------------------------------------------------------------------

/**
 * Constraint for methods that can be exposed via RPC.
 * Every method must return a Promise — synchronous functions are not allowed
 * because postMessage communication is inherently asynchronous.
 *
 * `any[]` is intentional: it lets consumers define specific parameter types
 * in their own interfaces while keeping this base constraint flexible.
 */
export type ApiMethods = Record<string, (...args: any[]) => Promise<unknown>>;

/**
 * Maps an API definition to its remote (proxy) representation.
 * Preserves method signatures so the parent gets full type safety
 * and autocompletion when calling methods through the proxy.
 */
export type RemoteApi<T extends ApiMethods> = {
    [K in keyof T]: T[K];
};

// ---------------------------------------------------------------------------
// Configuration options
// ---------------------------------------------------------------------------

/** Options for the parent when connecting to a child iframe. */
export interface ConnectOptions {
    /**
     * Expected origin of the child iframe (e.g. 'https://child.example.com').
     * Messages from any other origin are silently discarded.
     * Use '*' to accept any origin (not recommended for production).
     */
    targetOrigin: string;

    /** Max wait time (ms) for the handshake to complete. @default 5000 */
    handshakeTimeout?: number;

    /** Max wait time (ms) for each individual RPC call. @default 10000 */
    callTimeout?: number;
}

/** Options for the child when exposing its API. */
export interface ExposeOptions {
    /**
     * Allowed parent origin (e.g. 'https://parent.example.com').
     * Requests from any other origin are silently ignored.
     * Use '*' to accept any origin (not recommended for production).
     */
    allowedOrigin: string;
}
