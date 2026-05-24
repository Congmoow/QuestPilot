# Tauri + Rust 5D 迁移决策报告

## 目标

阶段 5D 的目标是基于 5A 能力映射、5B 最小壳 PoC、5C SQLite PoC 的结果，判断 QuestPilot 是否值得进入正式 Tauri + Rust 迁移。

本阶段不继续扩张 Rust command，不删除 Electron，不改变当前稳定发布链路。结论只服务于后续路线选择。

## 当前证据

### 运行环境

- Rust 工具链已迁到 D 盘：
  - `CARGO_HOME=D:\Rust\.cargo`
  - `RUSTUP_HOME=D:\Rust\.rustup`
- `npm run tauri:info` 已能识别：
  - `rustc 1.95.0`
  - `cargo 1.95.0`
  - `rustup 1.29.0`
  - WebView2
  - Visual Studio 2022 MSVC
- Tauri 版本：`2.11.2`。
- 前端仍是 React 18 + Vite 5。

### 体积对比

| 项目 | 当前体积 | 说明 |
| --- | ---: | --- |
| Electron `release/win-unpacked` | 约 271.71 MB | 当前稳定线解包目录 |
| Electron `QuestPilot.exe` | 约 180.07 MB | Electron 运行时占主要体积 |
| Electron `app.asar` | 约 3.11 MB | 阶段 1-3 优化后已很小 |
| Tauri `questpilot-tauri.exe` | 约 12.05 MB | PoC 生产 exe |
| Tauri NSIS 安装包 | 约 4.19 MB | PoC 安装包 |

体积结论：继续压缩 Electron 业务资源的收益已经有限；如果目标是显著缩小桌面包体，Tauri + Rust 是比继续压 Electron 更有效的方向。

### 已验证能力

- Tauri 可以加载现有 Vite 产物。
- 自定义标题栏窗口控制已通过适配层接入 Tauri command。
- 前端业务 API 仍通过 `src/api/index.js` 调用，页面没有大面积直接依赖 Tauri API。
- Rust SQLite PoC 已覆盖：
  - 题库创建
  - 题库列表
  - 批量题目写入
  - 随机抽题
  - 主题读取与保存
  - CSV 文件选择
  - CSV 文件基本解析
- Tauri 生产 exe 可短时启动并保持运行。
- Electron `npm run electron:pack` 仍可通过，稳定线没有被切断。

## 未覆盖能力

当前 PoC 还不足以直接替换 Electron，缺口主要在这些地方：

| 模块 | 缺口 | 风险 |
| --- | --- | --- |
| 题库 | 更新、删除、按 ID 读取 | 中 |
| 题目 | 分页、搜索、更新、删除、按 ID 读取 | 中高 |
| CSV | 模板下载、完整导入、导出 | 中 |
| 统计 | 仪表盘、操作日志、题型分布 | 中 |
| 草稿 | 保存、读取、清除 | 低中 |
| AI | AI 配置、连接测试、解析、聊天 | 高 |
| 聊天历史 | 保存、更新、读取、删除 | 中 |
| Prompt | CRUD | 中 |
| 练习记录 | 保存、查询、聚合统计 | 中 |
| 错题本 | 统计、列表、随机练习、同步、清理 | 中高 |
| 数据迁移 | 旧 Electron 用户数据目录到 Tauri app data 目录 | 高 |

## 决策结论

建议进入 **受控正式迁移准备阶段**，但不建议立刻切换默认发布线。

理由：

- 包体收益非常明确：Tauri PoC 安装包约 4.19 MB，远小于当前 Electron 解包目录约 271.71 MB。
- 前端适配成本可控：已有 `src/api/index.js` 作为统一门面，页面无需全量改写。
- Rust SQLite 路径可行：5C 已证明核心题库、题目批量写入和随机抽题能在 Rust 侧跑通。
- Electron 仍然可构建：当前稳定发布线可以作为回退路线。
- 最大风险不在 Tauri 壳，而在完整 IPC 迁移、AI 模块迁移和旧数据迁移。

因此后续不应再做“能跑更多 PoC”的零散扩张，而应切到一条明确的双轨迁移路线：

- Electron 继续作为稳定发布线。
- Tauri 作为迁移线，逐组替换 IPC。
- 每完成一组 API，就做 Electron/Tauri 行为对齐验证。

## 正式迁移进入条件

进入正式迁移前，需要满足以下条件：

1. 保留 Electron 构建脚本和 Electron 运行时代码，直到 Tauri 覆盖全部核心工作流。
2. 建立 API 对照表：每个 Electron IPC 对应一个 Tauri command 或明确保留策略。
3. 建立旧数据迁移方案，至少覆盖：
   - 旧 `questpilot.db` 定位
   - Tauri app data 目录定位
   - 首次启动迁移
   - 迁移失败回滚
4. 为核心命令增加 Rust 侧测试或命令级夹具。
5. UI smoke 至少覆盖：
   - 题库创建
   - 手动录入
   - AI/JSON 批量导入
   - 随机练题
   - 错题本同步
   - 设置保存
   - CSV 导入导出

## 建议迁移顺序

### 阶段 6A：数据库与迁移底座

- 抽出 Rust 数据库模块，避免 `src-tauri/src/lib.rs` 继续膨胀。
- 实现旧数据库迁移策略。
- 给题库、题目、settings 的 Rust 命令补测试。

### 阶段 6B：题库与题目完整 CRUD

- 补齐题库更新、删除、按 ID 查询。
- 补齐题目分页、搜索、更新、删除、按 ID 查询。
- 保持返回字段与 Electron API 一致。

### 阶段 6C：CSV 与统计

- 迁移 CSV 模板、导入、导出。
- 迁移仪表盘统计、操作日志、题型分布。
- 确认大题库下批量导入性能。

### 阶段 6D：练习与错题本

- 迁移练习记录。
- 迁移错题统计、错题列表、随机错题、错题同步和清理。
- 做练习结果与错题本状态的端到端 smoke。

### 阶段 6E：Prompt、聊天历史与 AI

- 先迁移 Prompt 和聊天历史存储。
- 再评估 AI 请求放在 Rust 侧还是继续前端发起。
- AI 解析迁移时必须保留当前 Markdown 分块、错误合并、JSON 归一化语义。

## 不建议做的事

- 不建议现在删除 Electron。
- 不建议把 Tauri 直接设为默认发布线。
- 不建议一次性迁移全部 56 个 IPC。
- 不建议先迁 AI 模块；AI 依赖最多、回归成本最高，应放后面。
- 不建议同时维护 `sql.js`、`rusqlite`、额外第三套数据库实现。

## 当前推荐出口

5D 的出口建议是：

1. 保留 `codex/tauri-rust-poc` 作为迁移预研分支。
2. 下一阶段新建正式迁移分支，例如 `codex/tauri-rust-migration`。
3. 先做阶段 6A，不继续扩大 PoC。
4. 在阶段 6A 完成前，Electron 仍是唯一稳定发布线。

最终判断：**值得继续推进 Tauri + Rust，但必须以双轨迁移方式推进；当前还不具备替换 Electron 稳定线的条件。**
