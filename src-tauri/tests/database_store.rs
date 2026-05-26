use questpilot_tauri_lib::database::{
    legacy_database_candidates, legacy_database_status, replace_target_with_legacy_candidate,
    ApiConfig, ChatHistoryInput, ChatHistoryRepository, CreatePromptInput,
    CreateQuestionBankInput, CreateQuestionInput, DatabaseStore, DraftRepository,
    PracticeRecordInput, PracticeRepository, PromptRepository, QuestionBankRepository,
    QuestionRepository, SettingsRepository, StatsRepository, WrongBookPracticeResult,
    WrongBookRepository,
};
use rusqlite::Connection;
use serde_json::json;
use std::path::Path;
use tempfile::tempdir;

/// 每次操作打开一个新 `DatabaseStore`（模拟生产环境 command 层的调用模式）。
fn open_store_at(path: &Path) -> DatabaseStore {
    DatabaseStore::open(path).expect("应能打开数据库")
}

fn read_schema_migrations(db_path: &Path) -> Vec<(i64, String)> {
    let connection = Connection::open(db_path).expect("应能打开迁移元数据数据库");
    let mut statement = connection
        .prepare("SELECT version, name FROM schema_migrations ORDER BY version")
        .expect("应能读取迁移元数据");

    statement
        .query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .expect("应能查询迁移元数据")
        .map(|row| row.expect("应能解析迁移元数据行"))
        .collect()
}

fn sample_single_question(content: &str, answer: &str) -> CreateQuestionInput {
    CreateQuestionInput {
        r#type: "single".to_string(),
        content: content.to_string(),
        options: Some(json!([
            { "id": "A", "text": "选项 A" },
            { "id": "B", "text": "选项 B" }
        ])),
        answer: answer.to_string(),
        analysis: Some("解析".to_string()),
    }
}

fn sample_boolean_question(content: &str) -> CreateQuestionInput {
    CreateQuestionInput {
        r#type: "boolean".to_string(),
        content: content.to_string(),
        options: None,
        answer: "正确".to_string(),
        analysis: None,
    }
}

#[test]
fn database_store_initializes_core_tables() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");

    let store = DatabaseStore::open(&db_path).expect("应能打开数据库");
    let table_count = store
        .table_count(&[
            "question_banks",
            "questions",
            "operation_logs",
            "settings",
            "drafts",
            "ai_prompts",
            "chat_history",
            "wrong_book",
            "practice_records",
            "schema_migrations",
        ])
        .expect("应能统计核心表");

    assert_eq!(table_count, 10);
}

#[test]
fn database_store_records_current_schema_migration_once() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");

    let store = DatabaseStore::open(&db_path).expect("应能打开数据库");
    drop(store);

    assert_eq!(
        read_schema_migrations(&db_path),
        vec![(1, "001_initial_schema".to_string())]
    );

    let reopened = DatabaseStore::open(&db_path).expect("应能重复打开数据库");
    drop(reopened);

    assert_eq!(
        read_schema_migrations(&db_path),
        vec![(1, "001_initial_schema".to_string())]
    );
}

#[test]
fn database_store_upgrades_file_without_schema_migration_metadata() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");

    {
        let connection = Connection::open(&db_path).expect("应能创建旧数据库文件");
        connection
            .execute_batch(
                "
                CREATE TABLE question_banks (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL,
                  description TEXT,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                ",
            )
            .expect("应能创建旧版题库表");
    }

    let upgraded = DatabaseStore::open(&db_path).expect("应能升级旧数据库文件");
    drop(upgraded);

    assert_eq!(
        read_schema_migrations(&db_path),
        vec![(1, "001_initial_schema".to_string())]
    );
}

#[test]
fn database_store_writes_bank_questions_and_random_queries() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");
    let bank = QuestionBankRepository::new(open_store_at(&db_path))
        .create(CreateQuestionBankInput {
            name: "  408  ".to_string(),
            description: Some("  数据结构  ".to_string()),
        })
        .expect("应能创建题库");

    assert_eq!(bank.name, "408");
    assert_eq!(bank.description.as_deref(), Some("数据结构"));
    assert_eq!(bank.question_count, 0);

    let import_result = QuestionRepository::new(open_store_at(&db_path))
        .create_batch(
            bank.id,
            vec![
                sample_single_question("第 1 题", "A"),
                CreateQuestionInput {
                    r#type: "boolean".to_string(),
                    content: "Rust 适合做本地核心层".to_string(),
                    options: None,
                    answer: "正确".to_string(),
                    analysis: None,
                },
                sample_single_question("无效答案题", "C"),
            ],
        )
        .expect("批量导入应返回结果");

    assert_eq!(import_result.success, 2);
    assert_eq!(import_result.failed, 1);
    assert_eq!(import_result.errors[0].index, 2);

    let banks = QuestionBankRepository::new(open_store_at(&db_path))
        .list_all()
        .expect("应能读取题库列表");
    assert_eq!(banks[0].question_count, 2);

    let random = QuestionRepository::new(open_store_at(&db_path))
        .get_random(bank.id, Some(10), None)
        .expect("应能随机抽题");
    assert_eq!(random.len(), 2);

    let singles = QuestionRepository::new(open_store_at(&db_path))
        .get_random(bank.id, Some(10), Some("single".to_string()))
        .expect("应能按题型随机抽题");
    assert_eq!(singles.len(), 1);
    assert_eq!(singles[0].r#type, "single");
}

#[test]
fn database_store_persists_theme_setting() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");

    assert_eq!(
        SettingsRepository::new(open_store_at(&db_path))
            .get_theme()
            .expect("应能读取默认主题"),
        "system"
    );

    SettingsRepository::new(open_store_at(&db_path))
        .set_theme("dark".to_string())
        .expect("应能保存主题设置");

    assert_eq!(
        SettingsRepository::new(open_store_at(&db_path))
            .get_theme()
            .expect("应能读取保存后的主题"),
        "dark"
    );
}

#[test]
fn database_store_can_open_from_legacy_candidate_when_target_is_missing() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let target_path = temp_dir.path().join("questpilot.db");
    let legacy_path = temp_dir.path().join("question-bank.db");

    QuestionBankRepository::new(DatabaseStore::open(&legacy_path).expect("应能创建旧数据库"))
        .create(CreateQuestionBankInput {
            name: "旧题库".to_string(),
            description: None,
        })
        .expect("旧数据库应能写入题库");

    let migrated = DatabaseStore::open_with_legacy_candidates(&target_path, &[legacy_path])
        .expect("应能从旧库候选路径迁移并打开");
    let banks = QuestionBankRepository::new(migrated).list_all().expect("应能读取迁移后的题库");

    assert!(target_path.exists());
    assert_eq!(banks.len(), 1);
    assert_eq!(banks[0].name, "旧题库");
}

#[test]
fn database_store_replaces_empty_target_with_legacy_candidate() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let target_path = temp_dir.path().join("questpilot.db");
    let legacy_path = temp_dir.path().join("QuestPilot").join("questpilot.db");

    assert!(QuestionBankRepository::new(open_store_at(&target_path))
        .list_all()
        .expect("应能读取空库题库")
        .is_empty());

    QuestionBankRepository::new(DatabaseStore::open(&legacy_path).expect("应能创建 Electron 候选库"))
        .create(CreateQuestionBankInput {
            name: "Electron 题库".to_string(),
            description: Some("来自 Electron 当前数据目录".to_string()),
        })
        .expect("候选库应能写入题库");

    let migrated = DatabaseStore::open_with_legacy_candidates(&target_path, &[legacy_path])
        .expect("应能用候选库替换无用户数据的 Tauri 空库");
    let banks = QuestionBankRepository::new(migrated).list_all().expect("应能读取迁移后的题库");

    assert_eq!(banks.len(), 1);
    assert_eq!(banks[0].name, "Electron 题库");
}

#[test]
fn database_store_keeps_target_when_it_has_user_data() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let target_path = temp_dir.path().join("questpilot.db");
    let legacy_path = temp_dir.path().join("QuestPilot").join("questpilot.db");

    QuestionBankRepository::new(open_store_at(&target_path))
        .create(CreateQuestionBankInput {
            name: "Tauri 题库".to_string(),
            description: None,
        })
        .expect("Tauri 库应能写入题库");

    QuestionBankRepository::new(DatabaseStore::open(&legacy_path).expect("应能创建 Electron 候选库"))
        .create(CreateQuestionBankInput {
            name: "Electron 题库".to_string(),
            description: None,
        })
        .expect("Electron 候选库应能写入题库");

    let migrated = DatabaseStore::open_with_legacy_candidates(&target_path, &[legacy_path])
        .expect("目标库已有用户数据时应保留目标库");
    let banks = QuestionBankRepository::new(migrated).list_all().expect("应能读取目标库题库");

    assert_eq!(banks.len(), 1);
    assert_eq!(banks[0].name, "Tauri 题库");
}

#[test]
fn legacy_database_status_reports_explicit_reset_needed() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let target_path = temp_dir.path().join("questpilot.db");
    let legacy_path = temp_dir.path().join("QuestPilot").join("questpilot.db");

    QuestionBankRepository::new(open_store_at(&target_path))
        .create(CreateQuestionBankInput {
            name: "Tauri 题库".to_string(),
            description: None,
        })
        .expect("Tauri 库应能写入题库");

    QuestionBankRepository::new(DatabaseStore::open(&legacy_path).expect("应能创建 Electron 候选库"))
        .create(CreateQuestionBankInput {
            name: "Electron 题库".to_string(),
            description: None,
        })
        .expect("Electron 候选库应能写入题库");

    let status =
        legacy_database_status(&target_path, &[legacy_path.clone()]).expect("应能读取旧库迁移状态");

    assert!(status.target_exists);
    assert!(status.target_has_user_data);
    assert_eq!(status.recommended_action, "requires_explicit_reset");
    assert_eq!(status.candidates.len(), 1);
    assert!(status.candidates[0].has_user_data);
}

#[test]
fn replace_target_with_legacy_candidate_backs_up_existing_target() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let target_path = temp_dir.path().join("questpilot.db");
    let legacy_path = temp_dir.path().join("QuestPilot").join("questpilot.db");

    QuestionBankRepository::new(open_store_at(&target_path))
        .create(CreateQuestionBankInput {
            name: "Tauri 题库".to_string(),
            description: None,
        })
        .expect("Tauri 库应能写入题库");

    QuestionBankRepository::new(DatabaseStore::open(&legacy_path).expect("应能创建 Electron 候选库"))
        .create(CreateQuestionBankInput {
            name: "Electron 题库".to_string(),
            description: None,
        })
        .expect("Electron 候选库应能写入题库");

    let result = replace_target_with_legacy_candidate(
        &target_path,
        &legacy_path,
        &[legacy_path.clone()],
        "BACKUP_AND_REPLACE",
    )
    .expect("应能显式备份并替换目标库");

    let backup_path = result.backup_path.expect("已有目标库时应创建备份");
    let backup_banks = QuestionBankRepository::new(open_store_at(&backup_path))
        .list_all()
        .expect("应能读取备份库题库");
    assert_eq!(backup_banks.len(), 1);
    assert_eq!(backup_banks[0].name, "Tauri 题库");

    let replaced_banks = QuestionBankRepository::new(open_store_at(&target_path))
        .list_all()
        .expect("应能读取替换后的题库");
    assert_eq!(replaced_banks.len(), 1);
    assert_eq!(replaced_banks[0].name, "Electron 题库");
}

#[test]
fn replace_target_with_legacy_candidate_requires_confirmation() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let target_path = temp_dir.path().join("questpilot.db");
    let legacy_path = temp_dir.path().join("QuestPilot").join("questpilot.db");

    QuestionBankRepository::new(DatabaseStore::open(&legacy_path).expect("应能创建 Electron 候选库"))
        .create(CreateQuestionBankInput {
            name: "Electron 题库".to_string(),
            description: None,
        })
        .expect("Electron 候选库应能写入题库");

    let error = replace_target_with_legacy_candidate(
        &target_path,
        &legacy_path,
        &[legacy_path.clone()],
        "WRONG",
    )
    .expect_err("确认短语错误时不得替换目标库");

    assert!(error.contains("确认"));
    assert!(!target_path.exists());
}

#[test]
fn replace_target_with_legacy_candidate_rejects_non_candidate_path() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let target_path = temp_dir.path().join("questpilot.db");
    let allowed_path = temp_dir.path().join("QuestPilot").join("questpilot.db");
    let external_path = temp_dir.path().join("Other").join("questpilot.db");

    QuestionBankRepository::new(DatabaseStore::open(&external_path).expect("应能创建外部库"))
        .create(CreateQuestionBankInput {
            name: "不应导入的题库".to_string(),
            description: None,
        })
        .expect("外部库应能写入题库");

    let error = replace_target_with_legacy_candidate(
        &target_path,
        &external_path,
        &[allowed_path],
        "BACKUP_AND_REPLACE",
    )
    .expect_err("非候选路径不得替换目标库");

    assert!(error.contains("候选列表"));
    assert!(!target_path.exists());
}

#[test]
fn legacy_database_candidates_include_current_electron_data_dirs() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let target_path = temp_dir
        .path()
        .join("com.questpilot.desktop")
        .join("questpilot.db");

    let candidates = legacy_database_candidates(&target_path);

    assert!(candidates.contains(&temp_dir.path().join("QuestPilot").join("questpilot.db")));
    assert!(candidates.contains(&temp_dir.path().join("questpilot").join("questpilot.db")));
    assert!(candidates.contains(
        &temp_dir
            .path()
            .join("question-bank-assistant")
            .join("question-bank.db")
    ));
    assert!(!candidates.contains(&target_path));
}

#[test]
fn database_store_updates_reads_and_deletes_banks() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");

    let bank = QuestionBankRepository::new(open_store_at(&db_path))
        .create(CreateQuestionBankInput {
            name: "原题库".to_string(),
            description: Some("原描述".to_string()),
        })
        .expect("应能创建题库");

    let updated = QuestionBankRepository::new(open_store_at(&db_path))
        .update(
            bank.id,
            CreateQuestionBankInput {
                name: "新题库".to_string(),
                description: Some("新描述".to_string()),
            },
        )
        .expect("应能更新题库")
        .expect("题库应存在");

    assert_eq!(updated.name, "新题库");
    assert_eq!(updated.description.as_deref(), Some("新描述"));

    let by_id = QuestionBankRepository::new(open_store_at(&db_path))
        .find_by_id(bank.id)
        .expect("应能按 ID 读取题库");
    assert_eq!(by_id.expect("题库应存在").name, "新题库");

    QuestionBankRepository::new(open_store_at(&db_path))
        .delete(bank.id)
        .expect("应能删除题库");

    assert!(QuestionBankRepository::new(open_store_at(&db_path))
        .find_by_id(bank.id)
        .expect("删除后查询不应失败")
        .is_none());
}

#[test]
fn database_store_supports_question_crud_and_pagination_search() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");

    let bank = QuestionBankRepository::new(open_store_at(&db_path))
        .create(CreateQuestionBankInput { name: "题库".to_string(), description: None })
        .expect("应能创建题库");

    let first = QuestionRepository::new(open_store_at(&db_path))
        .create(bank.id, sample_single_question("二叉树的高度", "A"))
        .expect("应能创建题目");
    let second = QuestionRepository::new(open_store_at(&db_path))
        .create(bank.id, sample_boolean_question("图可以用邻接矩阵表示"))
        .expect("应能创建第二题");

    assert_eq!(first.bank_id, bank.id);
    assert_eq!(first.r#type, "single");
    assert_eq!(second.r#type, "boolean");

    let page = QuestionRepository::new(open_store_at(&db_path))
        .list_by_bank(bank.id, 0, 1, None)
        .expect("应能分页读取题目");
    assert_eq!(page.len(), 1);

    let boolean_page = QuestionRepository::new(open_store_at(&db_path))
        .list_by_bank(bank.id, 0, 20, Some("boolean".to_string()))
        .expect("应能按题型筛选读取题目");
    assert_eq!(boolean_page.len(), 1);
    assert_eq!(boolean_page[0].id, second.id);

    let search = QuestionRepository::new(open_store_at(&db_path))
        .search(bank.id, "二叉树".to_string(), None, 0, 20)
        .expect("应能搜索题干");
    assert_eq!(search.len(), 1);
    assert_eq!(search[0].id, first.id);

    let total = QuestionRepository::new(open_store_at(&db_path))
        .count(bank.id, "".to_string(), None)
        .expect("应能统计题目数量");
    assert_eq!(total, 2);

    let updated = QuestionRepository::new(open_store_at(&db_path))
        .update(
            first.id,
            CreateQuestionInput {
                r#type: "single".to_string(),
                content: "平衡二叉树的特点".to_string(),
                options: Some(json!([
                    { "id": "A", "text": "左右子树高度差不超过 1" },
                    { "id": "B", "text": "所有结点度数相同" }
                ])),
                answer: "A".to_string(),
                analysis: Some("AVL 树满足该性质".to_string()),
            },
        )
        .expect("应能更新题目")
        .expect("题目应存在");

    assert_eq!(updated.content, "平衡二叉树的特点");
    assert_eq!(updated.analysis.as_deref(), Some("AVL 树满足该性质"));

    let by_id = QuestionRepository::new(open_store_at(&db_path))
        .find_by_id(first.id)
        .expect("按 ID 查询不应失败")
        .expect("题目应存在");
    assert_eq!(by_id.content, "平衡二叉树的特点");

    QuestionRepository::new(open_store_at(&db_path))
        .delete_batch(&[first.id, second.id])
        .expect("应能批量删除题目");
    assert_eq!(
        QuestionRepository::new(open_store_at(&db_path))
            .count(bank.id, "".to_string(), None)
            .expect("删除后统计不应失败"),
        0
    );
}

#[test]
fn database_store_supports_practice_records_stats_and_logs() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");

    let bank = QuestionBankRepository::new(open_store_at(&db_path))
        .create(CreateQuestionBankInput { name: "练习题库".to_string(), description: None })
        .expect("应能创建题库");

    QuestionRepository::new(open_store_at(&db_path))
        .create_batch(bank.id, vec![
            sample_single_question("排序算法", "A"),
            sample_boolean_question("栈是先进后出结构"),
        ])
        .expect("应能批量创建题目");

    PracticeRepository::new(open_store_at(&db_path))
        .save_record(PracticeRecordInput {
            bank_id: bank.id,
            total: 2,
            correct: 1,
            wrong: 1,
            accuracy: 50,
        })
        .expect("应能保存练习记录");

    let records = PracticeRepository::new(open_store_at(&db_path))
        .get_records(bank.id, Some(10))
        .expect("应能读取练习记录");
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].accuracy, 50);

    let stats = PracticeRepository::new(open_store_at(&db_path))
        .get_all_stats()
        .expect("应能读取练习统计");
    assert_eq!(stats.len(), 1);
    assert_eq!(stats[0].bank_id, bank.id);
    assert_eq!(stats[0].practice_count, 1);
    assert_eq!(stats[0].avg_accuracy, 50);

    let dashboard = StatsRepository::new(open_store_at(&db_path))
        .get_dashboard()
        .expect("应能读取仪表盘统计");
    assert_eq!(dashboard.total_questions, 2);
    assert!(dashboard.today_questions >= 2);
    assert!(dashboard.week_questions >= 2);
    assert_eq!(dashboard.type_distribution.len(), 2);

    let single_distribution = StatsRepository::new(open_store_at(&db_path))
        .get_type_distribution(Some(bank.id))
        .expect("应能按题库读取题型分布")
        .into_iter()
        .find(|item| item.r#type == "single")
        .expect("应包含单选题统计");
    assert_eq!(single_distribution.count, 1);

    let logs = StatsRepository::new(open_store_at(&db_path))
        .get_operation_logs(Some(10))
        .expect("应能读取操作日志");
    assert!(!logs.is_empty());
    assert_eq!(logs[0].action, "完成练习");
}

#[test]
fn database_store_supports_wrong_book_workflow() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");

    let bank = QuestionBankRepository::new(open_store_at(&db_path))
        .create(CreateQuestionBankInput { name: "错题题库".to_string(), description: None })
        .expect("应能创建题库");
    let first = QuestionRepository::new(open_store_at(&db_path))
        .create(bank.id, sample_single_question("错题 1", "A"))
        .expect("应能创建题目");
    let second = QuestionRepository::new(open_store_at(&db_path))
        .create(bank.id, sample_boolean_question("错题 2"))
        .expect("应能创建第二题");

    assert_eq!(
        SettingsRepository::new(open_store_at(&db_path))
            .get_wrong_book_threshold()
            .expect("应能读取默认阈值"),
        3
    );
    SettingsRepository::new(open_store_at(&db_path))
        .set_wrong_book_threshold(2)
        .expect("应能设置错题移除阈值");
    assert_eq!(
        SettingsRepository::new(open_store_at(&db_path))
            .get_wrong_book_threshold()
            .expect("应能读取保存阈值"),
        2
    );

    WrongBookRepository::new(open_store_at(&db_path))
        .update_from_practice_tx(
            &[
                WrongBookPracticeResult { question_id: first.id, bank_id: bank.id, is_correct: false },
                WrongBookPracticeResult { question_id: second.id, bank_id: bank.id, is_correct: false },
            ],
            2,
        )
        .expect("应能同步错题本");

    let counts = WrongBookRepository::new(open_store_at(&db_path))
        .get_counts_by_bank()
        .expect("应能读取错题计数");
    assert_eq!(counts.len(), 1);
    assert_eq!(counts[0].bank_id, bank.id);
    assert_eq!(counts[0].count, 2);

    let items = WrongBookRepository::new(open_store_at(&db_path))
        .get_items(Some(bank.id), 0, 20)
        .expect("应能读取错题列表");
    assert_eq!(items.len(), 2);
    assert!(items.iter().any(|item| item.question_id == first.id));

    let random = WrongBookRepository::new(open_store_at(&db_path))
        .get_random_questions(Some(bank.id), Some(10))
        .expect("应能随机读取错题");
    assert_eq!(random.len(), 2);

    WrongBookRepository::new(open_store_at(&db_path))
        .update_from_practice_tx(
            &[
                WrongBookPracticeResult { question_id: first.id, bank_id: bank.id, is_correct: true },
                WrongBookPracticeResult { question_id: first.id, bank_id: bank.id, is_correct: true },
            ],
            2,
        )
        .expect("连续答对应能同步错题本");
    assert_eq!(
        WrongBookRepository::new(open_store_at(&db_path))
            .count_items(Some(bank.id))
            .expect("应能统计错题数量"),
        1
    );

    WrongBookRepository::new(open_store_at(&db_path))
        .remove_item(second.id)
        .expect("应能移除单个错题");
    assert_eq!(
        WrongBookRepository::new(open_store_at(&db_path))
            .count_items(Some(bank.id))
            .expect("移除后统计不应失败"),
        0
    );

    WrongBookRepository::new(open_store_at(&db_path))
        .update_from_practice_tx(
            &[WrongBookPracticeResult { question_id: second.id, bank_id: bank.id, is_correct: false }],
            2,
        )
        .expect("应能使用默认阈值同步错题");
    WrongBookRepository::new(open_store_at(&db_path))
        .clear(Some(bank.id))
        .expect("应能清空指定题库错题");
    assert_eq!(
        WrongBookRepository::new(open_store_at(&db_path))
            .count_items(Some(bank.id))
            .expect("清空后统计不应失败"),
        0
    );
}

#[test]
fn database_store_supports_draft_and_api_config() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");

    assert!(DraftRepository::new(open_store_at(&db_path))
        .load()
        .expect("读取空草稿不应失败")
        .is_none());

    DraftRepository::new(open_store_at(&db_path))
        .save(json!({
            "type": "single",
            "content": "CPU 的基本组成包括什么？",
            "answer": "运算器|控制器"
        }))
        .expect("应能保存草稿");
    let draft = DraftRepository::new(open_store_at(&db_path))
        .load()
        .expect("应能读取草稿")
        .expect("草稿应存在");
    assert_eq!(draft["type"], "single");
    assert_eq!(draft["content"], "CPU 的基本组成包括什么？");
    assert!(draft.get("savedAt").and_then(|v| v.as_str()).is_some());

    DraftRepository::new(open_store_at(&db_path))
        .clear()
        .expect("应能清除草稿");
    assert!(DraftRepository::new(open_store_at(&db_path))
        .load()
        .expect("清除后读取不应失败")
        .is_none());

    let default_config = SettingsRepository::new(open_store_at(&db_path))
        .get_api_config()
        .expect("应能读取默认 API 配置");
    assert_eq!(default_config.api_url, "https://api.openai.com");
    assert_eq!(default_config.model_id, "gpt-3.5-turbo");
    assert_eq!(default_config.provider, "custom");
    assert_eq!(default_config.api_key, "");

    SettingsRepository::new(open_store_at(&db_path))
        .set_api_config(ApiConfig {
            api_key: "token-test".to_string(),
            api_url: "https://api.example.com".to_string(),
            model_id: "model-x".to_string(),
            provider: "openai".to_string(),
        })
        .expect("应能保存 API 配置");
    let saved_config = SettingsRepository::new(open_store_at(&db_path))
        .get_api_config()
        .expect("应能读取保存后的 API 配置");
    assert_eq!(saved_config.api_key, "token-test");
    assert_eq!(saved_config.api_url, "https://api.example.com");
    assert_eq!(saved_config.model_id, "model-x");
    assert_eq!(saved_config.provider, "openai");

    SettingsRepository::new(open_store_at(&db_path))
        .set_api_config(ApiConfig {
            api_key: "   ".to_string(),
            api_url: "https://api.updated.example.com".to_string(),
            model_id: "model-y".to_string(),
            provider: "custom".to_string(),
        })
        .expect("空 API Key 应保留已有配置");
    let preserved_config = SettingsRepository::new(open_store_at(&db_path))
        .get_api_config()
        .expect("应能读取保留后的 API 配置");
    assert_eq!(preserved_config.api_key, "token-test");
    assert_eq!(preserved_config.api_url, "https://api.updated.example.com");
    assert_eq!(preserved_config.model_id, "model-y");
    assert_eq!(preserved_config.provider, "custom");
}

#[test]
fn database_store_supports_prompt_crud_with_default_prompt_guard() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");

    let prompts = PromptRepository::new(open_store_at(&db_path))
        .list_all()
        .expect("应能读取 Prompt 列表");
    assert_eq!(prompts.len(), 1);
    assert!(prompts[0].is_default);
    assert_eq!(prompts[0].name, "默认");

    let created = PromptRepository::new(open_store_at(&db_path))
        .create(CreatePromptInput {
            name: "  考研导师  ".to_string(),
            content: "  先诊断用户哪里没懂，再回答。  ".to_string(),
        })
        .expect("应能创建 Prompt");
    assert_eq!(created.name, "考研导师");
    assert_eq!(created.content, "先诊断用户哪里没懂，再回答。");
    assert!(!created.is_default);

    let updated = PromptRepository::new(open_store_at(&db_path))
        .update(
            created.id,
            CreatePromptInput {
                name: "408 导师".to_string(),
                content: "用 408 复习视角回答。".to_string(),
            },
        )
        .expect("应能更新 Prompt")
        .expect("Prompt 应存在");
    assert_eq!(updated.name, "408 导师");

    let by_id = PromptRepository::new(open_store_at(&db_path))
        .find_by_id(created.id)
        .expect("按 ID 读取 Prompt 不应失败")
        .expect("Prompt 应存在");
    assert_eq!(by_id.content, "用 408 复习视角回答。");

    let default_prompt = prompts.into_iter().find(|p| p.is_default).unwrap();
    assert!(PromptRepository::new(open_store_at(&db_path))
        .delete(default_prompt.id)
        .is_err());

    PromptRepository::new(open_store_at(&db_path))
        .delete(created.id)
        .expect("应能删除非默认 Prompt");
    assert!(PromptRepository::new(open_store_at(&db_path))
        .find_by_id(created.id)
        .expect("删除后查询不应失败")
        .is_none());
}

#[test]
fn database_store_supports_chat_history_crud() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");

    let prompt = PromptRepository::new(open_store_at(&db_path))
        .create(CreatePromptInput {
            name: "答疑 Prompt".to_string(),
            content: "保持简洁。".to_string(),
        })
        .expect("应能创建 Prompt");

    let saved = ChatHistoryRepository::new(open_store_at(&db_path))
        .save(ChatHistoryInput {
            title: Some("  二叉树问题  ".to_string()),
            messages: json!([
                { "role": "user", "content": "什么是满二叉树？" },
                { "role": "assistant", "content": "所有分支结点都有两个孩子。" }
            ]),
            prompt_id: Some(prompt.id),
        })
        .expect("应能保存聊天记录");
    assert_eq!(saved.title, "二叉树问题");
    assert_eq!(saved.prompt_id, Some(prompt.id));
    assert!(
        saved
            .messages
            .as_ref()
            .expect("保存结果应包含消息")
            .as_array()
            .expect("消息应为数组")
            .len()
            == 2
    );

    let list = ChatHistoryRepository::new(open_store_at(&db_path))
        .list_all(Some(50))
        .expect("应能读取聊天记录列表");
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, saved.id);
    assert!(list[0].messages.is_none());

    let updated = ChatHistoryRepository::new(open_store_at(&db_path))
        .update(
            saved.id,
            json!([
                { "role": "user", "content": "更新后的问题" },
                { "role": "assistant", "content": "更新后的回答" }
            ]),
        )
        .expect("应能更新聊天记录")
        .expect("聊天记录应存在");
    assert_eq!(
        updated.messages.as_ref().expect("更新结果应包含消息")[0]["content"],
        "更新后的问题"
    );

    let by_id = ChatHistoryRepository::new(open_store_at(&db_path))
        .find_by_id(saved.id)
        .expect("按 ID 读取聊天记录不应失败")
        .expect("聊天记录应存在");
    assert_eq!(
        by_id.messages.as_ref().expect("详情应包含消息")[1]["content"],
        "更新后的回答"
    );

    ChatHistoryRepository::new(open_store_at(&db_path))
        .delete(saved.id)
        .expect("应能删除聊天记录");
    assert!(ChatHistoryRepository::new(open_store_at(&db_path))
        .find_by_id(saved.id)
        .expect("删除后查询不应失败")
        .is_none());
}
