use serde::Serialize;
use thiserror::Error;

/// 统一应用错误类型。
/// 实现 `Serialize` 以便 Tauri 序列化到前端；前端收到的 JSON 格式为
/// `{ "kind": "Database", "message": "..." }`。
#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    /// 数据库操作错误（SQLite 查询、约束、迁移等）
    #[error("数据库错误: {0}")]
    Database(String),

    /// AI 调用错误（网络、鉴权、解析等）
    #[error("AI 错误: {0}")]
    Ai(String),

    /// 基础设施错误（路径、文件系统、配置读取等）
    #[error("配置错误: {0}")]
    Config(String),
}

/// 将来自 `Result<T, String>` 的 `?` 运算符自动转换为 `AppError::Database`。
/// 大多数数据库操作返回 `String` 错误，无需逐一手写 `map_err`。
impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Database(s)
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::Database(s.to_string())
    }
}
