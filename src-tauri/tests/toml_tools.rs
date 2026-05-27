use questpilot_tauri_lib::toml_tools::parse_toml_content;

#[test]
fn toml_tools_parses_valid_questions() {
    let content = r#"
[[questions]]
type = "single"
content = "以下哪个是基本数据类型？"
options = ["A. String", "B. Array", "C. Object"]
answer = "A"
analysis = "String 是基本数据类型"

[[questions]]
type = "multiple"
content = "以下哪些是前端框架？"
answer = ["A", "B"]

[[questions.options]]
id = "A"
text = "React"

[[questions.options]]
id = "B"
text = "Vue"

[[questions.options]]
id = "C"
text = "Node.js"
"#;

    let result = parse_toml_content(content).expect("应能解析 TOML 内容");

    assert_eq!(result.total_rows, 2);
    assert_eq!(result.valid.len(), 2);
    assert!(result.errors.is_empty());
    assert_eq!(result.valid[0].r#type, "single");
    assert_eq!(result.valid[0].answer, "A");
    assert_eq!(result.valid[1].r#type, "multiple");
    assert_eq!(result.valid[1].answer, "A|B");
}

#[test]
fn toml_tools_reports_invalid_fill_answer_count() {
    let content = r#"
[[questions]]
type = "填空题"
content = "HTML 的全称是___，CSS 的全称是___。"
answer = "HyperText Markup Language"
"#;

    let result = parse_toml_content(content).expect("语法正确时应返回解析结果");

    assert_eq!(result.total_rows, 1);
    assert!(result.valid.is_empty());
    assert_eq!(result.errors.len(), 1);
    assert_eq!(result.errors[0].row, 1);
    assert_eq!(result.errors[0].field, "答案");
    assert_eq!(result.errors[0].message, "答案数量(1)与空栏数量(2)不匹配");
}

#[test]
fn toml_tools_parses_unquoted_chinese_keys_like_frontend_text_import() {
    let content = r#"
[[questions]]
题型 = "判断题"
题目 = "CSS Flexbox 主要用于一维布局。"
答案 = true
解析 = "Flexbox 适合处理一维方向上的布局"
"#;

    let result = parse_toml_content(content).expect("应兼容前端文本导入支持的中文字段写法");

    assert_eq!(result.total_rows, 1);
    assert_eq!(result.valid.len(), 1);
    assert!(result.errors.is_empty());
    assert_eq!(result.valid[0].r#type, "boolean");
    assert_eq!(result.valid[0].content, "CSS Flexbox 主要用于一维布局。");
    assert_eq!(result.valid[0].answer, "正确");
}

#[test]
fn toml_tools_reports_malformed_toml() {
    let error =
        parse_toml_content("[[questions]\ntype = \"single\"").expect_err("TOML 语法错误应返回错误");

    assert!(error.contains("TOML 格式错误"));
}
