/**
 * parent.ts - Parent side of iFrameConnector
 *
 * Provides `IframeConnection` class and `connectIframe()` factory for
 * establishing a connection to a child iframe that has called `expose()`.
 *
 * Connection flow:
 *   1. `IframeConnection.connect()` sends a HandshakeRequest with a random
 *      nonce to the child.
 *   2. Waits for HandshakeResponse echoing the same nonce (with timeout).
 *   3. Returns an `IframeConnection` instance whose `remote` Proxy turns
 *      method calls into RPC requests resolved by the child's responses.
 *
 * Security:
 * - The nonce prevents rogue iframes from faking readiness.
 * - Origin validation is handled by Transport.
 * - Each pending call has its own timeout to prevent memory leaks.
 *
 * OOP rationale:
 * - Encapsulating transport, pending-call state, and the Proxy inside a class
 *   eliminates loose closures and makes the lifecycle (connect → call → destroy)
 *   explicit. The static factory `connect()` cleanly separates the async
 *   handshake phase from the synchronous RPC phase.
 */

import {
    createHandshakeRequest,
    createRequest,
    generateId,
    type ProtocolMessage,
} from "../core/protocol";
import { Transport } from "../core/transport";
import type { ApiMethods, ConnectOptions, RemoteApi } from "../core/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Object returned by `connectIframe` / `IframeConnection.connect`. */
export interface Connection<T extends ApiMethods> {
    /** Proxy — call remote methods as if they were local. */
    remote: RemoteApi<T>;
    /** Tear down the connection: removes listeners, rejects pending calls. */
    destroy: () => void;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface PendingCall {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// IframeConnection class
// ---------------------------------------------------------------------------

/**
 * Manages a parent-side connection to a child iframe.
 *
 * Use the static `connect()` factory (or the `connectIframe()` helper) to
 * create an instance — the constructor is private because connection setup
 * requires an async handshake.
 *
 * @example
 * ```ts
 * const conn = await IframeConnection.connect<ChildApi>(iframe, {
 *   targetOrigin: 'https://child.example.com',
 * });
 * const result = await conn.remote.greet('World');
 * conn.destroy();
 * ```
 */
export class IframeConnection<T extends ApiMethods> implements Connection<T> {
    /** Proxy — call remote methods as if they were local. */
    readonly remote: RemoteApi<T>;

    private readonly transport: Transport;
    private readonly pendingCalls = new Map<string, PendingCall>();
    private readonly callTimeout: number;
    private readonly unsubscribe: () => void;

    // ------------------------------------------------------------------
    // Private constructor — use `connect()` or `connectIframe()` instead.
    // ------------------------------------------------------------------

    private constructor(transport: Transport, callTimeout: number) {
        this.transport = transport;
        this.callTimeout = callTimeout;
        this.remote = this.createProxy();

        // Subscribe to post-handshake messages (responses & errors).
        this.unsubscribe = this.transport.onMessage(
            (message: ProtocolMessage) => {
                this.handleMessage(message);
            },
        );
    }

    // ------------------------------------------------------------------
    // Static factory — performs the handshake, then returns an instance.
    // ------------------------------------------------------------------

    /**
     * Connect to a child iframe that has called `expose()`.
     *
     * @param iframe  The HTMLIFrameElement to communicate with.
     * @param options Connection options (origin, timeouts).
     * @returns       Promise resolving with an `IframeConnection` once the handshake succeeds.
     */
    static connect<T extends ApiMethods>(
        iframe: HTMLIFrameElement,
        options: ConnectOptions,
    ): Promise<IframeConnection<T>> {
        const {
            targetOrigin,
            handshakeTimeout = 5_000,
            callTimeout = 10_000,
        } = options;

        return new Promise<IframeConnection<T>>((resolve, reject) => {
            const contentWindow = iframe.contentWindow;
            if (!contentWindow) {
                reject(
                    new Error(
                        "iframe.contentWindow is null. Is the iframe attached to the DOM?",
                    ),
                );
                return;
            }

            const transport = new Transport(contentWindow, targetOrigin);
            const nonce = generateId();
            let handshakeComplete = false;

            // --- Handshake timeout -------------------------------------------

            const handshakeTimer = setTimeout(() => {
                if (!handshakeComplete) {
                    unsubscribe();
                    transport.destroy();
                    reject(
                        new Error(
                            `Handshake timed out after ${handshakeTimeout}ms.`,
                        ),
                    );
                }
            }, handshakeTimeout);

            // --- Handshake listener ------------------------------------------

            const unsubscribe = transport.onMessage(
                (message: ProtocolMessage) => {
                    if (
                        message.type === "handshake-response" &&
                        message.nonce === nonce &&
                        !handshakeComplete
                    ) {
                        handshakeComplete = true;
                        clearTimeout(handshakeTimer);
                        unsubscribe(); // Handshake phase done — remove this listener.
                        resolve(
                            new IframeConnection<T>(transport, callTimeout),
                        );
                    }
                },
            );

            // --- Initiate handshake ------------------------------------------

            iframe.addEventListener("load", () => {
                transport.send(createHandshakeRequest(nonce));
            });
        });
    }

    // ------------------------------------------------------------------
    // Message handling (post-handshake: responses & errors only)
    // ------------------------------------------------------------------

    private handleMessage(message: ProtocolMessage): void {
        switch (message.type) {
            case "response": {
                this.settlePendingCall(message.id)?.resolve(message.result);
                break;
            }

            case "error": {
                this.settlePendingCall(message.id)?.reject(
                    new Error(message.error),
                );
                break;
            }
        }
    }

    // ------------------------------------------------------------------
    // Pending-call helpers
    // ------------------------------------------------------------------

    /**
     * Extracts and cleans up a pending call by ID.
     * Returns the call so the caller can resolve or reject it, or undefined
     * if no call with that ID exists (e.g. already settled or timed out).
     */
    private settlePendingCall(id: string): PendingCall | undefined {
        const pending = this.pendingCalls.get(id);
        if (!pending) return undefined;

        clearTimeout(pending.timer);
        this.pendingCalls.delete(id);
        return pending;
    }

    // ------------------------------------------------------------------
    // Proxy creation
    // ------------------------------------------------------------------

    /**
     * Builds the Proxy that translates property access into RPC calls.
     * Each method call returns a Promise that resolves when the child responds.
     */
    private createProxy(): RemoteApi<T> {
        return new Proxy({} as RemoteApi<T>, {
            get: (_target, prop) => {
                if (typeof prop !== "string") return undefined;

                return (...args: unknown[]) =>
                    new Promise((resolve, reject) => {
                        const id = generateId();

                        const timer = setTimeout(() => {
                            this.pendingCalls.delete(id);
                            reject(
                                new Error(
                                    `Call to "${prop}" timed out after ${this.callTimeout}ms.`,
                                ),
                            );
                        }, this.callTimeout);

                        this.pendingCalls.set(id, { resolve, reject, timer });
                        this.transport.send(createRequest(id, prop, args));
                    });
            },
        });
    }

    // ------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------

    /** Tear down the connection: removes listeners, rejects pending calls. */
    destroy(): void {
        for (const [, pending] of this.pendingCalls) {
            clearTimeout(pending.timer);
            pending.reject(new Error("Connection destroyed."));
        }
        this.pendingCalls.clear();
        this.unsubscribe();
        this.transport.destroy();
    }
}

// ---------------------------------------------------------------------------
// Backward-compatible functional API
// ---------------------------------------------------------------------------

/**
 * Connect to a child iframe that has called `expose()`.
 *
 * Thin wrapper around `IframeConnection.connect()` that preserves the
 * original functional API.
 *
 * @param iframe  The HTMLIFrameElement to communicate with.
 * @param options Connection options (origin, timeouts).
 * @returns       Promise resolving with a `Connection` once the handshake succeeds.
 *
 * @example
 * ```ts
 * import { connectIframe } from 'iframe-connector';
 *
 * interface ChildApi {
 *   greet(name: string): Promise<string>;
 *   add(a: number, b: number): Promise<number>;
 * }
 *
 * const iframe = document.getElementById('my-iframe') as HTMLIFrameElement;
 * const { remote, destroy } = await connectIframe<ChildApi>(iframe, {
 *   targetOrigin: 'https://child.example.com',
 * });
 *
 * const greeting = await remote.greet('World');
 * console.log(greeting); // "Hello, World!"
 * ```
 */
export function connectIframe<T extends ApiMethods>(
    iframe: HTMLIFrameElement,
    options: ConnectOptions,
): Promise<Connection<T>> {
    return IframeConnection.connect<T>(iframe, options);
}
