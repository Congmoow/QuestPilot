use crate::database::DatabaseStore;

/// 设置数据访问对象骨架（Phase 1：暂缓全量迁移）。
///
/// `ai_cmd` 的 async command 读取 `ApiConfig` 时需在 `.await` 前 drop `DatabaseStore`，
/// 迁移到 `SettingsRepository` 后此约束不变，且会引入额外的间接层，
/// 本阶段暂缓迁移，只建立骨架供后续渐进引入。
///
/// `WrongBookRepository::get_threshold()` 已内部调用了 `get_wrong_book_threshold()`，
/// 不依赖此 Repository，无需在 Phase 1 启用。
///
/// ## 演进路径
/// Phase 1：空骨架。
/// Phase next：补齐 `get_api_config`、`get_wrong_book_threshold`、`set_theme` 等方法，
///   并将对应 service/command 的依赖切换到此 Repository。
pub struct SettingsRepository {
    #[allow(dead_code)]
    store: DatabaseStore,
}

impl SettingsRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    // TODO (Phase next): 迁移 settings 相关直接 store 调用：
    // - get_api_config()           → store.get_api_config()
    // - get_wrong_book_threshold() → store.get_wrong_book_threshold()
    // - set_theme() / get_theme()  → store.set_theme() / get_theme()
    // 注意：ai_cmd 等 async command 需保持 store 在 .await 前 drop 的模式
}
