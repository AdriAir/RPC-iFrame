/**
 * transport.test.ts - Tests for the secure postMessage transport layer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Transport } from "./transport";
import { createHandshakeRequest, createRequest } from "./protocol";

describe("transport.ts", () => {
    let mockTargetWindow: Window;
    let messageListeners: Array<(event: MessageEvent) => void>;

    beforeEach(() => {
        // Mock target window
        mockTargetWindow = {
            postMessage: vi.fn(),
        } as unknown as Window;

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

    describe("constructor", () => {
        it("should create a transport instance and register message listener", () => {
            const transport = new Transport(
                mockTargetWindow,
                "https://example.com",
            );

            expect(window.addEventListener).toHaveBeenCalledWith(
                "message",
                expect.any(Function),
            );
            expect(messageListeners).toHaveLength(1);

            transport.destroy();
        });
    });

    describe("send", () => {
        it("should send a protocol message to the target window", () => {
            const transport = new Transport(
                mockTargetWindow,
                "https://example.com",
            );
            const message = createHandshakeRequest("test-nonce");

            transport.send(message);

            expect(mockTargetWindow.postMessage).toHaveBeenCalledWith(
                message,
                "https://example.com",
            );

            transport.destroy();
        });

        it("should respect targetOrigin when sending", () => {
            const transport = new Transport(mockTargetWindow, "*");
            const message = createRequest("id-1", "test", []);

            transport.send(message);

            expect(mockTargetWindow.postMessage).toHaveBeenCalledWith(
                message,
                "*",
            );

            transport.destroy();
        });
    });

    describe("onMessage", () => {
        it("should invoke callback when receiving valid protocol messages from correct origin", () => {
            const transport = new Transport(
                mockTargetWindow,
                "https://example.com",
            );
            const callback = vi.fn();

            transport.onMessage(callback);

            const message = createHandshakeRequest("nonce-123");
            const event = new MessageEvent("message", {
                data: message,
                origin: "https://example.com",
            });

            // Simulate receiving the message
            messageListeners[0](event);

            expect(callback).toHaveBeenCalledWith(
                message,
                "https://example.com",
            );

            transport.destroy();
        });

        it("should ignore messages from wrong origin", () => {
            const transport = new Transport(
                mockTargetWindow,
                "https://example.com",
            );
            const callback = vi.fn();

            transport.onMessage(callback);

            const message = createHandshakeRequest("nonce-123");
            const event = new MessageEvent("message", {
                data: message,
                origin: "https://evil.com",
            });

            messageListeners[0](event);

            expect(callback).not.toHaveBeenCalled();

            transport.destroy();
        });

        it("should accept messages from any origin when targetOrigin is '*'", () => {
            const transport = new Transport(mockTargetWindow, "*");
            const callback = vi.fn();

            transport.onMessage(callback);

            const message = createRequest("id-1", "test", []);
            const event = new MessageEvent("message", {
                data: message,
                origin: "https://any-origin.com",
            });

            messageListeners[0](event);

            expect(callback).toHaveBeenCalledWith(
                message,
                "https://any-origin.com",
            );

            transport.destroy();
        });

        it("should ignore non-protocol messages", () => {
            const transport = new Transport(
                mockTargetWindow,
                "https://example.com",
            );
            const callback = vi.fn();

            transport.onMessage(callback);

            // Messages without the IFC brand
            const invalidMessages = [
                { type: "handshake-request", nonce: "123" },
                { __ifc: "wrong-brand", type: "request" },
                "plain string",
                { random: "object" },
            ];

            invalidMessages.forEach((data) => {
                const event = new MessageEvent("message", {
                    data,
                    origin: "https://example.com",
                });
                messageListeners[0](event);
            });

            expect(callback).not.toHaveBeenCalled();

            transport.destroy();
        });

        it("should return an unsubscribe function", () => {
            const transport = new Transport(
                mockTargetWindow,
                "https://example.com",
            );
            const callback = vi.fn();

            const unsubscribe = transport.onMessage(callback);

            // Send message - should be received
            const message1 = createRequest("id-1", "test", []);
            const event1 = new MessageEvent("message", {
                data: message1,
                origin: "https://example.com",
            });
            messageListeners[0](event1);
            expect(callback).toHaveBeenCalledTimes(1);

            // Unsubscribe
            unsubscribe();

            // Send another message - should NOT be received
            const message2 = createRequest("id-2", "test", []);
            const event2 = new MessageEvent("message", {
                data: message2,
                origin: "https://example.com",
            });
            messageListeners[0](event2);
            expect(callback).toHaveBeenCalledTimes(1); // Still 1, not 2

            transport.destroy();
        });

        it("should support multiple callbacks", () => {
            const transport = new Transport(
                mockTargetWindow,
                "https://example.com",
            );
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            transport.onMessage(callback1);
            transport.onMessage(callback2);

            const message = createRequest("id-1", "test", []);
            const event = new MessageEvent("message", {
                data: message,
                origin: "https://example.com",
            });

            messageListeners[0](event);

            expect(callback1).toHaveBeenCalledWith(
                message,
                "https://example.com",
            );
            expect(callback2).toHaveBeenCalledWith(
                message,
                "https://example.com",
            );

            transport.destroy();
        });
    });

    describe("destroy", () => {
        it("should remove event listener and clear callbacks", () => {
            const transport = new Transport(
                mockTargetWindow,
                "https://example.com",
            );
            const callback = vi.fn();

            transport.onMessage(callback);
            expect(messageListeners).toHaveLength(1);

            transport.destroy();

            expect(window.removeEventListener).toHaveBeenCalledWith(
                "message",
                expect.any(Function),
            );
            expect(messageListeners).toHaveLength(0);

            // Verify callbacks are cleared
            const message = createRequest("id-1", "test", []);
            new MessageEvent("message", {
                data: message,
                origin: "https://example.com",
            });

            // Attempting to trigger the listener should do nothing
            expect(callback).not.toHaveBeenCalled();
        });
    });
});
