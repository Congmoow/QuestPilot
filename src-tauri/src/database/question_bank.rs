use rusqlite::params;

use super::{
    queries::{add_operation_log, get_bank_by_id},
    types::{CreateQuestionBankInput, QuestionBank},
    validation::{normalize_description, validate_bank_name},
    DatabaseStore,
};

impl DatabaseStore {
    pub fn create_bank(&self, data: CreateQuestionBankInput) -> Result<QuestionBank, String> {
        let connection = self.connection.borrow();
        let name = validate_bank_name(&data.name)?;
        let description = normalize_description(data.description);

        connection
            .execute(
                "
                INSERT INTO question_banks (name, description, created_at, updated_at)
                VALUES (?1, ?2, datetime('now'), datetime('now'))
                ",
                params![name.as_str(), description.as_deref()],
            )
            .map_err(|error| format!("创建题库失败: {error}"))?;

        let id = connection.last_insert_rowid();
        add_operation_log(&connection, "创建题库", format!("创建题库: {name}"))?;

        get_bank_by_id(&connection, id)?.ok_or_else(|| "创建题库后读取失败".to_string())
    }

    pub fn get_all_banks(&self) -> Result<Vec<QuestionBank>, String> {
        use super::queries::map_question_bank;
        let connection = self.connection.borrow();
        let mut statement = connection
            .prepare(
                "
                SELECT qb.id, qb.name, qb.description, qb.created_at, qb.updated_at, COUNT(q.id) AS question_count
                FROM question_banks qb
                LEFT JOIN questions q ON qb.id = q.bank_id
                GROUP BY qb.id
                ORDER BY qb.updated_at DESC
                ",
            )
            .map_err(|error| format!("准备题库查询失败: {error}"))?;

        let rows = statement
            .query_map([], map_question_bank)
            .map_err(|error| format!("查询题库失败: {error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("读取题库结果失败: {error}"))
    }

    pub fn get_bank_by_id(&self, id: i64) -> Result<Option<QuestionBank>, String> {
        let connection = self.connection.borrow();
        get_bank_by_id(&connection, id)
    }

    pub fn update_bank(
        &self,
        id: i64,
        data: CreateQuestionBankInput,
    ) -> Result<Option<QuestionBank>, String> {
        let connection = self.connection.borrow();
        let name = validate_bank_name(&data.name)?;
        let description = normalize_description(data.description);

        connection
            .execute(
                "
                UPDATE question_banks
                SET name = ?1, description = ?2, updated_at = datetime('now')
                WHERE id = ?3
                ",
                params![name.as_str(), description.as_deref(), id],
            )
            .map_err(|error| format!("更新题库失败: {error}"))?;

        add_operation_log(&connection, "更新题库", format!("更新题库: {name}"))?;
        get_bank_by_id(&connection, id)
    }

    pub fn delete_bank(&self, id: i64) -> Result<(), String> {
        let mut connection = self.connection.borrow_mut();
        let tx = connection
            .transaction()
            .map_err(|error| format!("开启删除题库事务失败: {error}"))?;

        tx.execute("DELETE FROM questions WHERE bank_id = ?1", params![id])
            .map_err(|error| format!("删除题库题目失败: {error}"))?;
        tx.execute("DELETE FROM question_banks WHERE id = ?1", params![id])
            .map_err(|error| format!("删除题库失败: {error}"))?;
        tx.commit()
            .map_err(|error| format!("提交删除题库事务失败: {error}"))?;

        add_operation_log(&connection, "删除题库", format!("删除题库 ID: {id}"))?;
        Ok(())
    }
}
