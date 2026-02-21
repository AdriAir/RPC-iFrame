# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-09

### Changed

- Strict TypeScript typing fixes in unit tests
- Improved project documentation

## [0.1.0] - 2026-02-09

### Added

- Core RPC engine over `postMessage` with nonce-based handshake
- Functional API: `connectIframe()` (parent) and `expose()` (child)
- OOP API: `IframeConnection` class and `IframeExposed` class
- Typed `RemoteApi<T>` proxy for full autocompletion on remote calls
- Origin validation at the transport layer
- Configurable handshake and per-call timeouts
- `__ifc` brand field to filter unrelated `postMessage` traffic
- Prototype-pollution guard on exposed methods
- Dual-format build: ESM (`dist/index.js`) + CJS (`dist/index.cjs`) with TypeScript declarations
- Unit tests with Vitest and happy-dom
- Documentation: getting started, API reference, architecture, security, examples, compatibility, roadmap
