# 桌面 API 契约

## 目标

本文件定义前端 `src/api/index.ts` 对页面层暴露的稳定契约。Tauri-only 主线下，页面组件只调用本 API 门面，不直接调用 Tauri `invoke`。

## 当前运行时定位

- Tauri：当前远端唯一发布运行时。
- Electron：仅作为旧版数据来源和历史实现参考，不再作为远端运行时、构建或 CI 对象。
- React/Vite：共用渲染层。页面只调用 `src/api/index.ts`，不直接调用 Tauri `invoke`。

## 通用契约规则

- 错误信息面向用户时使用中文。
- 页面层接收 camelCase 字段。
- 取消文件对话框统一使用 `canceled` 字段，不使用 Tauri 原始 `cancelled`。
- 文件选择统一返回 `{ success, canceled, filePath }`。
- 保存/导出统一返回 `{ success, canceled, filePath?, count? }`。
- 桌面命令返回结构不一致时，必须在 `src/api/runtimeAdapters.js` 中归一化。

## IPC 与数据层边界

- Renderer 传入的 ID、分页、题型、批量 ID 列表必须在 IPC 或数据库入口归一化。
- Tauri 命令入口和数据库入口不得直接信任 renderer 输入。
- 动态值必须使用 prepared statement 参数绑定；确实需要动态 SQL 片段时，只能来自白名单或已归一化值。
- 分页参数统一限制为正整数，`pageSize` 最大值为 `1000`。
- 题型参数只能使用 `single`、`multiple`、`boolean`、`fill`、`short`。
- 非法参数应返回稳定中文错误，不能把底层 SQL 异常暴露给页面层。

## AI Key 与配置契约

- `getApiConfig()` 不向页面层返回完整 API Key。
- 页面层只允许接收 `hasApiKey` 和 `apiKeyPreview` 判断配置状态与展示脱敏预览。
- 返回对象保留 `apiKey: ""` 作为兼容字段，禁止把完整 Key 写入 React state 或输入框。
- `setApiConfig(config)` 收到空白 `apiKey` 时保留已保存 Key；收到非空 `apiKey` 时才替换。
- 真实 AI 请求、连接测试只在 Tauri 后端命令层读取完整 Key。
- 日志、错误信息、文档示例和测试输出不得包含真实完整 Key。

## CSV 契约

| 前端 API | Tauri command | 页面层返回 |
| --- | --- | --- |
| `downloadCsvTemplate()` | `csv_download_template` | `{ success, canceled, filePath? }` |
| `selectCsvFile()` | `csv_select_file` | `{ success, canceled, filePath }` |
| `parseCsvFile(filePath)` | `csv_parse_file` | `{ valid, errors, totalRows }` |
| `importQuestions(bankId, questions)` | `csv_import` | `{ success, failed, errors }` |
| `exportQuestionBank(bankId)` | `csv_export` | `{ success, canceled, filePath?, count? }` |

## 题库与题目契约

| 前端 API | Tauri command | 页面层返回 |
| --- | --- | --- |
| `createQuestionBank(data)` | `question_bank_create` | `QuestionBank` |
| `getAllQuestionBanks()` | `question_bank_get_all` | `QuestionBank[]`，含 `questionCount` |
| `getQuestionBankById(id)` | `question_bank_get_by_id` | `QuestionBank | null` |
| `updateQuestionBank(id, data)` | `question_bank_update` | `QuestionBank | null` |
| `deleteQuestionBank(id)` | `question_bank_delete` | `void` |
| `createQuestion(data)` | `question_create` | `Question` |
| `createQuestionsBatch(bankId, questions)` | `question_create_batch` | `{ success, failed, errors }` |
| `getQuestionsByBankId(bankId, options)` | `question_get_by_bank_id` | `{ data, total, page, pageSize, totalPages }` |
| `getRandomQuestions(bankId, options)` | `question_get_random` | `Question[]` |
| `getQuestionById(id)` | `question_get_by_id` | `Question | null` |
| `updateQuestion(id, data)` | `question_update` | `Question | null` |
| `deleteQuestions(ids)` | `question_delete` | `void` |
| `searchQuestions(bankId, keyword, options)` | `question_search` | `{ data, total, page, pageSize, totalPages }` |

## 设置、AI、记录契约

| 前端 API | Tauri command | 页面层返回 |
| --- | --- | --- |
| `getTheme()` / `setTheme(theme)` | `settings_get_theme` / `settings_set_theme` | `theme` / `void` |
| `getApiConfig()` / `setApiConfig(config)` | `settings_get_api_config` / `settings_set_api_config` | `{ apiKey: "", apiKeyPreview, hasApiKey, apiUrl, modelId, provider }` / `{ success }` |
| `testApiConnection()` | `settings_test_api_connection` | `{ success, message? }` |
| `parseQuestionsWithAI(content)` | `ai_parse_questions` | `{ questions, chunkErrors?, chunks? }` |
| `chatWithAI(messages, promptId)` | `ai_chat` | `{ success, message, content }` |
| `saveDraft(data)` / `loadDraft()` / `clearDraft()` | `draft_*` | `{ success }` / draft / `{ success }` |
| `getAllPrompts()` 等 Prompt API | `prompt_*` | Prompt 对象或列表 |
| `saveChatHistory()` 等聊天历史 API | `chat_history_*` | ChatHistory 对象或列表 |
| `saveRecord()` 等练习 API | `practice_*` | 练习记录或 `{ success }` |
| `wrongBook.*` | `wrong_book_*` | 错题对象、分页结果或 `{ success }` |

## 阶段 1 已修正的漂移

- `csv_select_file` 的 Tauri 返回值从原始 `string | null` 在前端出口归一化为 `{ success, canceled, filePath }`。
- Tauri 保存对话框原始 `cancelled` 字段在前端出口归一化为 `canceled`。
- `downloadCsvTemplate()`、`selectCsvFile()`、`exportQuestionBank()` 现在都会经过 `src/api/runtimeAdapters.js`。

## 历史加固记录

- Electron 侧参数守卫和配置脱敏仅作为历史参考；Tauri-only 主线以后端命令和 Rust 数据库入口为准。
- Tauri 的 `getApiConfig()` 不返回完整 API Key。
- 设置页不会把读取到的完整 Key 写回输入框；已保存 Key 只显示脱敏预览。
- 空白 Key 保存会保留已有 Key，避免用户只改模型或地址时误清空凭据。
- Tauri 当前覆盖见 Rust 测试 `public_api_config_does_not_expose_full_api_key`。

## 后续约束

新增或修改桌面 API 时必须同步更新：

- 本契约文档。
- `src/api/index.ts`。
- 必要的 `src/api/runtimeAdapters.js` 适配逻辑。
- `scripts/__tests__/runtime-adapters.test.mjs` 或对应契约测试。
- 涉及 Tauri 数据库参数边界时，同步更新 Rust 数据库测试。
