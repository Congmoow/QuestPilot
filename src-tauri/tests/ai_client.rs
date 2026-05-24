use questpilot_tauri_lib::ai::{
    build_chat_request, build_parse_request, detect_provider, normalize_ai_parse_result,
    parse_api_response, parse_json_from_ai_content, split_markdown_into_chunks, AiConfig,
    AiMessage,
};
use serde_json::json;

#[test]
fn ai_client_builds_openai_compatible_chat_request() {
    let config = AiConfig {
        api_key: "token-test".to_string(),
        api_url: "https://api.example.com".to_string(),
        model_id: "model-x".to_string(),
    };

    let request = build_chat_request(
        &config,
        vec![AiMessage {
            role: "user".to_string(),
            content: "解释二叉树".to_string(),
        }],
        Some("用考研导师风格回答。".to_string()),
    )
    .expect("应能构造聊天请求");

    assert_eq!(request.url, "https://api.example.com/v1/chat/completions");
    assert_eq!(
        request.headers.get("Authorization").map(String::as_str),
        Some("Bearer token-test")
    );
    assert_eq!(request.body["model"], "model-x");
    assert_eq!(request.body["messages"][0]["role"], "system");
    assert_eq!(
        request.body["messages"][0]["content"],
        "用考研导师风格回答。"
    );
    assert_eq!(request.body["messages"][1]["content"], "解释二叉树");
}

#[test]
fn ai_client_builds_gemini_parse_request() {
    let config = AiConfig {
        api_key: "gemini-key".to_string(),
        api_url: "https://generativelanguage.googleapis.com".to_string(),
        model_id: "gemini-1.5-flash".to_string(),
    };

    let request = build_parse_request(&config, "1. Rust 适合做什么？", Some("第 1/2 块"))
        .expect("应能构造解析请求");

    assert_eq!(detect_provider(&config.api_url), "gemini");
    assert_eq!(
        request.url,
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
    );
    assert_eq!(
        request.headers.get("x-goog-api-key").map(String::as_str),
        Some("gemini-key")
    );
    assert_eq!(request.body["contents"][0]["role"], "user");
    assert!(request.body["contents"][0]["parts"][0]["text"]
        .as_str()
        .expect("用户消息应为文本")
        .contains("第 1/2 块"));
}

#[test]
fn ai_client_parses_fenced_json_and_normalizes_questions() {
    let parsed = parse_json_from_ai_content(
        r#"```json
{
  "questions": [
    {
      "type": "单选题",
      "content": "CPU 主要由什么组成？",
      "options": ["A. 运算器", "B. 显示器"],
      "answer": "选项A"
    },
    {
      "type": "判断题",
      "content": "栈是先进先出结构。",
      "answer": false
    }
  ]
}
```"#,
    )
    .expect("应能解析围栏 JSON");

    let normalized = normalize_ai_parse_result(parsed);
    assert_eq!(normalized["questions"][0]["type"], "single");
    assert_eq!(normalized["questions"][0]["options"][0]["id"], "A");
    assert_eq!(normalized["questions"][0]["answer"], "A");
    assert_eq!(normalized["questions"][1]["type"], "boolean");
    assert_eq!(normalized["questions"][1]["answer"], "错误");
}

#[test]
fn ai_client_splits_markdown_by_question_boundaries() {
    let text = "## 第一组\n\n1. 第一题内容很长\n\n2. 第二题内容很长\n\n3. 第三题内容很长";
    let chunks = split_markdown_into_chunks(text, 28);

    assert!(chunks.len() >= 2);
    assert!(chunks[0].contains("第一组") || chunks[0].contains("第一题"));
    assert!(chunks.iter().all(|chunk| !chunk.trim().is_empty()));
}

#[test]
fn ai_client_parses_chat_response_and_errors() {
    let response = parse_api_response(
        json!({
            "choices": [
                { "message": { "content": "答案是 A。" } }
            ]
        }),
        "openai",
        false,
    )
    .expect("应能解析聊天响应");

    assert_eq!(response["message"], "答案是 A。");
    assert!(parse_api_response(
        json!({ "error": { "message": "Key 无效" } }),
        "openai",
        false,
    )
    .is_err());
}
