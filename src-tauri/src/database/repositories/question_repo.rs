use std::collections::HashMap;

use rusqlite::params;

use crate::database::{
    CreateQuestionInput, DatabaseStore, DedupResult, DuplicateGroup, ImportError, ImportResult,
    Question,
};

use super::super::validation::{options_to_json, validate_question};
use super::helpers::{
    add_operation_log, bank_exists, count_questions, find_question_by_id, map_question,
    query_questions, select_question_bank_ids,
};

/// 题目数据访问对象（Phase 2：通过 `DatabaseStore::with_connection` / `with_transaction`
/// 直接执行 SQL）。
///
/// 封装 `questions` 表的 CRUD + 分页 + 搜索 + 批量操作。
pub struct QuestionRepository {
    store: DatabaseStore,
}

impl QuestionRepository {
    pub fn new(store: DatabaseStore) -> Self {
        Self { store }
    }

    /// 创建单道题目：bank_exists 校验 → INSERT → 更新题库时间 → 写日志 → 返回完整题目。
    pub fn create(&self, bank_id: i64, question: CreateQuestionInput) -> Result<Question, String> {
        if bank_id <= 0 {
            return Err("题库不存在".to_string());
        }
        validate_question(&question)?;
        let options_json = options_to_json(&question.options)?;
        self.store.with_connection(|conn| {
            if !bank_exists(conn, bank_id)? {
                return Err("题库不存在".to_string());
            }
            conn.execute(
                "INSERT INTO questions \
                   (bank_id, type, content, options, answer, analysis, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))",
                params![
                    bank_id,
                    question.r#type.as_str(),
                    question.content.as_str(),
                    options_json,
                    question.answer.as_str(),
                    question.analysis.as_deref(),
                ],
            )
            .map_err(|e| format!("创建题目失败: {e}"))?;
            let id = conn.last_insert_rowid();
            conn.execute(
                "UPDATE question_banks SET updated_at = datetime('now') WHERE id = ?1",
                params![bank_id],
            )
            .map_err(|e| format!("更新题库时间失败: {e}"))?;
            add_operation_log(conn, "添加题目", "添加题目到题库")?;
            find_question_by_id(conn, id)?.ok_or_else(|| "创建题目后读取失败".to_string())
        })
    }

    /// 批量创建题目：逐题校验 → 事务 INSERT → 更新题库时间 → 事务提交 → 写日志。
    ///
    /// 校验失败的题目记录到 `errors`，其余继续写入。
    /// 若无合法题目，直接返回，不开启事务。
    pub fn create_batch(
        &self,
        bank_id: i64,
        questions: Vec<CreateQuestionInput>,
    ) -> Result<ImportResult, String> {
        if bank_id <= 0 {
            return Err("题库不存在".to_string());
        }
        if questions.is_empty() {
            return Err("没有可导入的题目".to_string());
        }

        // 1. bank_exists 检查（with_connection，借用释放后进入事务）
        let exists = self
            .store
            .with_connection(|conn| bank_exists(conn, bank_id))?;
        if !exists {
            return Err("题库不存在".to_string());
        }

        // 2. 逐题字段校验（纯 Rust，无 DB）
        let mut errors = Vec::new();
        let mut valid_questions = Vec::new();
        for (index, question) in questions.into_iter().enumerate() {
            match validate_question(&question) {
                Ok(()) => valid_questions.push(question),
                Err(message) => errors.push(ImportError { index, message }),
            }
        }
        if valid_questions.is_empty() {
            return Ok(ImportResult {
                success: 0,
                failed: errors.len(),
                errors,
            });
        }

        let success_count = valid_questions.len();

        // 3. 事务：批量 INSERT + UPDATE bank 时间
        self.store.with_transaction(|tx| {
            {
                let mut stmt = tx
                    .prepare(
                        "INSERT INTO questions \
                           (bank_id, type, content, options, answer, analysis, \
                            created_at, updated_at) \
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))",
                    )
                    .map_err(|e| format!("准备题目写入失败: {e}"))?;
                for q in &valid_questions {
                    stmt.execute(params![
                        bank_id,
                        q.r#type.as_str(),
                        q.content.as_str(),
                        options_to_json(&q.options)?,
                        q.answer.as_str(),
                        q.analysis.as_deref(),
                    ])
                    .map_err(|e| format!("写入题目失败: {e}"))?;
                }
            }
            tx.execute(
                "UPDATE question_banks SET updated_at = datetime('now') WHERE id = ?1",
                params![bank_id],
            )
            .map_err(|e| format!("更新题库时间失败: {e}"))?;
            Ok(())
        })?;

        // 4. 日志（事务提交后，重新 borrow）
        self.store.with_connection(|conn| {
            add_operation_log(
                conn,
                "批量添加题目",
                format!("添加 {} 道题目到题库", success_count),
            )
        })?;

        Ok(ImportResult {
            success: success_count,
            failed: errors.len(),
            errors,
        })
    }

    /// 分页查询某题库的题目列表（可选题型过滤，按创建时间倒序）。
    pub fn list_by_bank(
        &self,
        bank_id: i64,
        offset: u32,
        limit: u32,
        question_type: Option<String>,
    ) -> Result<Vec<Question>, String> {
        self.store.with_connection(|conn| {
            query_questions(conn, bank_id, "", question_type.as_deref(), offset, limit)
        })
    }

    /// 随机抽取题目（可选题型过滤，`limit` 默认 20）。
    pub fn get_random(
        &self,
        bank_id: i64,
        limit: Option<u32>,
        question_type: Option<String>,
    ) -> Result<Vec<Question>, String> {
        if bank_id <= 0 {
            return Ok(Vec::new());
        }
        let safe_limit = i64::from(limit.unwrap_or(20).clamp(1, 1000));
        self.store.with_connection(|conn| {
            if let Some(qt) = question_type.filter(|v| !v.trim().is_empty()) {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, bank_id, type, content, options, answer, analysis, \
                                created_at, updated_at \
                         FROM questions \
                         WHERE bank_id = ?1 AND type = ?2 \
                         ORDER BY RANDOM() LIMIT ?3",
                    )
                    .map_err(|e| format!("准备随机抽题查询失败: {e}"))?;
                let rows = stmt
                    .query_map(params![bank_id, qt, safe_limit], map_question)
                    .map_err(|e| format!("随机抽题失败: {e}"))?;
                rows.collect::<Result<Vec<_>, _>>()
                    .map_err(|e| format!("读取随机题目失败: {e}"))
            } else {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, bank_id, type, content, options, answer, analysis, \
                                created_at, updated_at \
                         FROM questions \
                         WHERE bank_id = ?1 \
                         ORDER BY RANDOM() LIMIT ?2",
                    )
                    .map_err(|e| format!("准备随机抽题查询失败: {e}"))?;
                let rows = stmt
                    .query_map(params![bank_id, safe_limit], map_question)
                    .map_err(|e| format!("随机抽题失败: {e}"))?;
                rows.collect::<Result<Vec<_>, _>>()
                    .map_err(|e| format!("读取随机题目失败: {e}"))
            }
        })
    }

    /// 按 ID 查询单道题目；不存在则返回 `None`。
    pub fn find_by_id(&self, id: i64) -> Result<Option<Question>, String> {
        self.store
            .with_connection(|conn| find_question_by_id(conn, id))
    }

    /// 更新题目内容：校验 → find_by_id → UPDATE → 更新题库时间 → 写日志 → 返回更新后题目。
    pub fn update(
        &self,
        id: i64,
        question: CreateQuestionInput,
    ) -> Result<Option<Question>, String> {
        validate_question(&question)?;
        let options_json = options_to_json(&question.options)?;
        self.store.with_connection(|conn| {
            let existing = find_question_by_id(conn, id)?;
            if existing.is_none() {
                return Ok(None);
            }
            conn.execute(
                "UPDATE questions \
                 SET type = ?1, content = ?2, options = ?3, answer = ?4, analysis = ?5, \
                     updated_at = datetime('now') \
                 WHERE id = ?6",
                params![
                    question.r#type.as_str(),
                    question.content.as_str(),
                    options_json,
                    question.answer.as_str(),
                    question.analysis.as_deref(),
                    id,
                ],
            )
            .map_err(|e| format!("更新题目失败: {e}"))?;
            if let Some(ex) = &existing {
                conn.execute(
                    "UPDATE question_banks SET updated_at = datetime('now') WHERE id = ?1",
                    params![ex.bank_id],
                )
                .map_err(|e| format!("更新题库时间失败: {e}"))?;
            }
            add_operation_log(conn, "更新题目", "更新题目")?;
            find_question_by_id(conn, id)
        })
    }

    /// 批量删除题目：事务内 DELETE + 更新题库时间 → 事务提交 → 写日志。
    pub fn delete_batch(&self, ids: &[i64]) -> Result<(), String> {
        if ids.is_empty() {
            return Ok(());
        }
        let id_count = ids.len();

        // 事务：SELECT bank ids → DELETE questions → UPDATE banks
        self.store.with_transaction(|tx| {
            let bank_ids = select_question_bank_ids(tx, ids)?;
            for id in ids {
                tx.execute("DELETE FROM questions WHERE id = ?1", params![id])
                    .map_err(|e| format!("删除题目失败: {e}"))?;
            }
            for bank_id in bank_ids {
                tx.execute(
                    "UPDATE question_banks SET updated_at = datetime('now') WHERE id = ?1",
                    params![bank_id],
                )
                .map_err(|e| format!("更新题库时间失败: {e}"))?;
            }
            Ok(())
        })?;

        // 日志（事务提交后）
        self.store.with_connection(|conn| {
            add_operation_log(conn, "删除题目", format!("删除 {} 道题目", id_count))
        })
    }

    /// 按关键词模糊搜索题目（分页，可选题型过滤）。
    pub fn search(
        &self,
        bank_id: i64,
        keyword: String,
        question_type: Option<String>,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<Question>, String> {
        self.store.with_connection(|conn| {
            query_questions(
                conn,
                bank_id,
                keyword.as_str(),
                question_type.as_deref(),
                offset,
                limit,
            )
        })
    }

    /// 统计符合条件的题目总数（关键词 + 可选题型）。
    pub fn count(
        &self,
        bank_id: i64,
        keyword: String,
        question_type: Option<String>,
    ) -> Result<i64, String> {
        self.store.with_connection(|conn| {
            count_questions(conn, bank_id, keyword.as_str(), question_type.as_deref())
        })
    }

    /// 查找题库中的重复题目，以 `(content + answer + options)` 归一化后分组。
    ///
    /// 每组按 `created_at ASC` 排序，首条为保留目标，其余为重复题目。
    pub fn find_duplicates(&self, bank_id: i64) -> Result<DedupResult, String> {
        self.store.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT id, content, answer, options \
                     FROM questions \
                     WHERE bank_id = ?1 \
                     ORDER BY created_at ASC, id ASC",
                )
                .map_err(|e| format!("准备查重查询失败: {e}"))?;

            let rows = stmt
                .query_map(params![bank_id], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                })
                .map_err(|e| format!("查重查询失败: {e}"))?;

            let mut groups: HashMap<String, Vec<(i64, String)>> = HashMap::new();
            for row in rows {
                let (id, content, answer, options) =
                    row.map_err(|e| format!("读取题目失败: {e}"))?;
                let key = dedup_normalize_key(&content, &answer, options.as_deref());
                groups.entry(key).or_default().push((id, content));
            }

            let mut dup_groups: Vec<DuplicateGroup> = groups
                .into_values()
                .filter(|items| items.len() > 1)
                .map(|items| {
                    let keep_id = items[0].0;
                    let sample_content = items[0].1.clone();
                    let duplicate_ids: Vec<i64> = items[1..].iter().map(|(id, _)| *id).collect();
                    let count = items.len() as i64;
                    DuplicateGroup {
                        keep_id,
                        duplicate_ids,
                        sample_content,
                        count,
                    }
                })
                .collect();

            dup_groups.sort_by(|a, b| b.count.cmp(&a.count));
            let total_duplicate_count: i64 = dup_groups
                .iter()
                .map(|g| g.duplicate_ids.len() as i64)
                .sum();

            Ok(DedupResult {
                groups: dup_groups,
                total_duplicate_count,
            })
        })
    }
}

/// 对 `content`、`answer`、`options` 归一化后拼接为唯一键。
///
/// 归一化规则：去首尾空白 → 折叠连续空白为单空格 → 转小写。
fn dedup_normalize_key(content: &str, answer: &str, options: Option<&str>) -> String {
    let nc = normalize_str(content);
    let na = normalize_str(answer);
    let no = options.map(normalize_str).unwrap_or_default();
    format!("{nc}\x00{na}\x00{no}")
}

fn normalize_str(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase()
}
