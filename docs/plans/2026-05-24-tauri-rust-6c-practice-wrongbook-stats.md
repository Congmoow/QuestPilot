# Tauri + Rust 6C 练习、错题本与统计实施记录

## 目标

阶段 6C 的目标是在 6B 题库与题目 CRUD 的基础上，迁移练习记录、错题本、仪表盘统计、操作日志和错题移除阈值设置的核心能力，让 Tauri 路线可以支撑随机练题、错题本和首页看板的主要数据链路。

本阶段继续保留 Electron 稳定线，不迁移 AI、Prompt、聊天历史、草稿和 API 配置。

## 已完成内容

- 新增练习记录表初始化：
  - `practice_records`
  - `idx_practice_bank_id`
- 扩展 `DatabaseStore`：
  - 保存练习记录
  - 获取指定题库练习记录
  - 获取全部题库练习统计
  - 获取仪表盘题目统计
  - 获取操作日志
  - 获取题型分布
  - 获取和设置错题移除阈值
  - 获取错题本题库计数
  - 分页获取错题本条目
  - 随机获取错题
  - 根据练习结果同步错题本
  - 移除单个错题
  - 清空指定题库或全部错题
- 新增 Tauri command：
  - `stats_get_dashboard`
  - `stats_get_operation_logs`
  - `stats_get_type_distribution`
  - `settings_get_wrong_book_threshold`
  - `settings_set_wrong_book_threshold`
  - `practice_save_record`
  - `practice_get_records`
  - `practice_get_all_stats`
  - `wrong_book_get_counts_by_bank`
  - `wrong_book_get_items`
  - `wrong_book_get_random_questions`
  - `wrong_book_update_from_practice`
  - `wrong_book_remove_item`
  - `wrong_book_clear`
- 扩展前端 `src/api/index.js`：
  - Tauri 运行时不再返回统计和练习占位数据
  - 练习、错题本、统计和错题阈值设置走 `invoke(...)`
  - Electron 运行时继续优先走 `window.electronAPI`

## 测试覆盖

新增 Rust 数据库测试覆盖：

- 练习记录保存与读取
- 练习统计聚合
- 仪表盘题目统计
- 题型分布
- 操作日志读取
- 错题阈值读写
- 错题本同步、分页、随机抽题、阈值移除、手动移除和清空

## 行为对齐

- 分页返回结构继续保持 `data / total / page / pageSize / totalPages`。
- 时间字段继续用 camelCase 暴露给前端。
- 错题本同步逻辑保持“答错加入或递增，连续答对达到阈值后移除”。
- 操作日志按 `created_at desc, id desc` 排序，避免同一秒内多条记录顺序不稳定。
- Tauri 命令返回 `{ success: true }` 的地方对齐 Electron IPC 的使用习惯。

## 未完成内容

- 尚未迁移 AI、Prompt、聊天历史、草稿、API 配置和 AI 连接测试。
- 尚未建立 Electron/Tauri 双运行时端到端 UI 自动化回归。
- 尚未将 Tauri 作为默认发布链路。

## 下一步建议

阶段 6D 建议迁移草稿、API 配置、Prompt 与聊天历史；AI 调用链建议最后单独处理，因为它涉及网络、模型配置、分块解析和错误展示。
