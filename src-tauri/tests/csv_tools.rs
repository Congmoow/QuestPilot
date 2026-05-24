use questpilot_tauri_lib::csv_tools::{
    export_questions_to_csv, generate_template, parse_csv_content,
};
use questpilot_tauri_lib::database::Question;
use serde_json::json;

#[test]
fn csv_tools_generates_template_with_chinese_headers() {
    let template = generate_template().expect("应能生成 CSV 模板");

    assert!(template.starts_with("\"题型\",\"题干\",\"选项A\""));
    assert!(template.contains("单选题"));
    assert!(template.contains("JavaScript"));
}

#[test]
fn csv_tools_parses_valid_and_invalid_rows() {
    let content = [
        "题型,题干,选项A,选项B,选项C,选项D,选项E,选项F,答案,解析",
        "单选题,CPU 主要由什么组成？,运算器,显示器,,,,,A,",
        "判断题,栈是后进先出结构。,,,,,,,正确,",
        "单选题,缺少选项题,A,,,,,,A,",
    ]
    .join("\n");

    let result = parse_csv_content(content.as_str()).expect("应能解析 CSV 内容");

    assert_eq!(result.total_rows, 3);
    assert_eq!(result.valid.len(), 2);
    assert_eq!(result.errors.len(), 1);
    assert_eq!(result.valid[0].r#type, "single");
    assert_eq!(result.valid[0].answer, "A");
    assert_eq!(result.valid[1].r#type, "boolean");
    assert!(result.errors[0].message.contains("选择题至少需要2个选项"));
}

#[test]
fn csv_tools_exports_questions_to_csv() {
    let csv = export_questions_to_csv(&[Question {
        id: 1,
        bank_id: 2,
        r#type: "multiple".to_string(),
        content: "以下哪些是前端框架？".to_string(),
        options: Some(json!([
            { "id": "A", "text": "React" },
            { "id": "B", "text": "Vue" },
            { "id": "C", "text": "SQLite" }
        ])),
        answer: "A|B".to_string(),
        analysis: Some("React 和 Vue 是前端框架".to_string()),
        created_at: "2026-05-24 00:00:00".to_string(),
        updated_at: "2026-05-24 00:00:00".to_string(),
    }])
    .expect("应能导出 CSV");

    assert!(csv.starts_with("\"题型\",\"题干\",\"选项A\""));
    assert!(csv.contains("多选题"));
    assert!(csv.contains("以下哪些是前端框架？"));
    assert!(csv.contains("A|B"));
}
