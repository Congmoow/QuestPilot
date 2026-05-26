# QuestPilot

English | [简体中文](README.zh-CN.md)

**QuestPilot** is a local-first, AI-powered desktop application for building, practising, and analysing question banks. All data stays on your machine — no cloud account required. Built with **Tauri 2 + React 18 + Rust + SQLite**.

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.7x-orange?logo=rust&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-bundled-003B57?logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/License-Study%20Only-lightgrey)

---

## Features

| Category | Highlights |
|---|---|
| **Question banks** | Create / edit / delete banks; per-bank question management with pagination, keyword search, and type filter |
| **Question types** | Single-choice, multiple-choice, true/false, fill-in-the-blank (`__` markers), and short answer |
| **Import** | CSV template import, JSON batch import (Chinese & English field names), AI parsing import |
| **Export** | CSV export with UTF-8 BOM for Excel compatibility |
| **Practice** | Random question draws, immediate scoring with explanations, practice history & accuracy trends |
| **Wrong-question notebook** | Auto-records wrong answers; configurable correct-answer threshold for auto-removal; random wrong-question practice |
| **AI Q&A** | Multi-turn chat with custom system prompts; session history persisted locally |
| **Dashboard** | Total questions, daily / weekly additions, type distribution chart, operation log timeline |
| **Settings** | Light / dark / system theme; AI provider config (OpenAI, Claude, Gemini, DeepSeek, Qwen, custom) |
| **Offline first** | All data in local SQLite — no account, no cloud sync required |

---

## Screenshots

![Dashboard](image/README/dashboard.png)

---

## Technical Highlights

### Command → Service → Repository Architecture

The Rust backend follows a strict three-layer separation enforced across every domain:

```
Tauri Command  →  Service  →  Repository  →  DatabaseStore (with_connection / with_transaction)  →  SQLite
```

- **Commands** (`src/commands/`) are thin wrappers: parse invoke params, call `ServiceXxx::new(store).method()`, return the result. No SQL, no business logic.
- **Services** (`src/services/`) own business rules — threshold calculation, cascade-delete guards, multi-repo coordination, pagination math.
- **Repositories** (`src/database/repositories/`) execute SQL directly via `DatabaseStore::with_connection` and `with_transaction`. No domain method delegation.
- **`repositories/helpers.rs`** centralises shared row mappers and SQL helpers (`add_operation_log`, `find_question_by_id`, `query_questions`, etc.) reused across repositories.

### Transaction-Safe Batch Operations

Batch imports and wrong-book updates execute inside a single `rusqlite::Transaction`, guaranteeing atomicity:

```rust
// Wrong-book update: orphan cleanup + wrong-count upsert + correct-count increment + threshold DELETE
self.store.with_transaction(|tx| {
    cleanup_orphans_sql(tx)?;
    for result in results { /* ... */ }
    Ok(())
})?;
// Operation log written after commit in a separate with_connection call
```

Any SQL failure auto-rolls back the entire batch — no partial state is left behind.

### Async-Safe AI Commands (`!Send` Two-Phase Pattern)

`DatabaseStore` holds a `RefCell<Connection>`, making it `!Send`. Tauri async commands must hold no `!Send` types across `.await`. The solution is a strict two-phase pattern enforced in every async command:

```rust
pub async fn ai_parse_questions(app: AppHandle, content: String) -> Result<Value, AppError> {
    // Phase 1: synchronous — all DB access completes, store/service dropped at statement end
    let config = SettingsService::new(open_store(&app)?).get_api_config()?;
    // Phase 2: async — no !Send types alive
    parse_questions_with_ai(&config, &content).await
}
```

### Credential Handling

AI API keys are stored in the **system keychain** (Windows Credential Manager via the `keyring` crate) when available. If the keychain write fails — or if a plaintext key was saved by an earlier app version — the app transparently falls back to SQLite and attempts keychain migration on next read:

```rust
// get_api_config: try keychain first, migrate legacy SQLite key if found
let api_key = match read_keychain_key() {
    Some(key) => key,
    None => { /* attempt migration from SQLite */ legacy_key }
};
```

### Versioned SQLite Schema Migration

The database uses a `schema_migrations` table to track applied migrations. `DatabaseStore::open` runs pending migrations on startup and is idempotent — reopening a fully-migrated database applies nothing.

### Frontend Data Layer

The React renderer uses **TanStack Query** for cache, deduplication, and background revalidation of Tauri `invoke` calls, all behind a typed `src/api/index.ts` adapter. **Zod** validates responses at the boundary, catching schema drift between Rust and TypeScript early.

---

## Architecture

```
┌──────────────────────────────────────────┐
│  React 18 (renderer process)             │
│  TanStack Query + Zod typed invoke layer │
└──────────────────┬───────────────────────┘
                   │  Tauri IPC (invoke)
┌──────────────────▼───────────────────────┐
│  Command layer  (src/commands/)          │  thin: parse → service → return
├──────────────────────────────────────────┤
│  Service layer  (src/services/)          │  business rules, multi-repo coordination
├──────────────────────────────────────────┤
│  Repository layer (src/database/         │  direct SQL via with_connection /
│                    repositories/)        │  with_transaction
├──────────────────────────────────────────┤
│  DatabaseStore  (RefCell<Connection>)    │  connection lifecycle + schema migration
└──────────────────┬───────────────────────┘
                   │
              SQLite (bundled rusqlite)
```

**Key invariants**
- No SQL in Command or Service files.
- Repositories call only `with_connection` / `with_transaction` — never domain methods on `DatabaseStore`.
- All `!Send` types must be dropped before any `.await` point.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 |
| Frontend framework | React 18 + React Router 6 |
| Data fetching | TanStack Query 5 |
| Schema validation | Zod 4 |
| Build tool | Vite 5 |
| Styling | Tailwind CSS + PostCSS |
| Backend language | Rust (edition 2021) |
| Database | SQLite via `rusqlite` 0.32 (bundled) |
| HTTP client | `reqwest` 0.13 (rustls, no OpenSSL) |
| Credential storage | `keyring` 3 (Windows Credential Manager) |
| Animation | Framer Motion 11 |
| Charts | Recharts 2 |
| Markdown + math | react-markdown 10 + KaTeX |
| CSV | PapaParse (frontend) + `csv` crate (Rust) |
| Icons | lucide-react |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- **Rust** stable (install via [rustup](https://rustup.rs/))
- **Windows WebView2 Runtime** (pre-installed on Windows 10 21H2+ and Windows 11)

### Install

```bash
npm install
```

### Run in Development

```bash
# Full desktop app (Vite dev server + Tauri window)
npm run tauri:dev

# Renderer preview only (no Tauri IPC)
npm run dev          # then open http://localhost:5173
```

### Build

```bash
# Tauri release build + Windows NSIS installer
npm run tauri:build
# Output: src-tauri/target/release/bundle/nsis/QuestPilot_<version>_x64-setup.exe
```

### Download Pre-built Installer

Grab `QuestPilot_<version>_x64-setup.exe` from the [GitHub Releases](https://github.com/Congmoow/QuestPilot/releases) page.

---

## Configuration

### AI API

Open **System Settings → AI API Configuration**:

| Field | Notes |
|---|---|
| **Provider** | OpenAI, Claude, Gemini, DeepSeek, Qwen, or any custom OpenAI-compatible endpoint |
| **API URL** | Filled automatically for presets; custom mode accepts any base URL |
| **API Key** | Stored in the system keychain when available; falls back to SQLite with compatibility migration for older app versions |
| **Model** | e.g. `gpt-4o-mini`, `claude-3-5-sonnet-20241022`, `gemini-1.5-pro` |

Claude and Gemini use their own request formats. All other providers use `/v1/chat/completions`.

### Wrong-Question Threshold

**System Settings → Wrong-Question Settings** — configure how many consecutive correct answers remove a question from the notebook (default: 3).

---

## Data Storage

All data is stored locally under `%APPDATA%\com.questpilot.desktop\questpilot.db` and never uploaded automatically.

**Legacy migration**: on first launch the app looks for a `questpilot.db` or `question-bank.db` from the previous Electron-based version and migrates it automatically. If the new database already contains user data, the Settings page provides a manual backup-and-replace flow.

---

## Testing

```bash
# Rust integration tests (31 tests covering all repository + migration paths)
npm run test:rust          # runs: cargo test --manifest-path src-tauri/Cargo.toml

# Frontend unit + API contract tests
npm test                   # runs: vitest run

# Desktop invoke API contract tests only
npm run test:api-contract

# Playwright end-to-end tests
npm run test:e2e
```

Test layout:

| Suite | Location | What it covers |
|---|---|---|
| Rust integration | `src-tauri/tests/` | Repository CRUD, schema migrations, legacy migration, wrong-book workflow |
| Unit / contract | `tests/unit/` | Runtime adapter normalisation, API type contracts |
| End-to-end | `tests/e2e/` | Full user flows via Playwright |

---

## Roadmap

- [ ] macOS support (keychain integration via `keyring` is already cross-platform)
- [ ] Export to Anki-compatible format
- [ ] Shared question bank via local network sync
- [ ] Richer practice modes (timed exam, spaced repetition)

---

## Contributing

Issues and PRs are welcome. Suggested PR contents:

- **Change summary** — what changed and why
- **Screenshots** — for UI-facing changes
- **Verification steps** — how you tested it

---

## License

This project is for study, coursework, technical exchange, and personal research only.
See [`LICENSE`](LICENSE) for restrictions and disclaimers.
