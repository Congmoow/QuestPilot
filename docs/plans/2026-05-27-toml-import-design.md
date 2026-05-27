# TOML 批量导入设计

## 目标

在 `AI 智能录入` 页面为 JSON 批量导入旁增加 TOML 批量导入入口，并支持真实 `.toml` 文件选择、解析、预览和批量导入。

## 现有结构

- 前端页面：`src/pages/AiImport.tsx`
- 页面状态与解析逻辑：`src/features/ai-import/hooks/useAiImport.ts`
- 题目导入 API：`src/api/index.ts`
- CSV 文件导入命令：`src-tauri/src/commands/csv.rs`
- CSV 解析工具：`src-tauri/src/csv_tools.rs`
- TOML 文件导入命令：`src-tauri/src/commands/toml.rs`
- TOML 解析工具：`src-tauri/src/toml_tools.rs`
- Tauri 命令注册：`src-tauri/src/lib.rs`

## 方案

采用方案 A：TOML 文本在前端解析，TOML 文件在 Rust/Tauri 后端用真实 TOML 解析库解析。

- 前端新增 `toml` 模式，放在 JSON 模式右侧。
- TOML 文本粘贴后由前端 TOML 解析工具解析为 `CreateQuestionInput[]`，进入现有右侧预览。
- TOML 模式支持将 `.toml` 文件拖拽到导入页后自动解析，调用 Tauri 后端按路径解析文件。
- 后端新增 `toml_tools` 模块，使用 Rust `toml` crate 解析 `.toml` 内容，并返回与 CSV 一致的 `ParseResult`。
- 批量入库仍复用现有 `question_create_batch` / `csv_import` 所用的批量导入入口，保持数据库路径不分叉。

## TOML 数据结构

推荐结构：

```toml
[[questions]]
type = "单选题"
content = "以下哪个是基本数据类型？"
options = ["A. String", "B. Array", "C. Object"]
answer = "A"
analysis = "String 是基本数据类型"

[[questions]]
type = "填空题"
content = "___ 是中国首都"
answer = "北京"
```

兼容字段：

- `type` / `题型`
- `content` / `question` / `题目`
- `options` / `选项`
- `answer` / `答案`
- `analysis` / `解析`

前端文本解析与后端文件解析均兼容未加引号的已知中文字段名（`题型`、`题目`、`选项`、`答案`、`解析`）。

## 错误处理

- TOML 语法错误显示 `TOML 格式错误，请检查语法`。
- 空输入显示 `请输入 TOML 格式的题目数据`。
- 单题缺少题干、填空题空栏数量不匹配、判断题答案非法等按现有格式显示具体题号。
- 文件选择取消不报错。
- 文件解析失败在编辑器附近展示 `AlertBanner`。

## 验证

- Rust 单元测试覆盖 TOML 有效/无效内容解析。
- 前端 Vitest 覆盖 TOML 文本解析、中文字段、选项归一化和错误提示。
- 运行目标测试、TypeScript 构建或 Vite 构建确认集成可用。
