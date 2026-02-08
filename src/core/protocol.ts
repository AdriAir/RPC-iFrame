/**
 * protocol.ts - Wire protocol types and message factories
 *
 * Defines every message shape that travels over postMessage between parent
 * and child, plus pure-function factories for creating them.
 *
 * Design decisions:
 * - Every message carries a `__ifc` brand so we can discard unrelated
 *   postMessage traffic without parsing the full payload.
 * - Handshake uses a random nonce to prevent rogue frames from spoofing.
 * - Request/Response/Error share an `id` field for Promise matching.
 * - crypto.randomUUID() is used for IDs (supported in modern browsers
 *   and Node 19+), with a Math.random fallback for older environments.
 */

// ---------------------------------------------------------------------------
// Brand — tags every message from this library
// ---------------------------------------------------------------------------

export const IFC_BRAND = '__ifc__' as const;

// ---------------------------------------------------------------------------
// Message types (discriminated union on `type` field)
// ---------------------------------------------------------------------------

/** Base shape shared by all protocol messages. */
interface BrandedMessage {
  readonly __ifc: typeof IFC_BRAND;
}

export interface HandshakeRequest extends BrandedMessage {
  readonly type: 'handshake-request';
  readonly nonce: string;
}

export interface HandshakeResponse extends BrandedMessage {
  readonly type: 'handshake-response';
  readonly nonce: string;
}

export interface RequestMessage extends BrandedMessage {
  readonly type: 'request';
  readonly id: string;
  readonly method: string;
  readonly args: unknown[];
}

export interface ResponseMessage extends BrandedMessage {
  readonly type: 'response';
  readonly id: string;
  readonly result: unknown;
}

export interface ErrorMessage extends BrandedMessage {
  readonly type: 'error';
  readonly id: string;
  readonly error: string;
}

/** Union of all valid protocol messages. */
export type ProtocolMessage =
  | HandshakeRequest
  | HandshakeResponse
  | RequestMessage
  | ResponseMessage
  | ErrorMessage;

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

/** Returns true if `data` is a message produced by iFrameConnector. */
export function isProtocolMessage(data: unknown): data is ProtocolMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).__ifc === IFC_BRAND
  );
}

// ---------------------------------------------------------------------------
// Message factories
// ---------------------------------------------------------------------------

export function createHandshakeRequest(nonce: string): HandshakeRequest {
  return { __ifc: IFC_BRAND, type: 'handshake-request', nonce };
}

export function createHandshakeResponse(nonce: string): HandshakeResponse {
  return { __ifc: IFC_BRAND, type: 'handshake-response', nonce };
}

export function createRequest(id: string, method: string, args: unknown[]): RequestMessage {
  return { __ifc: IFC_BRAND, type: 'request', id, method, args };
}

export function createResponse(id: string, result: unknown): ResponseMessage {
  return { __ifc: IFC_BRAND, type: 'response', id, result };
}

export function createError(id: string, error: string): ErrorMessage {
  return { __ifc: IFC_BRAND, type: 'error', id, error };
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generates a unique ID using crypto.randomUUID() when available,
 * falling back to Math.random + timestamp for older environments.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ifc-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
