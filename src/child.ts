/**
 * child.ts - Child iframe side of iFrameConnector
 *
 * Provides `IframeExposed` class and `expose()` factory for registering
 * callable methods for the parent frame.
 *
 * Flow:
 *   1. Listen for HandshakeRequest from parent → respond with HandshakeResponse.
 *   2. Listen for RPC requests → dispatch to the registered method, reply with
 *      result or error.
 *
 * Security:
 * - Only own-property methods on the `api` object can be invoked (blocks
 *   prototype pollution attacks like calling `constructor` or `toString`).
 * - Origin is validated at the Transport level.
 * - Error stack traces are intentionally omitted from responses to avoid
 *   leaking internal details across origins.
 *
 * OOP rationale:
 * - Encapsulating the API reference, transport, and dispatch logic in a class
 *   makes ownership of resources explicit and simplifies cleanup via `destroy()`.
 */

import {
  createHandshakeResponse,
  createResponse,
  createError,
  type ProtocolMessage,
} from './core/protocol';
import { Transport } from './core/transport';
import type { ApiMethods, ExposeOptions } from './core/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Handle returned by `expose()` / `IframeExposed` for cleanup. */
export interface ExposeHandle {
  /** Remove all listeners and stop responding to RPC calls. */
  destroy: () => void;
}

// ---------------------------------------------------------------------------
// IframeExposed class
// ---------------------------------------------------------------------------

/**
 * Manages the child-side of an iframe RPC connection.
 *
 * Registers an API object whose methods can be invoked by the parent frame.
 * Handles the handshake response and dispatches incoming RPC requests.
 *
 * @example
 * ```ts
 * const handle = new IframeExposed({
 *   async greet(name: string) { return `Hello, ${name}!`; },
 *   async add(a: number, b: number) { return a + b; },
 * }, { allowedOrigin: 'https://parent.example.com' });
 *
 * // Later:
 * handle.destroy();
 * ```
 */
export class IframeExposed<T extends ApiMethods> implements ExposeHandle {
  private readonly api: T;
  private readonly transport: Transport;
  private readonly unsubscribe: () => void;

  constructor(api: T, options: ExposeOptions) {
    this.api = api;
    const { allowedOrigin } = options;
    this.transport = new Transport(window.parent, allowedOrigin);

    this.unsubscribe = this.transport.onMessage((message: ProtocolMessage) => {
      this.handleMessage(message);
    });
  }

  // ------------------------------------------------------------------
  // Message handling
  // ------------------------------------------------------------------

  private handleMessage(message: ProtocolMessage): void {
    switch (message.type) {
      case 'handshake-request': {
        this.transport.send(createHandshakeResponse(message.nonce));
        break;
      }

      case 'request': {
        this.dispatchRequest(message.id, message.method, message.args);
        break;
      }
    }
  }

  // ------------------------------------------------------------------
  // RPC dispatch
  // ------------------------------------------------------------------

  /**
   * Validates and executes an RPC request, sending back the result or error.
   *
   * Extracted into its own method for clarity: the message handler stays
   * focused on routing, while this method handles validation + execution.
   */
  private async dispatchRequest(
    id: string,
    method: string,
    args: unknown[],
  ): Promise<void> {
    // Guard: only own-property methods (no prototype pollution).
    if (!Object.prototype.hasOwnProperty.call(this.api, method)) {
      this.transport.send(createError(id, `Method "${method}" is not exposed.`));
      return;
    }

    const fn = this.api[method];
    if (typeof fn !== 'function') {
      this.transport.send(createError(id, `"${method}" is not a function.`));
      return;
    }

    try {
      const result = await fn.apply(this.api, args);
      this.transport.send(createResponse(id, result));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.transport.send(createError(id, errorMessage));
    }
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------

  /** Remove all listeners and stop responding to RPC calls. */
  destroy(): void {
    this.unsubscribe();
    this.transport.destroy();
  }
}

// ---------------------------------------------------------------------------
// Backward-compatible functional API
// ---------------------------------------------------------------------------

/**
 * Expose an API object so the parent frame can call its methods via RPC.
 *
 * Thin wrapper around `new IframeExposed()` that preserves the original
 * functional API.
 *
 * @param api     Object whose values are async functions.
 * @param options Configuration — at minimum the allowed parent origin.
 * @returns       Handle with a `destroy()` method for cleanup.
 *
 * @example
 * ```ts
 * import { expose } from 'iframeconnector';
 *
 * const api = {
 *   async greet(name: string) { return `Hello, ${name}!`; },
 *   async add(a: number, b: number) { return a + b; },
 * };
 *
 * expose(api, { allowedOrigin: 'https://parent.example.com' });
 * ```
 */
export function expose<T extends ApiMethods>(api: T, options: ExposeOptions): ExposeHandle {
  return new IframeExposed(api, options);
}
