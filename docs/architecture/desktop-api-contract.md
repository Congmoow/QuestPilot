# 桌面 API 契约

## 目标

本文件定义前端 `src/api/index.js` 对页面层暴露的稳定契约。页面组件不直接区分 Electron 与 Tauri；运行时差异必须在 `src/api/index.js` 或其适配器中收敛。

## 当前运行时定位

- Electron：当前稳定运行时，仍是默认开发、预览和发布基线。
- Tauri：迁移验证线，已经覆盖大部分功能，但在替换 Electron 前必须继续做契约、权限、窗口和真实流程验收。
- React/Vite：共用渲染层。页面只调用 `src/api/index.js`，不直接调用 `window.electronAPI` 或 Tauri `invoke`。

## 通用契约规则

- 错误信息面向用户时使用中文。
- 页面层接收 camelCase 字段。
- 取消文件对话框统一使用 `canceled` 字段，不使用 Tauri 原始 `cancelled`。
- 文件选择统一返回 `{ success, canceled, filePath }`。
- 保存/导出统一返回 `{ success, canceled, filePath?, count? }`。
- Electron 与 Tauri 的返回结构不一致时，必须在 `src/api/runtimeAdapters.js` 中归一化。

## CSV 契约

| 前端 API | Electron 来源 | Tauri 来源 | 页面层返回 |
| --- | --- | --- | --- |
| `downloadCsvTemplate()` | `api.csv.downloadTemplate()` | `csv_download_template` | `{ success, canceled, filePath? }` |
| `selectCsvFile()` | `api.csv.selectFile()` | `csv_select_file` | `{ success, canceled, filePath }` |
| `parseCsvFile(filePath)` | `api.csv.parseFile(filePath)` | `csv_parse_file` | `{ valid, errors, totalRows }` |
| `importQuestions(bankId, questions)` | `api.csv.importQuestions(...)` | `csv_import` | `{ success, failed, errors }` |
| `exportQuestionBank(bankId)` | `api.csv.exportBank(bankId)` | `csv_export` | `{ success, canceled, filePath?, count? }` |

## 题库与题目契约

| 前端 API | Electron 来源 | Tauri 来源 | 页面层返回 |
| --- | --- | --- | --- |
| `createQuestionBank(data)` | `questionBank:create` | `question_bank_create` | `QuestionBank` |
| `getAllQuestionBanks()` | `questionBank:getAll` | `question_bank_get_all` | `QuestionBank[]`，含 `questionCount` |
| `getQuestionBankById(id)` | `questionBank:getById` | `question_bank_get_by_id` | `QuestionBank | null` |
| `updateQuestionBank(id, data)` | `questionBank:update` | `question_bank_update` | `QuestionBank | null` |
| `deleteQuestionBank(id)` | `questionBank:delete` | `question_bank_delete` | `void` |
| `createQuestion(data)` | `question:create` | `question_create` | `Question` |
| `createQuestionsBatch(bankId, questions)` | `question:createBatch` | `question_create_batch` | `{ success, failed, errors }` |
| `getQuestionsByBankId(bankId, options)` | `question:getByBankId` | `question_get_by_bank_id` | `{ data, total, page, pageSize, totalPages }` |
| `getRandomQuestions(bankId, options)` | `question:getRandom` | `question_get_random` | `Question[]` |
| `getQuestionById(id)` | `question:getById` | `question_get_by_id` | `Question | null` |
| `updateQuestion(id, data)` | `question:update` | `question_update` | `Question | null` |
| `deleteQuestions(ids)` | `question:delete` | `question_delete` | `void` |
| `searchQuestions(bankId, keyword, options)` | `question:search` | `question_search` | `{ data, total, page, pageSize, totalPages }` |

## 设置、AI、记录契约

| 前端 API | Electron 来源 | Tauri 来源 | 页面层返回 |
| --- | --- | --- | --- |
| `getTheme()` / `setTheme(theme)` | `settings:getTheme` / `settings:setTheme` | `settings_get_theme` / `settings_set_theme` | `theme` / `void` |
| `getApiConfig()` / `setApiConfig(config)` | `settings:getApiConfig` / `settings:setApiConfig` | `settings_get_api_config` / `settings_set_api_config` | `{ apiKey, apiUrl, modelId, provider }` / `{ success }` |
| `testApiConnection()` | `settings:testApiConnection` | `settings_test_api_connection` | `{ success, message? }` |
| `parseQuestionsWithAI(content)` | `ai:parseQuestions` | `ai_parse_questions` | `{ questions, chunkErrors?, chunks? }` |
| `chatWithAI(messages, promptId)` | `ai:chat` | `ai_chat` | `{ success, message, content }` |
| `saveDraft(data)` / `loadDraft()` / `clearDraft()` | `draft:*` | `draft_*` | `{ success }` / draft / `{ success }` |
| `getAllPrompts()` 等 Prompt API | `prompt:*` | `prompt_*` | Prompt 对象或列表 |
| `saveChatHistory()` 等聊天历史 API | `chatHistory:*` | `chat_history_*` | ChatHistory 对象或列表 |
| `saveRecord()` 等练习 API | `practice:*` | `practice_*` | 练习记录或 `{ success }` |
| `wrongBook.*` | `wrongBook:*` | `wrong_book_*` | 错题对象、分页结果或 `{ success }` |

## 阶段 1 已修正的漂移

- `csv_select_file` 的 Tauri 返回值从原始 `string | null` 在前端出口归一化为 `{ success, canceled, filePath }`。
- Tauri 保存对话框原始 `cancelled` 字段在前端出口归一化为 `canceled`。
- `downloadCsvTemplate()`、`selectCsvFile()`、`exportQuestionBank()` 现在都会经过 `src/api/runtimeAdapters.js`。

## 后续约束

新增或修改桌面 API 时必须同步更新：

- 本契约文档。
- `src/api/index.js`。
- 必要的 `src/api/runtimeAdapters.js` 适配逻辑。
- `scripts/__tests__/runtime-adapters.test.mjs` 或对应契约测试。
