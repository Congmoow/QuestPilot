use questpilot_tauri_lib::database::{
    legacy_database_candidates, ApiConfig, ChatHistoryInput, CreatePromptInput,
    CreateQuestionBankInput, CreateQuestionInput, DatabaseStore, PracticeRecordInput,
    WrongBookPracticeResult,
};
use rusqlite::Connection;
use serde_json::json;
use std::path::Path;
use tempfile::tempdir;

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
fn database_store_replaces_empty_target_with_legacy_candidate() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let target_path = temp_dir.path().join("questpilot.db");
    let legacy_path = temp_dir.path().join("QuestPilot").join("questpilot.db");

    let target = DatabaseStore::open(&target_path).expect("应能创建 Tauri 空库");
    assert!(target.get_all_banks().expect("应能读取空库题库").is_empty());
    drop(target);

    let legacy = DatabaseStore::open(&legacy_path).expect("应能创建 Electron 候选库");
    legacy
        .create_bank(CreateQuestionBankInput {
            name: "Electron 题库".to_string(),
            description: Some("来自 Electron 当前数据目录".to_string()),
        })
        .expect("候选库应能写入题库");
    drop(legacy);

    let migrated = DatabaseStore::open_with_legacy_candidates(&target_path, &[legacy_path])
        .expect("应能用候选库替换无用户数据的 Tauri 空库");
    let banks = migrated.get_all_banks().expect("应能读取迁移后的题库");

    assert_eq!(banks.len(), 1);
    assert_eq!(banks[0].name, "Electron 题库");
}

#[test]
fn database_store_keeps_target_when_it_has_user_data() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let target_path = temp_dir.path().join("questpilot.db");
    let legacy_path = temp_dir.path().join("QuestPilot").join("questpilot.db");

    let target = DatabaseStore::open(&target_path).expect("应能创建 Tauri 库");
    target
        .create_bank(CreateQuestionBankInput {
            name: "Tauri 题库".to_string(),
            description: None,
        })
        .expect("Tauri 库应能写入题库");
    drop(target);

    let legacy = DatabaseStore::open(&legacy_path).expect("应能创建 Electron 候选库");
    legacy
        .create_bank(CreateQuestionBankInput {
            name: "Electron 题库".to_string(),
            description: None,
        })
        .expect("Electron 候选库应能写入题库");
    drop(legacy);

    let migrated = DatabaseStore::open_with_legacy_candidates(&target_path, &[legacy_path])
        .expect("目标库已有用户数据时应保留目标库");
    let banks = migrated.get_all_banks().expect("应能读取目标库题库");

    assert_eq!(banks.len(), 1);
    assert_eq!(banks[0].name, "Tauri 题库");
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

#[test]
fn database_store_supports_practice_records_stats_and_logs() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");
    let store = DatabaseStore::open(&db_path).expect("应能打开数据库");
    let bank = store
        .create_bank(CreateQuestionBankInput {
            name: "练习题库".to_string(),
            description: None,
        })
        .expect("应能创建题库");

    store
        .create_questions_batch(
            bank.id,
            vec![
                sample_single_question("排序算法", "A"),
                sample_boolean_question("栈是先进后出结构"),
            ],
        )
        .expect("应能批量创建题目");

    store
        .save_practice_record(PracticeRecordInput {
            bank_id: bank.id,
            total: 2,
            correct: 1,
            wrong: 1,
            accuracy: 50,
        })
        .expect("应能保存练习记录");

    let records = store
        .get_practice_records(bank.id, Some(10))
        .expect("应能读取练习记录");
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].accuracy, 50);

    let stats = store.get_all_practice_stats().expect("应能读取练习统计");
    assert_eq!(stats.len(), 1);
    assert_eq!(stats[0].bank_id, bank.id);
    assert_eq!(stats[0].practice_count, 1);
    assert_eq!(stats[0].avg_accuracy, 50);

    let dashboard = store.get_dashboard_stats().expect("应能读取仪表盘统计");
    assert_eq!(dashboard.total_questions, 2);
    assert!(dashboard.today_questions >= 2);
    assert!(dashboard.week_questions >= 2);
    assert_eq!(dashboard.type_distribution.len(), 2);

    let single_distribution = store
        .get_question_count_by_type(Some(bank.id))
        .expect("应能按题库读取题型分布")
        .into_iter()
        .find(|item| item.r#type == "single")
        .expect("应包含单选题统计");
    assert_eq!(single_distribution.count, 1);

    let logs = store
        .get_operation_logs(Some(10))
        .expect("应能读取操作日志");
    assert!(!logs.is_empty());
    assert_eq!(logs[0].action, "完成练习");
}

#[test]
fn database_store_supports_wrong_book_workflow() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");
    let store = DatabaseStore::open(&db_path).expect("应能打开数据库");
    let bank = store
        .create_bank(CreateQuestionBankInput {
            name: "错题题库".to_string(),
            description: None,
        })
        .expect("应能创建题库");
    let first = store
        .create_question(bank.id, sample_single_question("错题 1", "A"))
        .expect("应能创建题目");
    let second = store
        .create_question(bank.id, sample_boolean_question("错题 2"))
        .expect("应能创建第二题");

    assert_eq!(
        store.get_wrong_book_threshold().expect("应能读取默认阈值"),
        3
    );
    store
        .set_wrong_book_threshold(2)
        .expect("应能设置错题移除阈值");
    assert_eq!(
        store.get_wrong_book_threshold().expect("应能读取保存阈值"),
        2
    );

    store
        .update_wrong_book_from_practice(
            vec![
                WrongBookPracticeResult {
                    question_id: first.id,
                    bank_id: bank.id,
                    is_correct: false,
                },
                WrongBookPracticeResult {
                    question_id: second.id,
                    bank_id: bank.id,
                    is_correct: false,
                },
            ],
            Some(2),
        )
        .expect("应能同步错题本");

    let counts = store
        .get_wrong_book_counts_by_bank()
        .expect("应能读取错题计数");
    assert_eq!(counts.len(), 1);
    assert_eq!(counts[0].bank_id, bank.id);
    assert_eq!(counts[0].count, 2);

    let items = store
        .get_wrong_book_items(Some(bank.id), 0, 20)
        .expect("应能读取错题列表");
    assert_eq!(items.len(), 2);
    assert!(items.iter().any(|item| item.question_id == first.id));

    let random = store
        .get_random_wrong_questions(Some(bank.id), Some(10))
        .expect("应能随机读取错题");
    assert_eq!(random.len(), 2);

    store
        .update_wrong_book_from_practice(
            vec![
                WrongBookPracticeResult {
                    question_id: first.id,
                    bank_id: bank.id,
                    is_correct: true,
                },
                WrongBookPracticeResult {
                    question_id: first.id,
                    bank_id: bank.id,
                    is_correct: true,
                },
            ],
            Some(2),
        )
        .expect("连续答对应能同步错题本");
    assert_eq!(
        store
            .count_wrong_book_items(Some(bank.id))
            .expect("应能统计错题数量"),
        1
    );

    store
        .remove_wrong_book_item(second.id)
        .expect("应能移除单个错题");
    assert_eq!(
        store
            .count_wrong_book_items(Some(bank.id))
            .expect("移除后统计不应失败"),
        0
    );

    store
        .update_wrong_book_from_practice(
            vec![WrongBookPracticeResult {
                question_id: second.id,
                bank_id: bank.id,
                is_correct: false,
            }],
            None,
        )
        .expect("应能使用默认阈值同步错题");
    store
        .clear_wrong_book(Some(bank.id))
        .expect("应能清空指定题库错题");
    assert_eq!(
        store
            .count_wrong_book_items(Some(bank.id))
            .expect("清空后统计不应失败"),
        0
    );
}

#[test]
fn database_store_supports_draft_and_api_config() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");
    let store = DatabaseStore::open(&db_path).expect("应能打开数据库");

    assert!(store.load_draft().expect("读取空草稿不应失败").is_none());

    store
        .save_draft(json!({
            "type": "single",
            "content": "CPU 的基本组成包括什么？",
            "answer": "运算器|控制器"
        }))
        .expect("应能保存草稿");
    let draft = store
        .load_draft()
        .expect("应能读取草稿")
        .expect("草稿应存在");
    assert_eq!(draft["type"], "single");
    assert_eq!(draft["content"], "CPU 的基本组成包括什么？");
    assert!(draft
        .get("savedAt")
        .and_then(|value| value.as_str())
        .is_some());

    store.clear_draft().expect("应能清除草稿");
    assert!(store.load_draft().expect("清除后读取不应失败").is_none());

    let default_config = store.get_api_config().expect("应能读取默认 API 配置");
    assert_eq!(default_config.api_url, "https://api.openai.com");
    assert_eq!(default_config.model_id, "gpt-3.5-turbo");
    assert_eq!(default_config.provider, "custom");
    assert_eq!(default_config.api_key, "");

    store
        .set_api_config(ApiConfig {
            api_key: "token-test".to_string(),
            api_url: "https://api.example.com".to_string(),
            model_id: "model-x".to_string(),
            provider: "openai".to_string(),
        })
        .expect("应能保存 API 配置");
    let saved_config = store.get_api_config().expect("应能读取保存后的 API 配置");
    assert_eq!(saved_config.api_key, "token-test");
    assert_eq!(saved_config.api_url, "https://api.example.com");
    assert_eq!(saved_config.model_id, "model-x");
    assert_eq!(saved_config.provider, "openai");

    store
        .set_api_config(ApiConfig {
            api_key: "   ".to_string(),
            api_url: "https://api.updated.example.com".to_string(),
            model_id: "model-y".to_string(),
            provider: "custom".to_string(),
        })
        .expect("空 API Key 应保留已有配置");
    let preserved_config = store.get_api_config().expect("应能读取保留后的 API 配置");
    assert_eq!(preserved_config.api_key, "token-test");
    assert_eq!(preserved_config.api_url, "https://api.updated.example.com");
    assert_eq!(preserved_config.model_id, "model-y");
    assert_eq!(preserved_config.provider, "custom");
}

#[test]
fn database_store_supports_prompt_crud_with_default_prompt_guard() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");
    let store = DatabaseStore::open(&db_path).expect("应能打开数据库");

    let prompts = store.get_all_prompts().expect("应能读取 Prompt 列表");
    assert_eq!(prompts.len(), 1);
    assert!(prompts[0].is_default);
    assert_eq!(prompts[0].name, "默认");

    let created = store
        .create_prompt(CreatePromptInput {
            name: "  考研导师  ".to_string(),
            content: "  先诊断用户哪里没懂，再回答。  ".to_string(),
        })
        .expect("应能创建 Prompt");
    assert_eq!(created.name, "考研导师");
    assert_eq!(created.content, "先诊断用户哪里没懂，再回答。");
    assert!(!created.is_default);

    let updated = store
        .update_prompt(
            created.id,
            CreatePromptInput {
                name: "408 导师".to_string(),
                content: "用 408 复习视角回答。".to_string(),
            },
        )
        .expect("应能更新 Prompt")
        .expect("Prompt 应存在");
    assert_eq!(updated.name, "408 导师");

    let by_id = store
        .get_prompt_by_id(created.id)
        .expect("按 ID 读取 Prompt 不应失败")
        .expect("Prompt 应存在");
    assert_eq!(by_id.content, "用 408 复习视角回答。");

    let default_prompt = prompts
        .into_iter()
        .find(|prompt| prompt.is_default)
        .unwrap();
    assert!(store.delete_prompt(default_prompt.id).is_err());

    store
        .delete_prompt(created.id)
        .expect("应能删除非默认 Prompt");
    assert!(store
        .get_prompt_by_id(created.id)
        .expect("删除后查询不应失败")
        .is_none());
}

#[test]
fn database_store_supports_chat_history_crud() {
    let temp_dir = tempdir().expect("应能创建临时目录");
    let db_path = temp_dir.path().join("questpilot.db");
    let store = DatabaseStore::open(&db_path).expect("应能打开数据库");
    let prompt = store
        .create_prompt(CreatePromptInput {
            name: "答疑 Prompt".to_string(),
            content: "保持简洁。".to_string(),
        })
        .expect("应能创建 Prompt");

    let saved = store
        .save_chat_history(ChatHistoryInput {
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

    let list = store
        .get_all_chat_history(Some(50))
        .expect("应能读取聊天记录列表");
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, saved.id);
    assert!(list[0].messages.is_none());

    let updated = store
        .update_chat_history(
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

    let by_id = store
        .get_chat_history_by_id(saved.id)
        .expect("按 ID 读取聊天记录不应失败")
        .expect("聊天记录应存在");
    assert_eq!(
        by_id.messages.as_ref().expect("详情应包含消息")[1]["content"],
        "更新后的回答"
    );

    store
        .delete_chat_history(saved.id)
        .expect("应能删除聊天记录");
    assert!(store
        .get_chat_history_by_id(saved.id)
        .expect("删除后查询不应失败")
        .is_none());
}
