# QuestPilot

English | [简体中文](README.zh-CN.md)

QuestPilot is a desktop question-bank management and practice tool built with Tauri + React + Vite. It supports CSV / JSON / AI import, random practice, a wrong-question notebook, statistics, and AI Q&A.

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-Study%20Only-lightgrey)

---

## Features

### Question Banks and Questions

- **Multiple question banks**: create, edit, and delete question banks; manage questions by bank.
- **Question management**: create, edit, delete, paginate, keyword search, and filter by question type.
- **Question types**: single choice, multiple choice, true/false, fill-in-the-blank with `__` blanks, and short answer.

### Import and Export

- **CSV batch import**: download the standard template, validate rows, and import.
- **CSV export**: export a question bank to CSV with UTF-8 BOM for Excel compatibility.
- **AI parsing import**: paste question text and parse it into structured data through the configured model.
- **JSON batch import**: supports Chinese and English field names for migration from other systems.

### Practice and Wrong-Question Notebook

- **Random practice**: draw random questions, submit answers, and see scores and explanations immediately.
- **Practice statistics**: record practice history and accuracy trends.
- **Wrong-question notebook**: automatically records wrong answers, removes questions after the correct-answer threshold is reached, supports random wrong-question practice, filtering by bank, and manual remove/clear actions.

### Statistics and Experience

- **Dashboard**: total questions, today's additions, last 7 days, type distribution, operation logs, and practice trends.
- **Theme**: light, dark, and system theme.
- **Desktop experience**: custom title bar and single-instance startup.

---

## Screenshots

![Dashboard](image/README/dashboard.png)

---

## Download and Install

### Download from GitHub Releases

Download the Tauri installer from the repository Releases page:

- Windows: `QuestPilot_<version>_x64-setup.exe`

### Local Build Artifact

After running `npm run tauri:build`, the Windows installer is generated under `src-tauri/target/release/bundle/nsis/`.

## Quick Start

### Requirements

- Node.js >= 18
- npm >= 9

### Install Dependencies

```bash
npm install
```

### Development (Desktop App)

```bash
npm run tauri:dev
```

This command starts both the Vite dev server on port `5173` and the Tauri desktop window.

### Development (Frontend Preview Only)

```bash
npm run dev
```

Then visit:

```text
http://localhost:5173
```

### Build and Package

```bash
# Tauri Windows installer
npm run tauri:build
```

After the build completes, the installer is available under `src-tauri/target/release/bundle/nsis/`.

### Clean Build Output

```bash
npm run clean
```

### Tests

```bash
# Frontend unit tests and desktop API contract tests
npm test

# Run only desktop API normalization contract tests
npm run test:api-contract

# Playwright end-to-end tests
npm run test:e2e

# Tauri / Rust tests
npm run test:rust
```

Tests are split across `tests/unit`, `tests/e2e`, and `src-tauri/tests`. Electron is no longer a maintained runtime, so Electron legacy tests do not belong in the official test suite.

---

## Configuration

### AI API Configuration

In the app, open `System Settings` -> `AI API Configuration` and configure:

- **AI service provider**: choose a preset provider such as OpenAI, Claude, Gemini, DeepSeek, or Qwen, or use a custom provider.
- **API URL**:
  - Preset providers fill this automatically, and some providers use OpenAI-compatible APIs.
  - Custom mode accepts any OpenAI-compatible API Base URL.
- **API Key**: your key, stored securely in the system keychain (Windows Credential Manager). It is never written in plaintext to the database.
- **Model**: for example `gpt-4o-mini`, `claude-3-5-sonnet-20241022`, or `gemini-1.5-pro`.

Click `Test Connection` to verify whether the configuration works.

##### Screenshot:

![AI API Configuration](image/README/API-configuration.png)

Compatibility notes:

- Claude and Gemini use their dedicated request formats.
- Most other providers can use the OpenAI-compatible format. The app appends `/v1/chat/completions` when needed.

### Wrong-Question Threshold

In the app, open `System Settings` -> `Wrong-Question Settings` to configure how many correct answers are required before a question is automatically removed from the wrong-question notebook.

##### Screenshot:

![Wrong-question threshold setting](image/README/threshold-setting.png)

---

## Data Storage and Privacy

All data is stored locally by default and is not uploaded automatically.

- **Database file**: `questpilot.db`
- **Tauri database path**: `%APPDATA%\com.questpilot.desktop\questpilot.db`
- **Legacy data compatibility**: on first launch, the app tries to migrate `questpilot.db` or `question-bank.db` from the legacy Electron data directory.
- **Migration conflict handling**: if the Tauri target database already has user data, it is not overwritten silently. You can use the data migration card on the Settings page to back up and replace it.

The database contains question banks, questions, settings including AI configuration, drafts, practice records, the wrong-question notebook, AI prompts, chat history, and related data.

---

## Import and Export Formats

### CSV Import Template

Download the template in the app through `Batch Import` -> `Download Template`.

Header columns:

```text
题型, 题干, 选项A, 选项B, 选项C, 选项D, 选项E, 选项F, 答案, 解析
```

Core field rules:

- **Question type**: `单选题` / `多选题` / `判断题` / `填空题` / `简答题`
- **Choice options**: at least 2 options for choice questions.
- **Answer**:
  - Single choice: `A`
  - Multiple choice: `A|B|D`, separated by `|`
  - True/false: `正确` or `错误`
  - Fill-in-the-blank: use `__` in the stem to mark blanks; separate answers with `|`, and the answer count must match the blank count.
  - Short answer: reference answer is optional.

### JSON Batch Import

The `AI Smart Entry` page supports `JSON Batch Import`, accepts a single object or an array, and supports Chinese and English field-name mappings.

##### Screenshot:

![JSON batch import](image/README/batch-import-JSON.png)

Single-choice example:

```json
{
  "题型": "单选题",
  "题目": "以下哪个是 JavaScript 的基本数据类型？",
  "选项": ["A. String", "B. Array", "C. Object", "D. Function"],
  "答案": "A",
  "解析": "字符串是基本数据类型"
}
```

Multiple-choice example. The answer also supports arrays, comma-separated values, and continuous letters, which are normalized to `A|B|C`:

```json
[
  {
    "题型": "多选题",
    "题目": "以下哪些是前端框架？",
    "选项": ["A. React", "B. Vue", "C. Node.js", "D. Angular"],
    "答案": ["A", "B", "D"]
  }
]
```

### AI Parsing Import

In the `AI Smart Parsing` mode on the `AI Smart Entry` page, paste question text and the app will call the model configured in Settings to parse it into structured JSON. You can then choose a question bank and import the result.

Markdown question sets can be pasted directly. Headings, lists, blockquotes, bold text, inline code, fenced code blocks, and table separators are treated as structure hints and are converted into plain-text stems, options, answers, and explanations as much as possible before import.

Common format example:

```markdown
## 1. JavaScript 基础

1. 以下哪个是基本数据类型？
   A. String
   B. Array
   C. Object
   D. Function
   答案：A
   解析：String 是基本数据类型。

> 答案：正确
> 解析：也支持 Markdown 引用块中的答案和解析。

Q2 React 的特点是什么？
Answer: 组件化
Explanation: 支持英文答案和解析标记。
```

Question numbers can be recognized in forms such as `1.`, `1、`, `(1)`, `【1】`, `第1题`, `Q1`, and `## 1`. Answers can be recognized with labels such as `答案：`, `Answer:`, `参考答案：`, `正确答案：`, and `> 答案`. Explanations can be recognized with labels such as `解析：`, `分析：`, `Explanation:`, and `> 解析`.

Very long pasted content is split into chunks and parsed serially to avoid truncated model output. If some chunks fail, successfully parsed questions are still displayed, and failed chunks are shown above the parse result with expandable details.

##### Screenshot:

![AI smart parsing import](image/README/AI-Intelligent-Parsing.png)

---

## Project Structure

```text
questpilot/
├── image/                    # README images
│   └── README/               # Screenshots referenced by README files
├── src-tauri/                # Tauri mainline runtime
│   ├── src/                  # Rust commands, database, AI, CSV, and window capabilities
│   ├── capabilities/         # Tauri capability permission configuration
│   ├── icons/                # Tauri packaging icons
│   ├── tests/                # Rust integration tests
│   ├── tauri.conf.json       # Tauri app and packaging configuration
│   └── target/release/bundle/nsis/
│                              # Locally built Tauri Windows installer
├── src/                      # React renderer process
│   ├── pages/                # Pages: dashboard, import, practice, wrong book, settings, AI Q&A, etc.
│   ├── components/           # Shared components
│   ├── contexts/             # React Context
│   └── api/                  # Desktop API adapter layer
├── tests/                    # Frontend unit tests and Playwright end-to-end tests
│   ├── unit/                 # Vitest unit and contract tests
│   └── e2e/                  # Playwright end-to-end tests
├── docs/                     # Architecture, migration, acceptance, and release-gate docs
├── scripts/                  # Utility scripts
├── build/                    # Build resources, including icons
└── dist/                     # Vite build output
```

---

## Tech Stack

| Category          | Technology              |
| ----------------- | ----------------------- |
| Desktop framework | Tauri 2                 |
| Frontend          | React 18 + React Router |
| Build tool        | Vite                    |
| Styling           | Tailwind CSS + PostCSS  |
| Local storage     | SQLite (Tauri mainline) |
| CSV               | PapaParse               |
| Charts            | Recharts                |
| Animation         | Framer Motion           |
| Markdown/math     | react-markdown + KaTeX  |
| Icons             | lucide-react            |

---

## Scripts

- **`npm run dev`**: start Vite.
- **`npm run build`**: build the renderer process into `dist/`.
- **`npm run preview`**: preview the Vite build output.
- **`npm run tauri:dev`**: development mode with Vite + Tauri.
- **`npm run tauri:build`**: build the Tauri release exe and Windows NSIS installer.
- **`npm run tauri:info`**: inspect the Tauri environment.
- **`npm test`**: run Vitest unit tests under `tests/unit`.
- **`npm run test:api-contract`**: run desktop API normalization contract tests.
- **`npm run test:e2e`**: run Playwright end-to-end tests.
- **`npm run test:rust`**: run Tauri / Rust tests.
- **`npm run clean`**: clean `dist/`.

---

## Release (GitHub Actions)

The repository is configured to publish by tag through `.github/workflows/release.yml`:

1. Push a tag such as `v1.0.0` to trigger the workflow.
2. CI runs `npm ci` with Node.js 20.
3. Install the Rust stable toolchain.
4. Run `npm run tauri:build`.
5. Upload `src-tauri/target/release/bundle/nsis/*.exe` to GitHub Releases.

---

## FAQ

### `tauri:dev` fails to start or shows a blank screen

- Confirm port `5173` is not occupied. The Vite config uses this fixed port.
- Confirm Rust stable, Windows WebView2 Runtime, and Tauri dependencies are installed.
- If you change the port, also update `devUrl` in `src-tauri/tauri.conf.json`.

### AI calls fail

- Confirm the `API Key`, `API URL`, and `Model` in Settings are correct.
- Claude and Gemini must use their official Base URLs.
- For OpenAI-compatible providers, make sure they support `/v1/chat/completions`.

### CSV import is garbled

- Prefer the template downloaded from the app. It includes a UTF-8 BOM so Excel can detect the encoding more reliably.

---

## Contributing

Issues and pull requests are welcome.

Recommended PR content:

- **Change summary**: what changed and why.
- **Screenshots or recordings**: for UI changes.
- **Self-test steps**: how the change was verified.

---

## License

This project is for study, coursework, technical exchange, and personal research only.
See the repository root [`LICENSE`](LICENSE) file for restrictions and disclaimers.
