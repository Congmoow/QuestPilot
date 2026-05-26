# Test Directory Guide

This directory contains frontend, contract, and end-to-end tests only. Tauri / Rust
tests continue to follow Cargo conventions and live in `src-tauri/tests`.

## Directory Structure

- `unit/api/`: desktop API facade, runtime adapters, and frontend contract tests.
- `unit/features/`: unit tests for frontend feature modules.
- `e2e/`: Playwright end-to-end tests.
- `e2e/helpers/`: end-to-end fixtures and Tauri mocks.

## Commands

- `npm test`: run Vitest tests under `tests/unit`.
- `npm run test:api-contract`: run only desktop API normalization contract tests.
- `npm run test:e2e`: run Playwright end-to-end tests.
- `npm run test:rust`: run `src-tauri/tests` and Rust unit tests.

## Maintenance Boundary

Electron is no longer a maintained runtime, so Electron legacy tests do not belong
in the official test suite. New tests should prioritize the Tauri mainline, the
React renderer, and stable desktop API contracts.
