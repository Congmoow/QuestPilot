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

## 约束

- 每次数据库结构变更都必须分配单调递增的 `version`。
- 迁移必须允许重复执行，不能重复插入版本记录。
- Electron 与 Tauri 必须使用同一版本号和迁移名称。
- 修改业务表结构时必须同步补充 Electron/sql.js 测试和 Tauri/rusqlite 测试。
- 迁移完成前不得把新结构假定为已存在。

## 当前测试覆盖

- Electron：`npm run test:db-migrations`
- Tauri：`cargo test --test database_store database_store_records_current_schema_migration_once`
