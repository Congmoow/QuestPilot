# Frontend Architecture

## Overview

The renderer process is a **React 18 + TypeScript** single-page application bundled by Vite and loaded into a Tauri WebView. All communication with the Rust backend goes through `src/api/index.ts` — no page or component calls `invoke` directly.

---

## Directory Layout

```
src/
├── api/                # Tauri IPC boundary — the only place invoke is called
│   ├── index.ts        # All command functions (one per Rust command)
│   ├── queryKeys.ts    # Centralised TanStack Query cache-key factory
│   ├── runtimeAdapters.ts  # Normalise file-dialog / save-dialog result shapes
│   ├── schemas.ts      # Zod schemas for runtime response validation
│   └── types.ts        # Shared TypeScript types mirroring Rust structs
│
├── features/           # Feature modules (self-contained per domain)
│   ├── ai-chat/        # AI Q&A chat interface
│   ├── ai-import/      # AI parsing + JSON / TOML batch import
│   ├── csv-import/     # CSV template import / export
│   ├── dashboard/      # Stats, charts, operation log
│   ├── practice/       # Random practice session
│   ├── question-preview/  # Question display + answer reveal
│   ├── questions/      # Question list, search, edit
│   ├── settings/       # App settings (theme, API config, threshold)
│   └── wrong-book/     # Wrong-question notebook
│
├── components/         # Shared UI components
│   ├── ui/             # Primitive building blocks (Button, Input, …)
│   ├── Layout.tsx      # Sidebar + main area shell
│   ├── TitleBar.tsx    # Custom Tauri window title bar
│   ├── Dialog.tsx      # Generic modal wrapper
│   ├── ConfirmDialog.tsx   # Confirmation modal
│   ├── QuestionBankDialog.tsx   # Create / edit bank form
│   ├── QuestionEditDialog.tsx   # Create / edit question form
│   ├── CodeAwareText.tsx   # Markdown + inline-code aware text renderer
│   └── SidebarIcons.tsx    # Nav icon set
│
├── contexts/           # React Context for cross-cutting state
│   ├── QuestionBankContext.tsx  # Active bank selection + bank list
│   ├── QuestionContext.tsx      # Question editing state
│   └── index.ts        # Re-exports
│
├── pages/              # Route-level page components (thin wrappers)
│
├── lib/                # Low-level utilities
│   └── desktopRuntime.ts   # invoke wrapper + runtime detection
│
├── types/              # Additional shared TypeScript types
│
├── App.tsx             # Root: router + context providers
└── main.tsx            # Entry point: mount React, TanStack QueryClient
```

---

## Data Flow

```
Page / Feature component
        │
        │  useQuery / useMutation (TanStack Query)
        ▼
src/api/index.ts          ← single invoke gateway
        │
        │  invokeTauriCommand(commandName, params)
        │  Zod schema validation on response
        ▼
Tauri IPC (window.__TAURI__)
        │
        ▼
Rust Command layer  (src-tauri/src/commands/)
```

**Rules**
- Features and pages **never** call `invoke` directly — always through `src/api/index.ts`.
- Query cache is keyed by `queryKeys.*` factories; invalidation always uses the same factory.
- Zod validates API responses at the boundary; type errors surface early rather than silently propagating wrong shapes.

---

## Key Patterns

### 1. API Layer (`src/api/index.ts`)

Every Rust command has exactly one corresponding async function here.  
Each function:
1. Calls `invokeTauriCommand(commandName, params)`.
2. Optionally validates the response with a Zod schema (`safeValidate` / `strictValidate`).
3. Returns a typed result — callers never touch raw `invoke` return values.

```ts
// Example
export const getQuestionBanks = async (): Promise<QuestionBank[]> => {
  const result = await invokeTauriCommand('question_bank_get_all');
  return strictValidate(z.array(QuestionBankSchema), result);
};
```

### 2. TanStack Query — Server-State Management

Remote data (question banks, questions, stats, …) is managed by **TanStack Query**:

- `useQuery` for reads — automatic deduplication, background refresh, stale-while-revalidate.
- `useMutation` for writes — `onSuccess` calls `queryClient.invalidateQueries(queryKeys.*)` to keep the cache consistent.
- Query keys are centralised in `queryKeys.ts`; no magic strings scattered across components.

### 3. Feature Modules (`src/features/`)

Each feature directory owns its own components, hooks, and local state.  
Features communicate with the rest of the app only through:
- **Contexts** (reading the active bank from `QuestionBankContext`).
- **Navigation** (react-router-dom `useNavigate`).
- **Query invalidation** (triggering cache updates after mutations).

### 4. Context — Cross-Cutting UI State

`QuestionBankContext` holds the currently selected bank and the full bank list. It is read by the sidebar, the question list, and any feature that scopes data by bank.

`QuestionContext` holds the question being created or edited within the question dialog, keeping form state out of the question list.

### 5. Runtime Adapters (`runtimeAdapters.ts`)

Tauri's file-selection and save-dialog commands return subtly different shapes depending on the OS and plugin version. The adapter layer normalises them to a stable `FileSelectionResult` / `SaveDialogResult` shape before the API layer exposes them to callers.

---

## Async Safety

No frontend state crosses a Tauri IPC boundary while an async operation is in-flight — each `invoke` call is discrete and returns a fresh value. TanStack Query's loading / error states cover intermediate UI.

---

## Styling Conventions

- **Tailwind CSS** utility classes; no plain CSS files outside `index.css`.
- `clsx` + `tailwind-merge` for conditional class composition.
- Dark-mode variants via Tailwind's `dark:` prefix; theme switching is handled in `SettingsContext` by toggling a class on `<html>`.

---

## Testing

| What | Tool | Location |
|---|---|---|
| API contract (invoke shape normalisation) | Vitest | `tests/unit/api/` |
| Feature parsers (for example TOML text import) | Vitest | `tests/unit/features/` |
| End-to-end user flows | Playwright | `tests/e2e/` |

Unit tests for individual components are not currently in scope; the primary coverage strategy is API-contract tests at the `src/api` boundary, focused feature parser tests, and Playwright E2E for critical user flows.
