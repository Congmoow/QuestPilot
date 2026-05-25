use rusqlite::params;

use super::{
    queries::{
        add_operation_log, bank_exists, count_questions, find_question_by_id, map_question,
        query_questions, select_question_bank_ids,
    },
    types::{CreateQuestionInput, ImportError, ImportResult, Question},
    validation::{options_to_json, validate_question},
    DatabaseStore,
};

impl DatabaseStore {
    pub fn create_question(
        &self,
        bank_id: i64,
        question: CreateQuestionInput,
    ) -> Result<Question, String> {
        if bank_id <= 0 {
            return Err("题库不存在".to_string());
        }

        validate_question(&question)?;

        let connection = self.connection.borrow();
        if !bank_exists(&connection, bank_id)? {
            return Err("题库不存在".to_string());
        }

        connection
            .execute(
                "
                INSERT INTO questions (bank_id, type, content, options, answer, analysis, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))
                ",
                params![
                    bank_id,
                    question.r#type.as_str(),
                    question.content.as_str(),
                    options_to_json(&question.options)?,
                    question.answer.as_str(),
                    question.analysis.as_deref(),
                ],
            )
            .map_err(|error| format!("创建题目失败: {error}"))?;

        let id = connection.last_insert_rowid();
        connection
            .execute(
                "UPDATE question_banks SET updated_at = datetime('now') WHERE id = ?1",
                params![bank_id],
            )
            .map_err(|error| format!("更新题库时间失败: {error}"))?;
        add_operation_log(&connection, "添加题目", "添加题目到题库")?;

        find_question_by_id(&connection, id)?.ok_or_else(|| "创建题目后读取失败".to_string())
    }

    pub fn create_questions_batch(
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

        let mut connection = self.connection.borrow_mut();
        if !bank_exists(&connection, bank_id)? {
            return Err("题库不存在".to_string());
        }

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

        let tx = connection
            .transaction()
            .map_err(|error| format!("开启批量导入事务失败: {error}"))?;

        {
            let mut statement = tx
                .prepare(
                    "
                    INSERT INTO questions (bank_id, type, content, options, answer, analysis, created_at, updated_at)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))
                    ",
                )
                .map_err(|error| format!("准备题目写入失败: {error}"))?;

            for question in &valid_questions {
                statement
                    .execute(params![
                        bank_id,
                        question.r#type.as_str(),
                        question.content.as_str(),
                        options_to_json(&question.options)?,
                        question.answer.as_str(),
                        question.analysis.as_deref(),
                    ])
                    .map_err(|error| format!("写入题目失败: {error}"))?;
            }
        }

        tx.execute(
            "UPDATE question_banks SET updated_at = datetime('now') WHERE id = ?1",
            params![bank_id],
        )
        .map_err(|error| format!("更新题库时间失败: {error}"))?;
        tx.commit()
            .map_err(|error| format!("提交批量导入事务失败: {error}"))?;

        add_operation_log(
            &connection,
            "批量添加题目",
            format!("添加 {} 道题目到题库", valid_questions.len()),
        )?;

        Ok(ImportResult {
            success: valid_questions.len(),
            failed: errors.len(),
            errors,
        })
    }

    pub fn get_random_questions(
        &self,
        bank_id: i64,
        limit: Option<u32>,
        question_type: Option<String>,
    ) -> Result<Vec<Question>, String> {
        if bank_id <= 0 {
            return Ok(Vec::new());
        }

        let safe_limit = i64::from(limit.unwrap_or(20).clamp(1, 1000));
        let connection = self.connection.borrow();
        let mut questions = Vec::new();

        if let Some(question_type) = question_type.filter(|value| !value.trim().is_empty()) {
            let mut statement = connection
                .prepare(
                    "
                    SELECT id, bank_id, type, content, options, answer, analysis, created_at, updated_at
                    FROM questions
                    WHERE bank_id = ?1 AND type = ?2
                    ORDER BY RANDOM()
                    LIMIT ?3
                    ",
                )
                .map_err(|error| format!("准备随机抽题查询失败: {error}"))?;

            let rows = statement
                .query_map(params![bank_id, question_type, safe_limit], map_question)
                .map_err(|error| format!("随机抽题失败: {error}"))?;

            for row in rows {
                questions.push(row.map_err(|error| format!("读取随机题目失败: {error}"))?);
            }
        } else {
            let mut statement = connection
                .prepare(
                    "
                    SELECT id, bank_id, type, content, options, answer, analysis, created_at, updated_at
                    FROM questions
                    WHERE bank_id = ?1
                    ORDER BY RANDOM()
                    LIMIT ?2
                    ",
                )
                .map_err(|error| format!("准备随机抽题查询失败: {error}"))?;

            let rows = statement
                .query_map(params![bank_id, safe_limit], map_question)
                .map_err(|error| format!("随机抽题失败: {error}"))?;

            for row in rows {
                questions.push(row.map_err(|error| format!("读取随机题目失败: {error}"))?);
            }
        }

        Ok(questions)
    }

    pub fn get_questions_by_bank_id(
        &self,
        bank_id: i64,
        offset: u32,
        limit: u32,
        question_type: Option<String>,
    ) -> Result<Vec<Question>, String> {
        let connection = self.connection.borrow();
        query_questions(&connection, bank_id, "", question_type.as_deref(), offset, limit)
    }

    pub fn get_question_by_id(&self, id: i64) -> Result<Option<Question>, String> {
        let connection = self.connection.borrow();
        find_question_by_id(&connection, id)
    }

    pub fn update_question(
        &self,
        id: i64,
        question: CreateQuestionInput,
    ) -> Result<Option<Question>, String> {
        validate_question(&question)?;

        let connection = self.connection.borrow();
        let existing = find_question_by_id(&connection, id)?;
        if existing.is_none() {
            return Ok(None);
        }

        connection
            .execute(
                "
                UPDATE questions
                SET type = ?1, content = ?2, options = ?3, answer = ?4, analysis = ?5, updated_at = datetime('now')
                WHERE id = ?6
                ",
                params![
                    question.r#type.as_str(),
                    question.content.as_str(),
                    options_to_json(&question.options)?,
                    question.answer.as_str(),
                    question.analysis.as_deref(),
                    id,
                ],
            )
            .map_err(|error| format!("更新题目失败: {error}"))?;

        if let Some(existing) = existing {
            connection
                .execute(
                    "UPDATE question_banks SET updated_at = datetime('now') WHERE id = ?1",
                    params![existing.bank_id],
                )
                .map_err(|error| format!("更新题库时间失败: {error}"))?;
        }
        add_operation_log(&connection, "更新题目", "更新题目")?;

        find_question_by_id(&connection, id)
    }

    pub fn delete_questions(&self, ids: &[i64]) -> Result<(), String> {
        if ids.is_empty() {
            return Ok(());
        }

        let mut connection = self.connection.borrow_mut();
        let tx = connection
            .transaction()
            .map_err(|error| format!("开启删除题目事务失败: {error}"))?;

        let bank_ids = select_question_bank_ids(&tx, ids)?;
        for id in ids {
            tx.execute("DELETE FROM questions WHERE id = ?1", params![id])
                .map_err(|error| format!("删除题目失败: {error}"))?;
        }

        for bank_id in bank_ids {
            tx.execute(
                "UPDATE question_banks SET updated_at = datetime('now') WHERE id = ?1",
                params![bank_id],
            )
            .map_err(|error| format!("更新题库时间失败: {error}"))?;
        }

        tx.commit()
            .map_err(|error| format!("提交删除题目事务失败: {error}"))?;
        add_operation_log(
            &connection,
            "删除题目",
            format!("删除 {} 道题目", ids.len()),
        )?;
        Ok(())
    }

    pub fn search_questions(
        &self,
        bank_id: i64,
        keyword: String,
        question_type: Option<String>,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<Question>, String> {
        let connection = self.connection.borrow();
        query_questions(
            &connection,
            bank_id,
            keyword.as_str(),
            question_type.as_deref(),
            offset,
            limit,
        )
    }

    pub fn count_questions(
        &self,
        bank_id: i64,
        keyword: String,
        question_type: Option<String>,
    ) -> Result<i64, String> {
        let connection = self.connection.borrow();
        count_questions(&connection, bank_id, keyword.as_str(), question_type.as_deref())
    }
}
