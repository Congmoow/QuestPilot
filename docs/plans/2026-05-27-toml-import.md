# TOML Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add TOML text and real `.toml` file batch import to the AI import page.

**Architecture:** Extend the existing AI import page with a third `toml` mode. Frontend TOML text parsing converts TOML to the same `CreateQuestionInput[]` preview contract as JSON; backend TOML file parsing uses a Tauri command and Rust `toml` crate, then returns the existing `ParseResult` shape.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Tauri 2, Rust 2021, serde, toml, SQLite batch import.

---

### Task 1: Frontend TOML parser tests

**Files:**
- Create: `tests/unit/features/toml-import.test.ts`
- Create: `src/features/ai-import/utils/tomlImport.ts`

**Step 1: Write failing tests**

Add tests for:

- parsing `[[questions]]` TOML with English fields
- parsing Chinese field names
- normalizing multiple-choice answers and string options
- throwing a numbered error when fill answers do not match blanks

**Step 2: Run failing test**

Run: `npm run test:unit -- tests/unit/features/toml-import.test.ts`

Expected: FAIL because `tomlImport.ts` does not exist.

**Step 3: Implement parser**

Implement `parseTomlQuestions(text: string): CreateQuestionInput[]` using a real TOML parser dependency. Reuse existing `normalizeBooleanAnswer`, `normalizeChoiceAnswer`, and `countFillBlanks` rules.

**Step 4: Run passing test**

Run: `npm run test:unit -- tests/unit/features/toml-import.test.ts`

Expected: PASS.

### Task 2: Rust TOML file parser tests

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/toml_tools.rs`
- Create: `src-tauri/tests/toml_tools.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Write failing Rust tests**

Add tests for valid TOML, invalid fill blank answer counts, and malformed TOML syntax.

**Step 2: Run failing test**

Run: `npm run test:rust -- toml_tools`

Expected: FAIL because `toml_tools` module does not exist.

**Step 3: Implement parser**

Add direct `toml` dependency in `src-tauri/Cargo.toml`. Implement `parse_toml_content(content: &str) -> Result<TomlParseResult, String>` returning `valid`, `errors`, and `totalRows` compatible with frontend `ParseResult`.

**Step 4: Run passing test**

Run: `npm run test:rust -- toml_tools`

Expected: PASS.

### Task 3: Tauri API and UI integration

**Files:**
- Modify: `src/api/index.ts`
- Modify: `src/pages/AiImport.tsx`
- Modify: `src/features/ai-import/hooks/useAiImport.ts`
- Create: `src-tauri/src/commands/toml.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add API commands**

Add `toml_select_file` and `toml_parse_file` Tauri commands, plus frontend wrappers `selectTomlFile` and `parseTomlFile`.

**Step 2: Integrate hook state**

Add `tomlInput`, `tomlFile`, `handleTomlParse`, `handleSelectTomlFile`, `handleTomlFileParse`, and include `toml` in `ImportMode`.

**Step 3: Integrate page UI**

Add TOML tab to the right of JSON, TOML placeholder, parse button, file select/parse controls, and error display using existing UI primitives.

**Step 4: Run focused checks**

Run:

- `npm run test:unit -- tests/unit/features/toml-import.test.ts`
- `npm run test:rust -- toml_tools`
- `npm run build`

Expected: all commands pass.

### Task 4: Documentation and final audit

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

**Step 1: Update feature docs**

Update import feature bullets to mention TOML batch import.

**Step 2: Inspect diff**

Run: `git diff --stat` and `git diff -- src/pages/AiImport.tsx src/features/ai-import/hooks/useAiImport.ts src-tauri/src/toml_tools.rs`.

Expected: changes are scoped to TOML import.
