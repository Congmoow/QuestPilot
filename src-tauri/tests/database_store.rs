use questpilot_tauri_lib::database::{CreateQuestionBankInput, CreateQuestionInput, DatabaseStore};
use serde_json::json;
use tempfile::tempdir;

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
            "wrong_book",
        ])
        .expect("应能统计核心表");

    assert_eq!(table_count, 6);
}

#[test]
fn database_store_writes_bank_questions_and_random_queries() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");
    let store = DatabaseStore::open(&db_path).expect("应能打开数据库");

    let bank = store
        .create_bank(CreateQuestionBankInput {
            name: "  408  ".to_string(),
            description: Some("  数据结构  ".to_string()),
        })
        .expect("应能创建题库");

    assert_eq!(bank.name, "408");
    assert_eq!(bank.description.as_deref(), Some("数据结构"));
    assert_eq!(bank.question_count, 0);

    let import_result = store
        .create_questions_batch(
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

    let banks = store.get_all_banks().expect("应能读取题库列表");
    assert_eq!(banks[0].question_count, 2);

    let random = store
        .get_random_questions(bank.id, Some(10), None)
        .expect("应能随机抽题");
    assert_eq!(random.len(), 2);

    let singles = store
        .get_random_questions(bank.id, Some(10), Some("single".to_string()))
        .expect("应能按题型随机抽题");
    assert_eq!(singles.len(), 1);
    assert_eq!(singles[0].r#type, "single");
}

#[test]
fn database_store_persists_theme_setting() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");
    let store = DatabaseStore::open(&db_path).expect("应能打开数据库");

    assert_eq!(store.get_theme().expect("应能读取默认主题"), "system");

    store
        .set_theme("dark".to_string())
        .expect("应能保存主题设置");

    let reopened = DatabaseStore::open(&db_path).expect("应能重新打开数据库");
    assert_eq!(reopened.get_theme().expect("应能读取保存后的主题"), "dark");
}

#[test]
fn database_store_can_open_from_legacy_candidate_when_target_is_missing() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let target_path = temp_dir.path().join("questpilot.db");
    let legacy_path = temp_dir.path().join("question-bank.db");

    let legacy = DatabaseStore::open(&legacy_path).expect("应能创建旧数据库");
    legacy
        .create_bank(CreateQuestionBankInput {
            name: "旧题库".to_string(),
            description: None,
        })
        .expect("旧数据库应能写入题库");
    drop(legacy);

    let migrated = DatabaseStore::open_with_legacy_candidates(&target_path, &[legacy_path])
        .expect("应能从旧库候选路径迁移并打开");
    let banks = migrated.get_all_banks().expect("应能读取迁移后的题库");

    assert!(target_path.exists());
    assert_eq!(banks.len(), 1);
    assert_eq!(banks[0].name, "旧题库");
}
