/**
 * parent.test.ts - Tests for parent-side connection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IframeConnection, connectIframe } from "./parent";
import {
    createHandshakeResponse,
    createResponse,
    createError,
    IFC_BRAND,
} from "../core/protocol";

describe("parent.ts", () => {
    let iframe: HTMLIFrameElement;
    let messageListeners: Array<(event: MessageEvent) => void>;

    beforeEach(() => {
        // Mock iframe with contentWindow
        const mockContentWindow = {
            postMessage: vi.fn(),
        } as unknown as Window;

        iframe = {
            contentWindow: mockContentWindow,
            addEventListener: vi.fn((type, listener) => {
                if (type === "load") {
                    // Immediately trigger load event
                    setTimeout(() => (listener as () => void)(), 0);
                }
            }),
        } as unknown as HTMLIFrameElement;

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
     * Helper to simulate receiving a handshake response
     */
    function simulateHandshakeResponse(
        nonce: string,
        origin = "https://child.example.com",
    ) {
        const message = createHandshakeResponse(nonce);
        const event = new MessageEvent("message", { data: message, origin });

        // Trigger all message listeners
        messageListeners.forEach((listener) => listener(event));
    }

    /**
     * Helper to simulate receiving an RPC response
     */
    function simulateRPCResponse(
        id: string,
        result: unknown,
        origin = "https://child.example.com",
    ) {
        const message = createResponse(id, result);
        const event = new MessageEvent("message", { data: message, origin });

        messageListeners.forEach((listener) => listener(event));
    }

    /**
     * Helper to simulate receiving an RPC error
     */
    function simulateRPCError(
        id: string,
        error: string,
        origin = "https://child.example.com",
    ) {
        const message = createError(id, error);
        const event = new MessageEvent("message", { data: message, origin });

        messageListeners.forEach((listener) => listener(event));
    }

    describe("IframeConnection.connect", () => {
        it("should successfully connect after handshake", async () => {
            const connectPromise = IframeConnection.connect(iframe, {
                targetOrigin: "https://child.example.com",
            });

            // Wait for handshake request to be sent
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Extract nonce from the postMessage call
            const postMessageCalls = (iframe.contentWindow!.postMessage as any)
                .mock.calls;
            expect(postMessageCalls.length).toBeGreaterThan(0);

            const handshakeRequest = postMessageCalls[0][0];
            expect(handshakeRequest.type).toBe("handshake-request");
            const nonce = handshakeRequest.nonce;

            // Simulate handshake response
            simulateHandshakeResponse(nonce);

            const connection = await connectPromise;

            expect(connection).toBeDefined();
            expect(connection.remote).toBeDefined();
            expect(connection.destroy).toBeTypeOf("function");

            connection.destroy();
        });

        it("should reject if iframe.contentWindow is null", async () => {
            const nullIframe = {
                contentWindow: null,
                addEventListener: vi.fn(),
            } as unknown as HTMLIFrameElement;

            await expect(
                IframeConnection.connect(nullIframe, {
                    targetOrigin: "https://child.example.com",
                }),
            ).rejects.toThrow("iframe.contentWindow is null");
        });

        it("should timeout if handshake is not received in time", async () => {
            const connectPromise = IframeConnection.connect(iframe, {
                targetOrigin: "https://child.example.com",
                handshakeTimeout: 100,
            });

            // Don't send handshake response - let it timeout
            await expect(connectPromise).rejects.toThrow(
                "Handshake timed out after 100ms",
            );
        });

        it("should ignore handshake responses with wrong nonce", async () => {
            const connectPromise = IframeConnection.connect(iframe, {
                targetOrigin: "https://child.example.com",
                handshakeTimeout: 200,
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            // Send wrong nonce
            simulateHandshakeResponse("wrong-nonce");

            // Should still timeout because correct nonce was never received
            await expect(connectPromise).rejects.toThrow("Handshake timed out");
        });
    });

    describe("connectIframe", () => {
        it("should be a wrapper around IframeConnection.connect", async () => {
            const connectPromise = connectIframe(iframe, {
                targetOrigin: "https://child.example.com",
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            const postMessageCalls = (iframe.contentWindow!.postMessage as any)
                .mock.calls;
            const nonce = postMessageCalls[0][0].nonce;

            simulateHandshakeResponse(nonce);

            const connection = await connectPromise;

            expect(connection).toBeDefined();
            expect(connection.remote).toBeDefined();

            connection.destroy();
        });
    });

    describe("remote proxy", () => {
        it("should call remote methods and return results", async () => {
            type TestApi = {
                greet(name: string): Promise<string>;
                add(a: number, b: number): Promise<number>;
            };

            const connectPromise = IframeConnection.connect<TestApi>(iframe, {
                targetOrigin: "https://child.example.com",
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            const postMessageCalls = (iframe.contentWindow!.postMessage as any)
                .mock.calls;
            const nonce = postMessageCalls[0][0].nonce;

            simulateHandshakeResponse(nonce);

            const connection = await connectPromise;

            // Call remote method
            const greetPromise = connection.remote.greet("World");

            // Find the request message
            await new Promise((resolve) => setTimeout(resolve, 10));
            const requestCall = postMessageCalls.find(
                (call: any) => call[0].type === "request",
            );
            expect(requestCall).toBeDefined();

            const requestId = requestCall[0].id;
            expect(requestCall[0].method).toBe("greet");
            expect(requestCall[0].args).toEqual(["World"]);

            // Simulate response
            simulateRPCResponse(requestId, "Hello, World!");

            const result = await greetPromise;
            expect(result).toBe("Hello, World!");

            connection.destroy();
        });

        it("should handle errors from remote methods", async () => {
            type TestApi = {
                failing(): Promise<void>;
            };

            const connectPromise = IframeConnection.connect<TestApi>(iframe, {
                targetOrigin: "https://child.example.com",
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            const postMessageCalls = (iframe.contentWindow!.postMessage as any)
                .mock.calls;
            const nonce = postMessageCalls[0][0].nonce;

            simulateHandshakeResponse(nonce);

            const connection = await connectPromise;

            const failingPromise = connection.remote.failing();

            await new Promise((resolve) => setTimeout(resolve, 10));
            const requestCall = postMessageCalls.find(
                (call: any) => call[0].type === "request",
            );
            const requestId = requestCall[0].id;

            // Simulate error response
            simulateRPCError(requestId, "Something went wrong");

            await expect(failingPromise).rejects.toThrow(
                "Something went wrong",
            );

            connection.destroy();
        });

        it("should timeout if remote method does not respond", async () => {
            type TestApi = {
                slow(): Promise<void>;
            };

            const connectPromise = IframeConnection.connect<TestApi>(iframe, {
                targetOrigin: "https://child.example.com",
                callTimeout: 100,
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            const postMessageCalls = (iframe.contentWindow!.postMessage as any)
                .mock.calls;
            const nonce = postMessageCalls[0][0].nonce;

            simulateHandshakeResponse(nonce);

            const connection = await connectPromise;

            // Don't send response - let it timeout
            const slowPromise = connection.remote.slow();

            await expect(slowPromise).rejects.toThrow(
                'Call to "slow" timed out after 100ms',
            );

            connection.destroy();
        });

        it("should handle multiple concurrent calls", async () => {
            type TestApi = {
                echo(value: string): Promise<string>;
            };

            const connectPromise = IframeConnection.connect<TestApi>(iframe, {
                targetOrigin: "https://child.example.com",
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            const postMessageCalls = (iframe.contentWindow!.postMessage as any)
                .mock.calls;
            const nonce = postMessageCalls[0][0].nonce;

            simulateHandshakeResponse(nonce);

            const connection = await connectPromise;

            // Make multiple concurrent calls
            const promise1 = connection.remote.echo("first");
            const promise2 = connection.remote.echo("second");
            const promise3 = connection.remote.echo("third");

            await new Promise((resolve) => setTimeout(resolve, 10));

            // Find all request messages
            const requests = postMessageCalls.filter(
                (call: any) => call[0].type === "request",
            );
            expect(requests.length).toBe(3);

            // Respond to each in reverse order
            simulateRPCResponse(requests[2][0].id, "THIRD");
            simulateRPCResponse(requests[0][0].id, "FIRST");
            simulateRPCResponse(requests[1][0].id, "SECOND");

            // All should resolve correctly
            expect(await promise1).toBe("FIRST");
            expect(await promise2).toBe("SECOND");
            expect(await promise3).toBe("THIRD");

            connection.destroy();
        });
    });

    describe("destroy", () => {
        it("should reject pending calls when destroyed", async () => {
            type TestApi = {
                test(): Promise<void>;
            };

            const connectPromise = IframeConnection.connect<TestApi>(iframe, {
                targetOrigin: "https://child.example.com",
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            const postMessageCalls = (iframe.contentWindow!.postMessage as any)
                .mock.calls;
            const nonce = postMessageCalls[0][0].nonce;

            simulateHandshakeResponse(nonce);

            const connection = await connectPromise;

            const testPromise = connection.remote.test();

            // Destroy before response
            connection.destroy();

            await expect(testPromise).rejects.toThrow("Connection destroyed");
        });

        it("should remove message listeners", async () => {
            const connectPromise = IframeConnection.connect(iframe, {
                targetOrigin: "https://child.example.com",
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            const postMessageCalls = (iframe.contentWindow!.postMessage as any)
                .mock.calls;
            const nonce = postMessageCalls[0][0].nonce;

            simulateHandshakeResponse(nonce);

            const connection = await connectPromise;

            const listenerCountBefore = messageListeners.length;
            expect(listenerCountBefore).toBeGreaterThan(0);

            connection.destroy();

            const listenerCountAfter = messageListeners.length;
            expect(listenerCountAfter).toBeLessThan(listenerCountBefore);
        });
    });
});
