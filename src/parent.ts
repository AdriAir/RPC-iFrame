/**
 * parent.ts - Parent side of iFrameConnector
 *
 * Exports `connectIframe()` for establishing a connection to a child iframe
 * that has called `expose()`.
 *
 * Connection flow:
 *   1. Send HandshakeRequest with a random nonce to the child.
 *   2. Wait for HandshakeResponse echoing the same nonce (with timeout).
 *   3. Return a Proxy that turns method calls into RPC requests and returns
 *      Promises resolved by the child's responses.
 *
 * Security:
 * - The nonce prevents rogue iframes from faking readiness.
 * - Origin validation is handled by Transport.
 * - Each pending call has its own timeout to prevent memory leaks.
 *
 * Design decisions:
 * - The Proxy-based API gives the developer a natural calling experience:
 *     `const result = await remote.someMethod(arg1, arg2);`
 *   No explicit `call('someMethod', ...)` boilerplate needed.
 * - `connectIframe` returns a `Connection` with both the proxy and a
 *   `destroy()` method, so the consumer can tear down when the iframe is
 *   removed from the DOM.
 */

import {
    createHandshakeRequest,
    createRequest,
    generateId,
    type ProtocolMessage,
} from "./core/protocol";
import { Transport } from "./core/transport";
import type { ApiMethods, ConnectOptions, RemoteApi } from "./core/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Object returned by `connectIframe`. */
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
// Main
// ---------------------------------------------------------------------------

/**
 * Connect to a child iframe that has called `expose()`.
 *
 * @param iframe  The HTMLIFrameElement to communicate with.
 * @param options Connection options (origin, timeouts).
 * @returns       Promise resolving with a `Connection` once the handshake succeeds.
 *
 * @example
 * ```ts
 * import { connectIframe } from 'iframeconnector';
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
    const {
        targetOrigin,
        handshakeTimeout = 5_000,
        callTimeout = 10_000,
    } = options;

    return new Promise<Connection<T>>((resolveConnection, rejectConnection) => {
        const contentWindow = iframe.contentWindow;
        if (!contentWindow) {
            rejectConnection(
                new Error(
                    "iframe.contentWindow is null. Is the iframe attached to the DOM?",
                ),
            );
            return;
        }

        const transport = new Transport(contentWindow, targetOrigin);
        const pendingCalls = new Map<string, PendingCall>();
        const nonce = generateId();
        let handshakeComplete = false;

        // --- Handshake timeout ---------------------------------------------------

        const handshakeTimer = setTimeout(() => {
            if (!handshakeComplete) {
                transport.destroy();
                rejectConnection(
                    new Error(
                        `Handshake timed out after ${handshakeTimeout}ms.`,
                    ),
                );
            }
        }, handshakeTimeout);

        // --- Pending call helpers ------------------------------------------------

        /**
         * Extracts and cleans up a pending call by ID.
         * Returns the call so the caller can resolve or reject it, or undefined
         * if no call with that ID exists (e.g. already settled or timed out).
         */
        function settlePendingCall(id: string): PendingCall | undefined {
            const pending = pendingCalls.get(id);
            if (!pending) return undefined;

            clearTimeout(pending.timer);
            pendingCalls.delete(id);
            return pending;
        }

        // --- Message handler -----------------------------------------------------

        const unsubscribe = transport.onMessage((message: ProtocolMessage) => {
            switch (message.type) {
                case "handshake-response": {
                    if (message.nonce === nonce && !handshakeComplete) {
                        handshakeComplete = true;
                        clearTimeout(handshakeTimer);
                        resolveConnection(buildConnection());
                    }
                    break;
                }

                case "response": {
                    settlePendingCall(message.id)?.resolve(message.result);
                    break;
                }

                case "error": {
                    settlePendingCall(message.id)?.reject(
                        new Error(message.error),
                    );
                    break;
                }
            }
        });

        // --- Build the Connection object -----------------------------------------

        function buildConnection(): Connection<T> {
            const remote = new Proxy({} as RemoteApi<T>, {
                get(_target, prop) {
                    if (typeof prop !== "string") return undefined;

                    return (...args: unknown[]) =>
                        new Promise((resolve, reject) => {
                            const id = generateId();

                            const timer = setTimeout(() => {
                                pendingCalls.delete(id);
                                reject(
                                    new Error(
                                        `Call to "${prop}" timed out after ${callTimeout}ms.`,
                                    ),
                                );
                            }, callTimeout);

                            pendingCalls.set(id, { resolve, reject, timer });
                            transport.send(createRequest(id, prop, args));
                        });
                },
            });

            function destroy(): void {
                for (const [id, pending] of pendingCalls) {
                    clearTimeout(pending.timer);
                    pending.reject(new Error("Connection destroyed."));
                    pendingCalls.delete(id);
                }
                unsubscribe();
                transport.destroy();
            }

            return { remote, destroy };
        }

        // --- Initiate handshake --------------------------------------------------
        iframe.addEventListener("load", () => {
            transport.send(createHandshakeRequest(nonce));
        });
    });
}
