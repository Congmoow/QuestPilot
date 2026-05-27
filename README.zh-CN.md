# QuestPilot

[English](README.md) | 简体中文

**QuestPilot** 是一款 **本地优先、AI 驱动**的桌面题库管理与刷题应用。所有数据保存在本机，无需账号，无需云同步。基于 **Tauri 2 + React 18 + Rust + SQLite** 构建。

![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-Backend-000000?logo=rust&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Local--First-003B57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Type--Safe-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-Study%20Only-lightgrey)

---

## 功能特性

| 功能 | 说明 |
|---|---|
| **题库管理** | 创建/编辑/删除题库；分页浏览、关键字搜索、按题型筛选 |
| **题型支持** | 单选、多选、判断、填空（`__` 标记空位）、简答 |
| **导入** | CSV 模板导入、JSON / TOML 批量导入（TOML 文件可拖拽自动解析，支持中英文字段名）、AI 智能解析导入 |
| **导出** | CSV 导出，带 UTF-8 BOM，Excel 兼容 |
| **练习** | 随机抽题、即时判分与解析、练习历史与正确率趋势 |
| **错题本** | 自动记录错题；可配置正确次数阈值自动移除；支持随机练错题 |
| **AI 问答** | 多轮对话，支持自定义系统 Prompt；聊天记录本地持久化 |
| **仪表盘** | 总题数、今日/近 7 日新增、题型分布图表、操作日志时间线 |
| **主题** | 亮色/暗色/跟随系统；AI 提供商配置（OpenAI、Claude、Gemini、DeepSeek、千问、自定义） |
| **离线优先** | 全部数据存于本地 SQLite，无需账号，无云同步 |

---

## 界面预览

![仪表盘](image/README/dashboard.png)

---

## 技术亮点

### Command → Service → Repository 架构

Rust 后端严格遵循三层分离，覆盖每一个业务域：

```
Tauri Command  →  Service  →  Repository  →  DatabaseStore (with_connection / with_transaction)  →  SQLite
```

- **Command 层**（`src/commands/`）：薄层包装，解析 invoke 参数，调用 `ServiceXxx::new(store).method()`，返回结果。无 SQL，无业务逻辑。
- **Service 层**（`src/services/`）：负责业务规则——阈值计算、级联删除保护、多 Repo 协调、分页计算。
- **Repository 层**（`src/database/repositories/`）：通过 `DatabaseStore::with_connection` 和 `with_transaction` 直接执行 SQL，不委托领域方法。
- **`repositories/helpers.rs`**：集中共享的 row mapper 和 SQL helper（`add_operation_log`、`find_question_by_id`、`query_questions` 等），跨 Repository 复用。

### 事务安全的批量操作

批量导入与错题本更新在单个 `rusqlite::Transaction` 内执行。任一 SQL 失败自动回滚整批操作——不会留下半成品数据。错题本更新包含：孤儿记录清理、错误次数 upsert、正确次数递增、达阈值删除，一次性原子完成。

### Async 命令的 `!Send` 两阶段模式

`DatabaseStore` 持有 `RefCell<Connection>`，因此是 `!Send`。每个 async Tauri 命令严格遵循两阶段模式：所有 DB 访问在 `.await` **之前**完成并析构 store，以满足 Rust 的 `Send` 约束，无需任何 unsafe 代码。

### 凭据处理

AI API Key 优先存入**系统密钥管理器**（Windows Credential Manager，通过 `keyring` crate）。若密钥库写入失败，或旧版本曾以明文存入 SQLite，应用会透明地回退到 SQLite，并在下次读取时尝试迁移。

> 完整设计说明和代码约束请参阅 [src-tauri/ARCHITECTURE.md](src-tauri/ARCHITECTURE.md)。

### 版本化 SQLite Schema 迁移

数据库使用 `schema_migrations` 表追踪已执行的迁移。`DatabaseStore::open` 在启动时运行待执行的迁移，操作幂等——重复打开已迁移的数据库不会重复执行。

### 前端数据层

React 渲染进程使用 **TanStack Query** 对 Tauri `invoke` 调用进行缓存、去重与后台刷新，统一收口在有类型的 `src/api/index.ts` 适配层。**Zod** 在边界处校验响应，提前捕获 Rust 与 TypeScript 之间的 Schema 漂移。

---

## 架构

```
┌──────────────────────────────────────────┐
│  React 18（渲染进程）                     │
│  TanStack Query + Zod 类型化 invoke 层    │
└──────────────────┬───────────────────────┘
                   │  Tauri IPC (invoke)
┌──────────────────▼───────────────────────┐
│  Command 层  (src/commands/)             │  薄层：解析 → service → 返回
├──────────────────────────────────────────┤
│  Service 层  (src/services/)             │  业务规则，多 Repo 协调
├──────────────────────────────────────────┤
│  Repository 层 (src/database/            │  通过 with_connection /
│                 repositories/)           │  with_transaction 直接执行 SQL
├──────────────────────────────────────────┤
│  DatabaseStore  (RefCell<Connection>)    │  连接生命周期 + Schema 迁移
└──────────────────┬───────────────────────┘
                   │
              SQLite（bundled rusqlite）
```

**核心约定**
- Command 和 Service 文件中不允许出现 SQL。
- Repository 只调用 `with_connection` / `with_transaction`，不调用 DatabaseStore 领域方法。
- 所有 `!Send` 类型必须在 `.await` 之前析构。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri 2 |
| 前端框架 | React 18 + React Router 6 |
| 数据请求 | TanStack Query 5 |
| Schema 校验 | Zod 4 |
| 构建工具 | Vite 5 |
| 样式方案 | Tailwind CSS + PostCSS |
| 后端语言 | Rust（edition 2021） |
| 数据库 | SQLite via `rusqlite` 0.32（bundled） |
| HTTP 客户端 | `reqwest` 0.13（rustls，无 OpenSSL） |
| 凭据存储 | `keyring` 3（Windows Credential Manager） |
| 动画 | Framer Motion 11 |
| 图表 | Recharts 2 |
| Markdown + 公式 | react-markdown 10 + KaTeX |
| CSV | PapaParse（前端）+ `csv` crate（Rust） |
| 图标 | lucide-react |

---

## 快速开始

### 环境要求

- **Node.js** ≥ 18，**npm** ≥ 9
- **Rust** stable（通过 [rustup](https://rustup.rs/) 安装）
- **Windows WebView2 Runtime**（Windows 10 21H2+ 和 Windows 11 已预装）

### 安装

```bash
npm install
```

### 开发运行

```bash
# 完整桌面应用（Vite 开发服务器 + Tauri 窗口）
npm run tauri:dev

# 仅渲染进程预览（无 Tauri IPC）
npm run dev          # 访问 http://localhost:5173
```

### 构建

```bash
# Tauri release 构建 + Windows NSIS 安装包
npm run tauri:build
# 产物：src-tauri/target/release/bundle/nsis/QuestPilot_<version>_x64-setup.exe
```

### 下载预构建安装包

从 [GitHub Releases](https://github.com/Congmoow/QuestPilot/releases) 下载 `QuestPilot_<version>_x64-setup.exe`。

---

## 配置

### AI API

进入**系统设置 → AI API 配置**：

| 字段 | 说明 |
|---|---|
| **提供商** | OpenAI、Claude、Gemini、DeepSeek、千问，或任意 OpenAI 兼容自定义端点 |
| **API 地址** | 预设自动填充；自定义模式可填写任意 Base URL |
| **API Key** | 优先存入系统密钥管理器；不可用时回退到 SQLite，并兼容旧版本的迁移 |
| **模型** | 如 `gpt-4o-mini`、`claude-3-5-sonnet-20241022`、`gemini-1.5-pro` |

Claude 和 Gemini 走各自专用请求格式；其他提供商使用 `/v1/chat/completions`。

### 错题本阈值

**系统设置 → 错题本设置** — 设置"连续答对多少次后自动移除错题"（默认 3 次）。

---

## 数据存储

所有数据本地存储于 `%APPDATA%\com.questpilot.desktop\questpilot.db`，不会自动上传。

**旧版迁移**：首次启动时，应用会查找旧 Electron 版本遗留的 `questpilot.db` 或 `question-bank.db` 并自动迁移。如新数据库已有用户数据，设置页提供手动备份替换流程。

---

## 测试

```bash
# Rust 集成测试（覆盖全部 Repository + 迁移路径，共 31 个用例）
npm run test:rust          # 等价于：cargo test --manifest-path src-tauri/Cargo.toml

# 前端单元 + API 契约测试
npm test                   # 等价于：vitest run

# 仅桌面 invoke API 契约测试
npm run test:api-contract

# Playwright 端到端测试
npm run test:e2e
```

测试布局：

| 测试套件 | 位置 | 覆盖内容 |
|---|---|---|
| Rust 集成测试 | `src-tauri/tests/` | Repository CRUD、Schema 迁移、旧版迁移、错题本工作流 |
| 单元/契约测试 | `tests/unit/` | 运行时适配器归一化、API 类型契约 |
| 端到端测试 | `tests/e2e/` | 完整用户流程（Playwright） |

---

## 路线图

- 补充更多 Repository 层集成测试
- 完善备份与恢复工作流
- 支持更多导入格式（如 Markdown）
- 探索更丰富的练习分析与间隔重复策略

---

## 贡献

欢迎提交 Issue 和 Pull Request。建议 PR 包含：

- **改动说明** — 做了什么与为什么
- **截图** — 涉及 UI 的改动
- **验证步骤** — 如何测试

---

## 许可证

本项目仅供学习、课程作业、技术交流和个人研究参考使用。
具体限制与免责声明请查看仓库根目录的 [`LICENSE`](LICENSE) 文件。
