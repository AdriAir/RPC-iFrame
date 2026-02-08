/**
 * protocol.test.ts - Tests for wire protocol types and message factories
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    IFC_BRAND,
    isProtocolMessage,
    createHandshakeRequest,
    createHandshakeResponse,
    createRequest,
    createResponse,
    createError,
    generateId,
} from "./protocol";

describe("protocol.ts", () => {
    describe("isProtocolMessage", () => {
        it("should return true for valid protocol messages", () => {
            const validMessages = [
                { __ifc: IFC_BRAND, type: "handshake-request", nonce: "123" },
                { __ifc: IFC_BRAND, type: "handshake-response", nonce: "456" },
                { __ifc: IFC_BRAND, type: "request", id: "1", method: "test", args: [] },
                { __ifc: IFC_BRAND, type: "response", id: "1", result: "ok" },
                { __ifc: IFC_BRAND, type: "error", id: "1", error: "fail" },
            ];

            validMessages.forEach((msg) => {
                expect(isProtocolMessage(msg)).toBe(true);
            });
        });

        it("should return false for invalid messages", () => {
            const invalidMessages = [
                null,
                undefined,
                {},
                { type: "request" },
                { __ifc: "wrong-brand", type: "request" },
                "string",
                123,
                [],
            ];

            invalidMessages.forEach((msg) => {
                expect(isProtocolMessage(msg)).toBe(false);
            });
        });
    });

    describe("createHandshakeRequest", () => {
        it("should create a valid handshake request", () => {
            const nonce = "test-nonce-123";
            const message = createHandshakeRequest(nonce);

            expect(message).toEqual({
                __ifc: IFC_BRAND,
                type: "handshake-request",
                nonce,
            });
            expect(isProtocolMessage(message)).toBe(true);
        });
    });

    describe("createHandshakeResponse", () => {
        it("should create a valid handshake response", () => {
            const nonce = "test-nonce-456";
            const message = createHandshakeResponse(nonce);

            expect(message).toEqual({
                __ifc: IFC_BRAND,
                type: "handshake-response",
                nonce,
            });
            expect(isProtocolMessage(message)).toBe(true);
        });
    });

    describe("createRequest", () => {
        it("should create a valid request message", () => {
            const id = "req-123";
            const method = "greet";
            const args = ["Alice", 42];
            const message = createRequest(id, method, args);

            expect(message).toEqual({
                __ifc: IFC_BRAND,
                type: "request",
                id,
                method,
                args,
            });
            expect(isProtocolMessage(message)).toBe(true);
        });

        it("should handle empty args array", () => {
            const message = createRequest("id-1", "noArgs", []);
            expect(message.args).toEqual([]);
        });
    });

    describe("createResponse", () => {
        it("should create a valid response message", () => {
            const id = "resp-123";
            const result = { status: "ok", data: [1, 2, 3] };
            const message = createResponse(id, result);

            expect(message).toEqual({
                __ifc: IFC_BRAND,
                type: "response",
                id,
                result,
            });
            expect(isProtocolMessage(message)).toBe(true);
        });

        it("should handle null and undefined results", () => {
            expect(createResponse("id-1", null).result).toBe(null);
            expect(createResponse("id-2", undefined).result).toBe(undefined);
        });
    });

    describe("createError", () => {
        it("should create a valid error message", () => {
            const id = "err-123";
            const error = "Method not found";
            const message = createError(id, error);

            expect(message).toEqual({
                __ifc: IFC_BRAND,
                type: "error",
                id,
                error,
            });
            expect(isProtocolMessage(message)).toBe(true);
        });
    });

    describe("generateId", () => {
        it("should generate unique IDs", () => {
            const id1 = generateId();
            const id2 = generateId();
            const id3 = generateId();

            expect(id1).toBeTruthy();
            expect(id2).toBeTruthy();
            expect(id3).toBeTruthy();
            expect(id1).not.toBe(id2);
            expect(id2).not.toBe(id3);
            expect(id1).not.toBe(id3);
        });

        it("should use crypto.randomUUID when available", () => {
            if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
                const id = generateId();
                // UUIDs have a specific format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
            }
        });

        it("should fall back to Math.random when crypto.randomUUID is unavailable", () => {
            const originalCrypto = globalThis.crypto;

            // Temporarily remove crypto
            Object.defineProperty(globalThis, "crypto", {
                value: undefined,
                writable: true,
                configurable: true,
            });

            const id = generateId();
            expect(id).toMatch(/^ifc-/);

            // Restore crypto
            Object.defineProperty(globalThis, "crypto", {
                value: originalCrypto,
                writable: true,
                configurable: true,
            });
        });
    });
});
