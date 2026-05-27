pub mod ai;
pub mod commands;
pub mod csv_tools;
pub mod database;
pub mod error;
pub mod services;
pub mod toml_tools;

use commands::{
    ai_cmd::{ai_chat, ai_import_questions_direct, ai_parse_questions},
    csv::{csv_download_template, csv_export, csv_import, csv_parse_file, csv_select_file},
    draft::{draft_clear, draft_load, draft_save},
    practice::{practice_get_all_stats, practice_get_records, practice_save_record},
    prompt_chat::{
        chat_history_delete, chat_history_get_all, chat_history_get_by_id, chat_history_save,
        chat_history_update, prompt_create, prompt_delete, prompt_get_all, prompt_get_by_id,
        prompt_update,
    },
    question::{
        question_create, question_create_batch, question_delete, question_get_by_bank_id,
        question_get_by_id, question_get_random, question_search, question_update,
    },
    question_bank::{
        question_bank_create, question_bank_delete, question_bank_get_all, question_bank_get_by_id,
        question_bank_update,
    },
    settings::{
        migration_backup_and_replace_from_legacy, migration_get_legacy_status,
        settings_get_api_config, settings_get_theme, settings_get_wrong_book_threshold,
        settings_set_api_config, settings_set_theme, settings_set_wrong_book_threshold,
        settings_test_api_connection,
    },
    stats::{stats_get_dashboard, stats_get_operation_logs, stats_get_type_distribution},
    toml::{toml_parse_file, toml_select_file},
    window::{window_close, window_is_maximized, window_maximize, window_minimize},
    wrong_book::{
        wrong_book_clear, wrong_book_get_counts_by_bank, wrong_book_get_items,
        wrong_book_get_random_questions, wrong_book_remove_item, wrong_book_update_from_practice,
    },
};

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            question_bank_create,
            question_bank_get_all,
            question_bank_get_by_id,
            question_bank_update,
            question_bank_delete,
            question_create,
            question_create_batch,
            question_get_by_bank_id,
            question_get_random,
            question_get_by_id,
            question_update,
            question_delete,
            question_search,
            stats_get_dashboard,
            stats_get_operation_logs,
            stats_get_type_distribution,
            settings_get_theme,
            settings_set_theme,
            settings_get_api_config,
            settings_set_api_config,
            settings_test_api_connection,
            migration_get_legacy_status,
            migration_backup_and_replace_from_legacy,
            ai_parse_questions,
            ai_chat,
            ai_import_questions_direct,
            settings_get_wrong_book_threshold,
            settings_set_wrong_book_threshold,
            draft_save,
            draft_load,
            draft_clear,
            prompt_get_all,
            prompt_get_by_id,
            prompt_create,
            prompt_update,
            prompt_delete,
            chat_history_save,
            chat_history_update,
            chat_history_get_all,
            chat_history_get_by_id,
            chat_history_delete,
            practice_save_record,
            practice_get_records,
            practice_get_all_stats,
            wrong_book_get_counts_by_bank,
            wrong_book_get_items,
            wrong_book_get_random_questions,
            wrong_book_update_from_practice,
            wrong_book_remove_item,
            wrong_book_clear,
            csv_download_template,
            csv_select_file,
            csv_parse_file,
            csv_import,
            csv_export,
            toml_select_file,
            toml_parse_file
        ])
        .run(tauri::generate_context!())
        .expect("启动 QuestPilot Tauri 应用失败");
}
