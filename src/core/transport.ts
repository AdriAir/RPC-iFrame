/**
 * transport.ts - Secure postMessage transport layer
 *
 * Encapsulates send/receive logic so the rest of the library never touches
 * `window.postMessage` or `window.addEventListener` directly.
 *
 * Security:
 * - Incoming messages are validated against `targetOrigin` (unless '*').
 * - The brand field (__ifc) is verified before dispatching to callbacks.
 * - `send()` passes `targetOrigin` to postMessage so the browser enforces
 *   delivery only to the expected origin.
 *
 * Each connection gets its own Transport instance with isolated listeners,
 * avoiding global state and enabling clean teardown via `destroy()`.
 */

import { type ProtocolMessage, isProtocolMessage } from "./protocol";

export type MessageCallback = (
    message: ProtocolMessage,
    origin: string,
) => void;

export class Transport {
    private readonly target: Window;
    private readonly targetOrigin: string;
    private readonly callbacks = new Set<MessageCallback>();
    private readonly handleMessage: (event: MessageEvent) => void;

    /**
     * @param target       Window to communicate with (iframe.contentWindow or window.parent).
     * @param targetOrigin Expected origin of the remote side. '*' disables origin checks.
     */
    constructor(target: Window, targetOrigin: string) {
        this.target = target;
        this.targetOrigin = targetOrigin;

        // Arrow function preserves `this` and serves as a stable reference
        // for both addEventListener and removeEventListener.
        this.handleMessage = (event: MessageEvent) => {
            if (this.targetOrigin !== "*" && event.origin !== this.targetOrigin)
                return;
            if (!isProtocolMessage(event.data)) return;

            for (const cb of this.callbacks) {
                cb(event.data, event.origin);
            }
        };

        window.addEventListener("message", this.handleMessage);
    }

    /** Post a protocol message to the remote window. */
    send(message: ProtocolMessage): void {
        this.target.postMessage(message, this.targetOrigin);
    }

    /** Subscribe to incoming protocol messages. Returns an unsubscribe function. */
    onMessage(callback: MessageCallback): () => void {
        this.callbacks.add(callback);
        return () => {
            this.callbacks.delete(callback);
        };
    }

    /** Remove the event listener and clear all callbacks. */
    destroy(): void {
        window.removeEventListener("message", this.handleMessage);
        this.callbacks.clear();
    }
}
