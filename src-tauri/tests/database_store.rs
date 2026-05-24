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

#[test]
fn database_store_updates_reads_and_deletes_banks() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");
    let store = DatabaseStore::open(&db_path).expect("应能打开数据库");

    let bank = store
        .create_bank(CreateQuestionBankInput {
            name: "原题库".to_string(),
            description: Some("原描述".to_string()),
        })
        .expect("应能创建题库");

    let updated = store
        .update_bank(
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

    let by_id = store.get_bank_by_id(bank.id).expect("应能按 ID 读取题库");
    assert_eq!(by_id.expect("题库应存在").name, "新题库");

    store.delete_bank(bank.id).expect("应能删除题库");

    assert!(store
        .get_bank_by_id(bank.id)
        .expect("删除后查询不应失败")
        .is_none());
}

#[test]
fn database_store_supports_question_crud_and_pagination_search() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");
    let store = DatabaseStore::open(&db_path).expect("应能打开数据库");
    let bank = store
        .create_bank(CreateQuestionBankInput {
            name: "题库".to_string(),
            description: None,
        })
        .expect("应能创建题库");

    let first = store
        .create_question(bank.id, sample_single_question("二叉树的高度", "A"))
        .expect("应能创建题目");
    let second = store
        .create_question(bank.id, sample_boolean_question("图可以用邻接矩阵表示"))
        .expect("应能创建第二题");

    assert_eq!(first.bank_id, bank.id);
    assert_eq!(first.r#type, "single");
    assert_eq!(second.r#type, "boolean");

    let page = store
        .get_questions_by_bank_id(bank.id, 0, 1, None)
        .expect("应能分页读取题目");
    assert_eq!(page.len(), 1);

    let boolean_page = store
        .get_questions_by_bank_id(bank.id, 0, 20, Some("boolean".to_string()))
        .expect("应能按题型筛选读取题目");
    assert_eq!(boolean_page.len(), 1);
    assert_eq!(boolean_page[0].id, second.id);

    let search = store
        .search_questions(bank.id, "二叉树".to_string(), None, 0, 20)
        .expect("应能搜索题干");
    assert_eq!(search.len(), 1);
    assert_eq!(search[0].id, first.id);

    let total = store
        .count_questions(bank.id, "".to_string(), None)
        .expect("应能统计题目数量");
    assert_eq!(total, 2);

    let updated = store
        .update_question(
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

    let by_id = store
        .get_question_by_id(first.id)
        .expect("按 ID 查询不应失败")
        .expect("题目应存在");
    assert_eq!(by_id.content, "平衡二叉树的特点");

    store
        .delete_questions(&[first.id, second.id])
        .expect("应能批量删除题目");
    assert_eq!(
        store
            .count_questions(bank.id, "".to_string(), None)
            .expect("删除后统计不应失败"),
        0
    );
}
