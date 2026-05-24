# Tauri + Rust 5C SQLite PoC 实施记录

## 目标

阶段 5C 在 5B 最小壳基础上，把 Rust command 从占位实现推进到最小 SQLite 数据闭环。目标不是完整迁移 Electron，而是验证 Rust + `rusqlite` 是否能承接 QuestPilot 的核心本地数据路径。

## 本阶段范围

已接入 Rust SQLite PoC 的命令：

- `question_bank_create`
- `question_bank_get_all`
- `question_create_batch`
- `question_get_random`
- `settings_get_theme`
- `settings_set_theme`
- `csv_select_file`
- `csv_parse_file`

仍不迁移：

- 题库更新 / 删除
- 题目分页 / 搜索 / 更新 / 删除
- 错题本
- 练习记录
- AI 解析和 AI 问答
- Prompt 与聊天历史

## 数据兼容策略

Rust PoC 复用当前 Electron 数据库核心结构：

- 数据库文件名：`questpilot.db`
- 题库表：`question_banks`
- 题目表：`questions`
- 操作日志表：`operation_logs`
- 设置表：`settings`

表字段继续使用当前 SQLite 层的 `snake_case`：

- `bank_id`
- `created_at`
- `updated_at`
- `question_count`

返回给前端时通过 `serde(rename_all = "camelCase")` 转成现有前端契约：

- `bankId`
- `createdAt`
- `updatedAt`
- `questionCount`

`options` 仍按当前行为存为 JSON 字符串，读取随机题目时解析为数组或 `null`。

## 语义对齐

`question_create_batch` 对齐当前 IPC 层返回值：

- `success`
- `failed`
- `errors: [{ index, message }]`

有效题目使用 SQLite 事务批量写入，并更新 `question_banks.updated_at`。

`question_get_random` 对齐当前 Electron 行为：

- 非法 `bankId` 返回空数组。
- `limit` 钳制到 `1..1000`。
- 支持可选题型过滤。
- SQL 使用 `ORDER BY RANDOM()`。

## 当前验证状态

Rust 工具链已迁到 D 盘路径：

- `CARGO_HOME=D:\Rust\.cargo`
- `RUSTUP_HOME=D:\Rust\.rustup`

已完成验证：

- `rustup show` 可识别 `D:\Rust\.rustup` 下的 stable toolchain。
- `rustc --version`：`rustc 1.95.0`。
- `cargo --version`：`cargo 1.95.0`。
- `npm run tauri:info` 可识别 Rust、Cargo、WebView2 和 Visual Studio 2022。
- `cd src-tauri && cargo check` 通过。
- `npm run tauri:build` 通过。
- Tauri 生产 exe 短时启动 smoke 通过：进程启动并保持运行 8 秒后手动结束。

当前体积：

- `src-tauri/target/release/questpilot-tauri.exe`：约 12.05 MB。
- `src-tauri/target/release/bundle/nsis/QuestPilot_1.5.6_x64-setup.exe`：约 4.19 MB。
- 对照当前 Electron `release/win-unpacked/QuestPilot.exe`：约 180.07 MB。

## 下一步

1. 补 Tauri UI 层 smoke：题库创建、AI/JSON 批量导入后随机练题。
2. 增加 Rust 侧测试或命令级夹具，验证题型校验、批量写入、随机抽题。
3. 设计旧 Electron `questpilot.db` 到 Tauri app data 目录的迁移策略。
4. 继续迁移题目分页 / 搜索 / 更新 / 删除等核心命令。
