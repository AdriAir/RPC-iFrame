/**
 * child.ts - Child iframe side of iFrameConnector
 *
 * Exports `expose()` to register callable methods for the parent frame.
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

/** Handle returned by `expose()` for cleanup. */
export interface ExposeHandle {
  /** Remove all listeners and stop responding to RPC calls. */
  destroy: () => void;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Expose an API object so the parent frame can call its methods via RPC.
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
  const { allowedOrigin } = options;
  const transport = new Transport(window.parent, allowedOrigin);

  const unsubscribe = transport.onMessage((message: ProtocolMessage) => {
    switch (message.type) {
      case 'handshake-request': {
        transport.send(createHandshakeResponse(message.nonce));
        break;
      }

      case 'request': {
        dispatchRequest(api, message.id, message.method, message.args, transport);
        break;
      }
    }
  });

  return {
    destroy() {
      unsubscribe();
      transport.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/**
 * Validates and executes an RPC request, sending back the result or error.
 *
 * Extracted from the message handler for clarity: the switch case stays
 * focused on routing, while this function handles validation + execution.
 */
async function dispatchRequest(
  api: ApiMethods,
  id: string,
  method: string,
  args: unknown[],
  transport: Transport,
): Promise<void> {
  // Guard: only own-property methods (no prototype pollution).
  if (!Object.prototype.hasOwnProperty.call(api, method)) {
    transport.send(createError(id, `Method "${method}" is not exposed.`));
    return;
  }

  const fn = api[method];
  if (typeof fn !== 'function') {
    transport.send(createError(id, `"${method}" is not a function.`));
    return;
  }

  try {
    const result = await fn.apply(api, args);
    transport.send(createResponse(id, result));
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    transport.send(createError(id, errorMessage));
  }
}
