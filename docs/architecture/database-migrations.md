# 数据库迁移机制

## 目标

数据库结构变更必须可追踪、可重复执行、可跨运行时对齐。Electron 与 Tauri 都必须维护同一套迁移版本语义，避免一个运行时升级结构后另一个运行时无法读取。

## 当前版本

| 版本 | 名称 | 含义 |
| --- | --- | --- |
| `1` | `001_initial_schema` | 当前已存在业务表结构的基线版本。 |

## 元数据表

两套运行时都必须创建并维护 `schema_migrations`：

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

初始化数据库时必须写入当前基线版本，并保持幂等：

```sql
INSERT OR IGNORE INTO schema_migrations (version, name)
VALUES (1, '001_initial_schema');
```

## 执行模型

Electron 与 Tauri 都使用显式迁移列表：

- 迁移项必须包含 `version`、`name` 和实际结构变更逻辑。
- 初始化数据库时先创建 `schema_migrations`，再只执行未记录的迁移。
- 迁移逻辑成功后才写入版本记录。
- 当前 `001_initial_schema` 是基线迁移，业务表创建仍保留在既有初始化流程中。

## 约束

- 每次数据库结构变更都必须分配单调递增的 `version`。
- 迁移必须允许重复执行，不能重复插入版本记录。
- Electron 与 Tauri 必须使用同一版本号和迁移名称。
- 修改业务表结构时必须同步补充 Electron/sql.js 测试和 Tauri/rusqlite 测试。
- 迁移完成前不得把新结构假定为已存在。

## 新增迁移步骤

1. 在 Electron 迁移列表中新增下一版本迁移项。
2. 在 Tauri 迁移列表中新增同版本、同名称的迁移项。
3. 迁移 SQL 必须只依赖已存在的旧结构，并能在重复启动时保持幂等。
4. 新增 Electron/sql.js 测试，覆盖未迁移库执行后写入版本记录。
5. 新增 Tauri/rusqlite 测试，覆盖旧文件库升级和重复打开。
6. 更新本文档的当前版本表。

## 回滚策略

当前桌面端不提供自动降级迁移。结构变更一旦进入迁移列表，应按以下规则处理：

- 发布前验证失败：撤回代码变更和迁移项，不写入新版本记录。
- 发布后发现问题：新增更高版本的修复迁移，不修改已发布迁移。
- 涉及数据破坏风险的迁移必须先设计备份或导出方案，再进入发布闸门。

## 当前测试覆盖

- Electron：`npm run test:db-migrations`
- Tauri：`cargo test --test database_store database_store_records_current_schema_migration_once`
- Tauri 旧库升级：`cargo test --test database_store database_store_upgrades_file_without_schema_migration_metadata`
