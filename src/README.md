**English** | [中文](./README.zh-CN.md)

# Frontend Source Guide

React 18 + TypeScript + Vite frontend running inside Tauri WebView.

---

## Directory Structure

```
src/
├── main.tsx              # App entry point — mounts the React root
├── App.tsx               # Route configuration (HashRouter + lazy pages)
├── index.css             # Global styles (Tailwind base + custom design tokens)
│
├── pages/                # Route-level pages (thin assemblers, no business logic)
│   ├── Dashboard.tsx
│   ├── ManualEntry.tsx
│   ├── CsvImport.tsx
│   ├── AiImport.tsx
│   ├── Practice.tsx
│   ├── WrongBook.tsx
│   ├── QuestionPreview.tsx
│   ├── Settings.tsx
│   └── AiChat.tsx
│
├── features/             # Business logic split by domain
│   ├── ai-chat/          # AI Q&A chat
│   ├── ai-import/        # AI / JSON / TOML batch import
│   ├── csv-import/       # CSV batch import
│   ├── dashboard/        # Stats dashboard
│   ├── practice/         # Random practice
│   ├── question-preview/ # Question bank & question browser
│   ├── questions/        # Manual entry
│   ├── settings/         # System settings
│   └── wrong-book/       # Wrong answer book
│
├── components/           # Shared UI components
│   ├── ui/               # Design system primitives (base, forms, question, dashboard, ai)
│   ├── Layout.tsx        # Sidebar + main area layout; owns ThemeContext
│   ├── TitleBar.tsx      # Custom title bar (Tauri window controls)
│   ├── Dialog.tsx        # Generic modal dialog
│   ├── ConfirmDialog.tsx # Confirmation dialog
│   ├── CodeAwareText.tsx # Auto-detects code and switches between <pre> / <span>
│   ├── QuestionBankDialog.tsx  # Create / edit question bank
│   ├── QuestionEditDialog.tsx  # Edit individual question
│   └── SidebarIcons.tsx  # Custom SVG icons for the sidebar
│
├── contexts/             # React Contexts
│   ├── QuestionBankContext.tsx  # Bank list and CRUD operations
│   └── QuestionContext.tsx      # Questions in the active bank (search, pagination)
│
├── api/                  # Tauri backend call wrappers
│   ├── index.ts          # Unified entry point for all invoke calls
│   ├── types.ts          # Shared data types (Question, QuestionBank, etc.)
│   ├── runtimeAdapters.ts  # Normalizes Tauri dialog return values
│   └── index.test.ts     # API layer unit tests
│
├── lib/                  # Pure utility functions (no side effects)
│   ├── utils.ts          # cn(): Tailwind class merging
│   ├── fillBlank.ts      # Fill-in-the-blank slot detection and counting
│   ├── assets.ts         # Static asset path adapter (dev / prod)
│   ├── practiceHelpers.ts  # Shared practice logic (shuffle, normalize answers)
│   ├── questionLabels.ts   # TYPE_LABELS shared constant
│   └── desktopRuntime.ts   # Window control abstraction (Tauri invoke)
│
└── types/
    └── viewModels.ts     # Frontend view-layer types (PracticeQuestion, AnswerMap, etc.)
```

---

## Feature Directory Convention

Every `features/<domain>/` directory follows a consistent three-layer structure:

```
features/<domain>/
├── components/   # Presentation components (receive props, do not call API directly)
├── hooks/        # Custom hooks (own all state, effects, and API calls)
└── utils/        # Pure functions and constants (no React dependencies)
```

**Page files are assemblers only** — they import hooks and components from the corresponding feature and contain no business logic.

---

## Key Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | UI framework, functional components + hooks |
| TypeScript | 5 | Full type coverage across all source files |
| Vite | 5 | Build tool and dev server |
| Tailwind CSS | 3 | Utility-first styling |
| React Router | 6 | HashRouter routing (compatible with Tauri WebView) |
| Framer Motion | — | Transition animations |
| Recharts | — | Statistical charts |
| react-markdown | — | Markdown rendering in AI chat |

---

## Design System (`components/ui/`)

All primitives are named exports assembled through `index.ts`:

| File | Components |
|------|-----------|
| `base.tsx` | `PageHeader`, `SurfaceCard`, `ToolbarCard`, `ActionButton`, `IconButton`, `StatusBadge`, `AlertBanner`, `EmptyState`, `SegmentedTabs` |
| `forms.tsx` | `Field`, `TextInput`, `TextareaInput`, `SelectInput`, `PasswordInput`, `SearchInput` |
| `question.tsx` | `QuestionBankCard`, `PracticeCard`, `QuizShell`, `AnswerOptionCard`, `ResultSummary`, `Pagination`, `TypeBadge` |
| `dashboard.tsx` | `StatCard`, `ChartCard`, `TimelineLog` |
| `ai.tsx` | `JsonEditorPanel`, `ParsedQuestionItem`, `AIChatWelcome`, `ChatMessageBubble`, `ChatComposer`, `ParseEmptyState` |

Usage:

```tsx
import { ActionButton, SurfaceCard, AlertBanner } from '../components/ui';
```

---

## Communicating with the Tauri Backend

All backend calls go through `src/api/index.ts`. Direct `invoke` calls inside components or hooks are not allowed.

```tsx
import api from '../api';

// Examples
const banks = await api.questionBank.getAll();
const result = await api.ai.parseQuestions(text);
```

Command groups: `questionBank`, `question`, `settings`, `ai`, `migration`, `practice`, `wrongBook`, `draft`, `prompt`, `chatHistory`, `csv`.

---

## Dev Commands

```bash
npm run dev          # Start Vite dev server (frontend preview only)
npm run build        # Build frontend output to dist/
npm test             # Run unit tests (Vitest)
npx tsc --noEmit     # Full TypeScript type check
```

For the full desktop application, run `npm run tauri dev` from the project root.
