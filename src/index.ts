/**
 * iFrameConnector - Public API
 *
 * This is the single entry point for the library. It re-exports everything
 * a consumer needs:
 *
 *   - `connectIframe` — parent side: connect to a child iframe (functional API)
 *   - `expose`        — child side:  register callable methods (functional API)
 *   - `IframeConnection` — parent side class (OOP API)
 *   - `IframeExposed`    — child side class  (OOP API)
 *   - All public TypeScript types for full type safety
 *
 * Both the functional and class-based APIs are fully supported.
 * The functions are thin wrappers around the classes, so behaviour is identical.
 *
 * @example
 * ```ts
 * // Parent page — functional style (unchanged from v0.0.1)
 * import { connectIframe } from 'iframeconnector';
 *
 * interface ChildApi {
 *   greet(name: string): Promise<string>;
 *   add(a: number, b: number): Promise<number>;
 * }
 *
 * const iframe = document.getElementById('child') as HTMLIFrameElement;
 * const { remote, destroy } = await connectIframe<ChildApi>(iframe, {
 *   targetOrigin: 'https://child.example.com',
 * });
 *
 * console.log(await remote.greet('World')); // "Hello, World!"
 * console.log(await remote.add(2, 3));      // 5
 *
 * // When done:
 * destroy();
 * ```
 *
 * ```ts
 * // Parent page — class style (new OOP API)
 * import { IframeConnection } from 'iframeconnector';
 *
 * const conn = await IframeConnection.connect<ChildApi>(iframe, {
 *   targetOrigin: 'https://child.example.com',
 * });
 * console.log(await conn.remote.greet('World'));
 * conn.destroy();
 * ```
 *
 * ```ts
 * // Child page (inside the iframe)
 * import { expose } from 'iframeconnector';
 *
 * expose({
 *   async greet(name: string) { return `Hello, ${name}!`; },
 *   async add(a: number, b: number) { return a + b; },
 * }, { allowedOrigin: 'https://parent.example.com' });
 * ```
 */

// Parent API
export { connectIframe, IframeConnection } from './parent';
export type { Connection } from './parent';

// Child API
export { expose, IframeExposed } from './child';
export type { ExposeHandle } from './child';

// Public types
export type {
  ApiMethods,
  RemoteApi,
  ConnectOptions,
  ExposeOptions,
} from './core/types';
