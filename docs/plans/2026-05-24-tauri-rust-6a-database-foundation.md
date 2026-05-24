# Tauri + Rust 6A 数据库底座实施记录

## 目标

阶段 6A 的目标是把 Tauri PoC 中散落在 `src-tauri/src/lib.rs` 的数据库逻辑拆成可测试的 Rust 数据库模块，并为旧库迁移建立最小可验证策略。

本阶段不迁移新的前端页面，不删除 Electron 稳定线，也不把 Tauri 设置为默认发布链路。

## 已完成内容

- 新增 `src-tauri/src/database.rs`，集中承载：
  - 数据库打开与初始化
  - 旧数据库候选路径迁移
  - 题库创建与列表
  - 批量题目写入
  - 随机抽题
  - 主题设置读写
  - 题目校验与答案数量校验
- 精简 `src-tauri/src/lib.rs`，让 Tauri command 只负责：
  - 接收前端调用
  - 定位 app data 数据库路径
  - 打开 `DatabaseStore`
  - 调用数据库模块方法
- 新增 `src-tauri/tests/database_store.rs`，覆盖：
  - 核心数据表初始化
  - 题库创建、批量导入、随机抽题
  - 主题设置持久化
  - 目标库缺失时从旧库候选路径复制迁移
- 新增 `tempfile` 作为 Rust 测试依赖，用于隔离测试数据库文件。

## 当前旧库迁移策略

当前只实现最小安全策略：

1. 如果目标 `questpilot.db` 已存在，不迁移。
2. 如果目标库不存在，按候选路径查找旧库。
3. 找到第一个存在的旧库后，复制到目标路径。
4. 打开目标库并执行 `CREATE TABLE IF NOT EXISTS` 补齐缺失表和索引。

旧库候选路径包括：

- 当前 Tauri app data 目录下的 `question-bank.db`
- app data 父目录下的 `question-bank-assistant/question-bank.db`
- app data 父目录下的 `题库助手/question-bank.db`

## 未完成内容

- 尚未实现 Electron 用户数据目录到 Tauri app data 目录的跨应用精确定位。
- 尚未实现迁移备份文件、迁移日志和失败回滚。
- 尚未补齐题库与题目的完整 CRUD。
- 尚未建立 Electron/Tauri API 行为对齐测试。

## 下一步建议

阶段 6B 可以开始补齐题库和题目的完整 CRUD：

1. 题库更新、删除、按 ID 读取。
2. 题目分页、搜索、更新、删除、按 ID 读取。
3. 对齐 `src/api/index.js` 当前返回字段。
4. 为每个新增 Rust 数据库方法先补测试，再实现。
