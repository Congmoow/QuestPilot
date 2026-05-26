use rusqlite::{params, OptionalExtension};

use super::{
    queries::{
        add_operation_log, cleanup_wrong_book_orphans, count_wrong_book_items,
        query_random_wrong_questions, query_wrong_book_items,
    },
    types::{Question, WrongBookCount, WrongBookItem, WrongBookPracticeResult},
    DatabaseStore,
};

impl DatabaseStore {
    pub fn get_wrong_book_counts_by_bank(&self) -> Result<Vec<WrongBookCount>, String> {
        let connection = self.connection.borrow();
        cleanup_wrong_book_orphans(&connection)?;
        let mut statement = connection
            .prepare(
                "
                SELECT bank_id, COUNT(*) AS count
                FROM wrong_book
                GROUP BY bank_id
                ",
            )
            .map_err(|error| format!("准备错题统计查询失败: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok(WrongBookCount {
                    bank_id: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|error| format!("查询错题统计失败: {error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取错题统计失败: {error}"))
    }

    pub fn count_wrong_book_items(&self, bank_id: Option<i64>) -> Result<i64, String> {
        let connection = self.connection.borrow();
        cleanup_wrong_book_orphans(&connection)?;
        count_wrong_book_items(&connection, bank_id)
    }

    pub fn get_wrong_book_items(
        &self,
        bank_id: Option<i64>,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<WrongBookItem>, String> {
        let connection = self.connection.borrow();
        cleanup_wrong_book_orphans(&connection)?;
        query_wrong_book_items(&connection, bank_id, offset, limit)
    }

    pub fn get_random_wrong_questions(
        &self,
        bank_id: Option<i64>,
        limit: Option<u32>,
    ) -> Result<Vec<Question>, String> {
        let connection = self.connection.borrow();
        cleanup_wrong_book_orphans(&connection)?;
        query_random_wrong_questions(&connection, bank_id, limit)
    }

    /// 清理孤儿错题记录（题目已被删除但 wrong_book 仍保留的行）。纯数据库写入。
    pub fn cleanup_orphans(&self) -> Result<(), String> {
        let connection = self.connection.borrow();
        cleanup_wrong_book_orphans(&connection)
    }

    /// 写入或累加一条答错记录。纯数据库写入。
    ///
    /// - 新题目 → INSERT (wrong_count = 1, correct_count = 0)
    /// - 已存在 → wrong_count + 1，更新 last_wrong_at
    pub fn upsert_wrong_answer(&self, question_id: i64, bank_id: i64) -> Result<(), String> {
        let connection = self.connection.borrow();
        connection
            .execute(
                "
                INSERT INTO wrong_book (question_id, bank_id, wrong_count, correct_count, added_at, last_wrong_at)
                VALUES (?1, ?2, 1, 0, datetime('now'), datetime('now'))
                ON CONFLICT(question_id) DO UPDATE SET
                  bank_id = excluded.bank_id,
                  wrong_count = wrong_count + 1,
                  last_wrong_at = datetime('now')
                ",
                params![question_id, bank_id],
            )
            .map_err(|error| format!("写入错题本失败: {error}"))?;
        Ok(())
    }

    /// 将指定题目的 correct_count 加一。纯数据库写入。
    pub fn increment_correct_count(&self, question_id: i64) -> Result<(), String> {
        let connection = self.connection.borrow();
        connection
            .execute(
                "UPDATE wrong_book SET correct_count = correct_count + 1 WHERE question_id = ?1",
                params![question_id],
            )
            .map_err(|error| format!("更新错题正确次数失败: {error}"))?;
        Ok(())
    }

    /// 查询指定题目的 correct_count。纯数据库查询。
    ///
    /// 若该题不在错题本中（从未出错或已被移除），返回 `None`。
    pub fn get_correct_count(&self, question_id: i64) -> Result<Option<i64>, String> {
        let connection = self.connection.borrow();
        connection
            .query_row(
                "SELECT correct_count FROM wrong_book WHERE question_id = ?1",
                params![question_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|error| format!("读取错题正确次数失败: {error}"))
    }

    /// 原有组合方法，保留以降低兼容风险。
    ///
    /// **已被 `WrongBookService::update_from_practice` 接管**，该方法包含了 threshold 判断
    /// 与完整的业务循环。此处作为历史兼容入口，不再由 command 主路径调用。
    pub fn update_wrong_book_from_practice(
        &self,
        results: Vec<WrongBookPracticeResult>,
        threshold: Option<i64>,
    ) -> Result<(), String> {
        let remove_threshold = threshold
            .filter(|value| *value > 0)
            .or(self.get_wrong_book_threshold().ok())
            .unwrap_or(3);
        let connection = self.connection.borrow();
        cleanup_wrong_book_orphans(&connection)?;

        for result in results {
            if result.question_id <= 0 || result.bank_id <= 0 {
                continue;
            }

            if result.is_correct {
                connection
                    .execute(
                        "
                        UPDATE wrong_book
                        SET correct_count = correct_count + 1
                        WHERE question_id = ?1
                        ",
                        params![result.question_id],
                    )
                    .map_err(|error| format!("更新错题正确次数失败: {error}"))?;

                let correct_count = connection
                    .query_row(
                        "SELECT correct_count FROM wrong_book WHERE question_id = ?1",
                        params![result.question_id],
                        |row| row.get::<_, i64>(0),
                    )
                    .optional()
                    .map_err(|error| format!("读取错题正确次数失败: {error}"))?;

                if matches!(correct_count, Some(value) if value >= remove_threshold) {
                    connection
                        .execute(
                            "DELETE FROM wrong_book WHERE question_id = ?1",
                            params![result.question_id],
                        )
                        .map_err(|error| format!("移除已掌握错题失败: {error}"))?;
                }
                continue;
            }

            connection
                .execute(
                    "
                    INSERT INTO wrong_book (question_id, bank_id, wrong_count, correct_count, added_at, last_wrong_at)
                    VALUES (?1, ?2, 1, 0, datetime('now'), datetime('now'))
                    ON CONFLICT(question_id) DO UPDATE SET
                      bank_id = excluded.bank_id,
                      wrong_count = wrong_count + 1,
                      last_wrong_at = datetime('now')
                    ",
                    params![result.question_id, result.bank_id],
                )
                .map_err(|error| format!("写入错题本失败: {error}"))?;
        }

        Ok(())
    }

    pub fn remove_wrong_book_item(&self, question_id: i64) -> Result<(), String> {
        let connection = self.connection.borrow();
        connection
            .execute(
                "DELETE FROM wrong_book WHERE question_id = ?1",
                params![question_id],
            )
            .map_err(|error| format!("移除错题失败: {error}"))?;
        Ok(())
    }

    pub fn clear_wrong_book(&self, bank_id: Option<i64>) -> Result<(), String> {
        let connection = self.connection.borrow();
        if let Some(bank_id) = bank_id.filter(|value| *value > 0) {
            connection
                .execute(
                    "DELETE FROM wrong_book WHERE bank_id = ?1",
                    params![bank_id],
                )
                .map_err(|error| format!("清空题库错题失败: {error}"))?;
            add_operation_log(
                &connection,
                "清空错题本",
                format!("清空题库 {bank_id} 的错题"),
            )?;
        } else {
            connection
                .execute("DELETE FROM wrong_book", [])
                .map_err(|error| format!("清空错题本失败: {error}"))?;
            add_operation_log(&connection, "清空错题本", "清空全部错题")?;
        }
        Ok(())
    }
}
