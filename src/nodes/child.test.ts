/**
 * child.test.ts - Tests for child iframe side
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IframeExposed, expose } from "./child";
import {
    createHandshakeRequest,
    createRequest,
    IFC_BRAND,
} from "../core/protocol";

describe("child.ts", () => {
    let mockParentWindow: Window;
    let messageListeners: Array<(event: MessageEvent) => void>;

    beforeEach(() => {
        // Mock parent window
        mockParentWindow = {
            postMessage: vi.fn(),
        } as unknown as Window;

        // Mock window.parent
        Object.defineProperty(window, "parent", {
            value: mockParentWindow,
            writable: true,
            configurable: true,
        });

        // Track message listeners
        messageListeners = [];

        // Mock window.addEventListener and removeEventListener
        vi.spyOn(window, "addEventListener").mockImplementation(
            (type, listener) => {
                if (type === "message") {
                    messageListeners.push(
                        listener as (event: MessageEvent) => void,
                    );
                }
            },
        );

        vi.spyOn(window, "removeEventListener").mockImplementation(
            (type, listener) => {
                if (type === "message") {
                    const index = messageListeners.indexOf(
                        listener as (event: MessageEvent) => void,
                    );
                    if (index > -1) {
                        messageListeners.splice(index, 1);
                    }
                }
            },
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
        messageListeners = [];
    });

    /**
     * Helper to simulate receiving a message from parent
     */
    function simulateParentMessage(
        data: unknown,
        origin = "https://parent.example.com",
    ) {
        const event = new MessageEvent("message", { data, origin });
        messageListeners.forEach((listener) => listener(event));
    }

    describe("IframeExposed", () => {
        it("should respond to handshake requests", () => {
            const api = {
                async greet(name: string) {
                    return `Hello, ${name}!`;
                },
            };

            const handle = new IframeExposed(api, {
                allowedOrigin: "https://parent.example.com",
            });

            const nonce = "test-nonce-123";
            const handshakeRequest = createHandshakeRequest(nonce);

            simulateParentMessage(handshakeRequest);

            expect(mockParentWindow.postMessage).toHaveBeenCalledWith(
                {
                    __ifc: IFC_BRAND,
                    type: "handshake-response",
                    nonce,
                },
                "https://parent.example.com",
            );

            handle.destroy();
        });

        it("should execute RPC requests and return results", async () => {
            const api = {
                async add(a: number, b: number) {
                    return a + b;
                },
                async greet(name: string) {
                    return `Hello, ${name}!`;
                },
            };

            const handle = new IframeExposed(api, {
                allowedOrigin: "https://parent.example.com",
            });

            const requestId = "req-123";
            const request = createRequest(requestId, "add", [5, 3]);

            simulateParentMessage(request);

            // Wait for async execution
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(mockParentWindow.postMessage).toHaveBeenCalledWith(
                {
                    __ifc: IFC_BRAND,
                    type: "response",
                    id: requestId,
                    result: 8,
                },
                "https://parent.example.com",
            );

            handle.destroy();
        });

        it("should return error for non-existent methods", async () => {
            const api = {
                async existing() {
                    return "ok";
                },
            };

            const handle = new IframeExposed(api, {
                allowedOrigin: "https://parent.example.com",
            });

            const requestId = "req-456";
            const request = createRequest(requestId, "nonExistent", []);

            simulateParentMessage(request);

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(mockParentWindow.postMessage).toHaveBeenCalledWith(
                {
                    __ifc: IFC_BRAND,
                    type: "error",
                    id: requestId,
                    error: 'Method "nonExistent" is not exposed.',
                },
                "https://parent.example.com",
            );

            handle.destroy();
        });

        it("should return error for non-function properties", async () => {
            const api = {
                notAFunction: "just a string",
                async validMethod() {
                    return "ok";
                },
            } as any;

            const handle = new IframeExposed(api, {
                allowedOrigin: "https://parent.example.com",
            });

            const requestId = "req-789";
            const request = createRequest(requestId, "notAFunction", []);

            simulateParentMessage(request);

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(mockParentWindow.postMessage).toHaveBeenCalledWith(
                {
                    __ifc: IFC_BRAND,
                    type: "error",
                    id: requestId,
                    error: '"notAFunction" is not a function.',
                },
                "https://parent.example.com",
            );

            handle.destroy();
        });

        it("should catch and return errors from methods", async () => {
            const api = {
                async failing() {
                    throw new Error("Intentional error");
                },
            };

            const handle = new IframeExposed(api, {
                allowedOrigin: "https://parent.example.com",
            });

            const requestId = "req-error";
            const request = createRequest(requestId, "failing", []);

            simulateParentMessage(request);

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(mockParentWindow.postMessage).toHaveBeenCalledWith(
                {
                    __ifc: IFC_BRAND,
                    type: "error",
                    id: requestId,
                    error: "Intentional error",
                },
                "https://parent.example.com",
            );

            handle.destroy();
        });

        it("should ignore messages from wrong origin", () => {
            const api = {
                async secret() {
                    return "secret data";
                },
            };

            const handle = new IframeExposed(api, {
                allowedOrigin: "https://parent.example.com",
            });

            const request = createRequest("id-1", "secret", []);

            // Send from wrong origin
            simulateParentMessage(request, "https://evil.com");

            // Should not have sent any response
            expect(mockParentWindow.postMessage).not.toHaveBeenCalled();

            handle.destroy();
        });

        it("should accept messages from any origin when allowedOrigin is '*'", async () => {
            const api = {
                async test() {
                    return "ok";
                },
            };

            const handle = new IframeExposed(api, {
                allowedOrigin: "*",
            });

            const requestId = "req-any";
            const request = createRequest(requestId, "test", []);

            simulateParentMessage(request, "https://any-origin.com");

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(mockParentWindow.postMessage).toHaveBeenCalledWith(
                {
                    __ifc: IFC_BRAND,
                    type: "response",
                    id: requestId,
                    result: "ok",
                },
                "*",
            );

            handle.destroy();
        });

        it("should prevent prototype pollution attacks", async () => {
            const api = {
                async validMethod() {
                    return "ok";
                },
            };

            const handle = new IframeExposed(api, {
                allowedOrigin: "https://parent.example.com",
            });

            // Try to call prototype methods
            const prototypeAttacks = [
                "constructor",
                "toString",
                "hasOwnProperty",
                "__proto__",
            ];

            for (const method of prototypeAttacks) {
                const requestId = `req-${method}`;
                const request = createRequest(requestId, method, []);

                simulateParentMessage(request);

                await new Promise((resolve) => setTimeout(resolve, 10));

                // Should return error, not execute
                const errorCall = (
                    mockParentWindow.postMessage as any
                ).mock.calls.find((call: any) => call[0].id === requestId);

                expect(errorCall).toBeDefined();
                expect(errorCall[0].type).toBe("error");
                expect(errorCall[0].error).toContain("not exposed");
            }

            handle.destroy();
        });

        it("should handle methods with various argument types", async () => {
            const api = {
                async processData(
                    obj: { name: string },
                    arr: number[],
                    flag: boolean,
                ) {
                    return { obj, arr, flag };
                },
            };

            const handle = new IframeExposed(api, {
                allowedOrigin: "https://parent.example.com",
            });

            const requestId = "req-args";
            const args = [{ name: "test" }, [1, 2, 3], true];
            const request = createRequest(requestId, "processData", args);

            simulateParentMessage(request);

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(mockParentWindow.postMessage).toHaveBeenCalledWith(
                {
                    __ifc: IFC_BRAND,
                    type: "response",
                    id: requestId,
                    result: {
                        obj: { name: "test" },
                        arr: [1, 2, 3],
                        flag: true,
                    },
                },
                "https://parent.example.com",
            );

            handle.destroy();
        });
    });

    describe("expose", () => {
        it("should be a wrapper around IframeExposed", async () => {
            const api = {
                async echo(value: string) {
                    return value;
                },
            };

            const handle = expose(api, {
                allowedOrigin: "https://parent.example.com",
            });

            const requestId = "req-echo";
            const request = createRequest(requestId, "echo", ["test"]);

            simulateParentMessage(request);

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(mockParentWindow.postMessage).toHaveBeenCalledWith(
                {
                    __ifc: IFC_BRAND,
                    type: "response",
                    id: requestId,
                    result: "test",
                },
                "https://parent.example.com",
            );

            handle.destroy();
        });
    });

    describe("destroy", () => {
        it("should remove message listeners", () => {
            const api = {
                async test() {
                    return "ok";
                },
            };

            const handle = new IframeExposed(api, {
                allowedOrigin: "https://parent.example.com",
            });

            const listenerCountBefore = messageListeners.length;
            expect(listenerCountBefore).toBeGreaterThan(0);

            handle.destroy();

            const listenerCountAfter = messageListeners.length;
            expect(listenerCountAfter).toBeLessThan(listenerCountBefore);
        });

        it("should stop responding to messages after destroy", async () => {
            const api = {
                async test() {
                    return "ok";
                },
            };

            const handle = new IframeExposed(api, {
                allowedOrigin: "https://parent.example.com",
            });

            handle.destroy();

            const request = createRequest("req-after-destroy", "test", []);

            simulateParentMessage(request);

            await new Promise((resolve) => setTimeout(resolve, 10));

            // Should not have sent any response
            expect(mockParentWindow.postMessage).not.toHaveBeenCalled();
        });
    });
});
