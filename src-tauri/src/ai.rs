use std::collections::BTreeMap;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use url::Url;

const MAX_OUTPUT_TOKENS: u64 = 8192;
const JSON_ERROR_PREVIEW_LENGTH: usize = 500;
const DEFAULT_MAX_CHARS_PER_CHUNK: usize = 3000;

#[derive(Debug, Clone)]
pub struct AiConfig {
    pub api_key: String,
    pub api_url: String,
    pub model_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct AiRequest {
    pub url: String,
    pub headers: BTreeMap<String, String>,
    pub body: Value,
    pub provider: String,
    pub expect_json: bool,
}

pub fn build_chat_request(
    config: &AiConfig,
    messages: Vec<AiMessage>,
    custom_prompt: Option<String>,
) -> Result<AiRequest, String> {
    let model_name = default_model(config.model_id.as_str());
    let system_prompt = custom_prompt.filter(|value| !value.trim().is_empty()).unwrap_or_else(|| {
        format!(
            "你是 {model_name} 大语言模型，是一个智能学习助手，专门帮助用户解答学习相关的问题。\n\n请用简洁清晰的语言回答，必要时可以使用示例来说明。"
        )
    });

    let mut final_messages = vec![json!({
        "role": "system",
        "content": system_prompt,
    })];
    final_messages.extend(messages.into_iter().map(|message| {
        json!({
            "role": message.role,
            "content": message.content,
        })
    }));

    let body = json!({
        "model": model_name,
        "messages": final_messages,
        "temperature": 0.7,
        "max_tokens": 2048,
    });

    build_provider_request(config, body, false)
}

pub fn build_parse_request(
    config: &AiConfig,
    content: &str,
    chunk_hint: Option<&str>,
) -> Result<AiRequest, String> {
    let system_prompt = parse_system_prompt();
    let hint = chunk_hint
        .filter(|value| !value.trim().is_empty())
        .map(|value| {
            format!("\n\n当前输入分块：{value}。请只解析本块中的题目，不要编造其他分块内容。")
        })
        .unwrap_or_default();
    let user_content = format!("请解析以下题目：{hint}\n\n{content}");
    let body = json!({
        "model": default_model(config.model_id.as_str()),
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_content }
        ],
        "temperature": 0.1,
        "max_tokens": MAX_OUTPUT_TOKENS,
    });

    build_provider_request(config, body, true)
}

pub fn test_connection(config: &AiConfig) -> Result<Value, String> {
    let body = json!({
        "model": default_model(config.model_id.as_str()),
        "messages": [
            { "role": "user", "content": "你好" }
        ],
        "max_tokens": 10,
    });
    let request = build_provider_request(config, body, false)?;
    send_request(&request)
}

pub fn chat_with_ai(
    config: &AiConfig,
    messages: Vec<AiMessage>,
    custom_prompt: Option<String>,
) -> Result<Value, String> {
    if messages.is_empty() {
        return Err("请输入问题".to_string());
    }
    let request = build_chat_request(config, messages, custom_prompt)?;
    send_request(&request)
}

pub fn parse_questions_with_ai(config: &AiConfig, content: &str) -> Result<Value, String> {
    let chunks = split_markdown_into_chunks(content, DEFAULT_MAX_CHARS_PER_CHUNK);
    if chunks.is_empty() {
        return Err("请输入要解析的题目内容".to_string());
    }

    let total = chunks.len();
    let mut questions = Vec::new();
    let mut chunk_errors = Vec::new();
    let mut success = 0usize;

    for (index, chunk) in chunks.iter().enumerate() {
        let hint = format!("第 {}/{} 块", index + 1, total);
        match build_parse_request(config, chunk, Some(hint.as_str()))
            .and_then(|request| send_request(&request))
        {
            Ok(result) => {
                if let Some(items) = result.get("questions").and_then(Value::as_array) {
                    questions.extend(items.iter().cloned());
                }
                success += 1;
            }
            Err(error) => {
                chunk_errors.push(json!({
                    "chunkIndex": index,
                    "message": error,
                }));
            }
        }
    }

    Ok(normalize_ai_parse_result(json!({
        "questions": questions,
        "chunkErrors": chunk_errors,
        "chunks": {
            "total": total,
            "success": success,
        }
    })))
}

pub fn detect_provider(base_url: &str) -> &'static str {
    if base_url.contains("anthropic.com") {
        "anthropic"
    } else if base_url.contains("generativelanguage.googleapis.com") {
        "gemini"
    } else {
        "openai"
    }
}

pub fn parse_api_response(
    response: Value,
    provider: &str,
    expect_json: bool,
) -> Result<Value, String> {
    if let Some(error) = response.get("error") {
        return Err(error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("API 调用失败")
            .to_string());
    }

    let content = extract_response_content(&response, provider)?;
    if !expect_json {
        return Ok(json!({
            "success": true,
            "message": content,
            "content": content,
        }));
    }

    parse_json_from_ai_content(content.as_str())
}

pub fn parse_json_from_ai_content(content: &str) -> Result<Value, String> {
    let candidates = extract_json_candidates(content);
    let mut last_error = None;

    for candidate in &candidates {
        match serde_json::from_str::<Value>(candidate) {
            Ok(value) => return Ok(value),
            Err(error) => last_error = Some(error.to_string()),
        }
    }

    if is_likely_truncated_json(content)
        || candidates
            .iter()
            .any(|candidate| is_likely_truncated_json(candidate))
    {
        return Err(format!(
            "AI 输出疑似被截断，请减少单次粘贴内容或提高 max_tokens。原始返回内容：{}",
            preview_content(content)
        ));
    }

    if let Some(error) = last_error {
        return Err(format!(
            "AI 返回非合法 JSON: {error}。原始返回内容：{}",
            preview_content(content)
        ));
    }

    Err(format!(
        "AI 返回非合法 JSON，未找到可解析的 JSON 内容。原始返回内容：{}",
        preview_content(content)
    ))
}

pub fn normalize_ai_parse_result(result: Value) -> Value {
    let questions = result
        .get("questions")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(normalize_ai_question)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let mut output = result;
    if let Some(object) = output.as_object_mut() {
        object.insert("questions".to_string(), Value::Array(questions));
    }
    output
}

pub fn split_markdown_into_chunks(content: &str, max_chars_per_chunk: usize) -> Vec<String> {
    let max_chars = max_chars_per_chunk.max(1);
    let text = content
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .trim()
        .to_string();
    if text.is_empty() {
        return Vec::new();
    }
    if text.chars().count() <= max_chars {
        return vec![text];
    }

    let boundaries = collect_boundaries(&text);
    let chars = text.chars().collect::<Vec<_>>();
    let mut chunks = Vec::new();
    let mut start = 0usize;

    while start < chars.len() {
        let remaining = chars.len() - start;
        if remaining <= max_chars {
            push_chunk(&mut chunks, chars[start..].iter().collect::<String>());
            break;
        }

        let limit = start + max_chars;
        let split_at = choose_boundary(&boundaries, start, limit).unwrap_or(limit);
        push_chunk(
            &mut chunks,
            chars[start..split_at].iter().collect::<String>(),
        );
        start = skip_leading_whitespace(&chars, split_at);
    }

    chunks
}

fn build_provider_request(
    config: &AiConfig,
    body: Value,
    expect_json: bool,
) -> Result<AiRequest, String> {
    if config.api_key.trim().is_empty() {
        return Err("请先配置 API Key".to_string());
    }

    let provider = detect_provider(config.api_url.as_str()).to_string();
    let (url, final_body, auth_header, auth_value) = match provider.as_str() {
        "anthropic" => (
            join_url(config.api_url.as_str(), "/v1/messages")?,
            format_anthropic_body(body),
            "x-api-key".to_string(),
            config.api_key.clone(),
        ),
        "gemini" => (
            join_url(
                config.api_url.as_str(),
                format!(
                    "/v1beta/models/{}:generateContent",
                    default_model(config.model_id.as_str())
                )
                .as_str(),
            )?,
            format_gemini_body(body),
            "x-goog-api-key".to_string(),
            config.api_key.clone(),
        ),
        _ => (
            openai_chat_url(config.api_url.as_str())?,
            body,
            "Authorization".to_string(),
            format!("Bearer {}", config.api_key),
        ),
    };

    let mut headers = BTreeMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());
    headers.insert(auth_header, auth_value);
    if provider == "anthropic" {
        headers.insert("anthropic-version".to_string(), "2023-06-01".to_string());
    }

    Ok(AiRequest {
        url,
        headers,
        body: final_body,
        provider,
        expect_json,
    })
}

fn send_request(request: &AiRequest) -> Result<Value, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|error| format!("创建 AI 请求客户端失败: {error}"))?;
    let mut builder = client.post(request.url.as_str()).json(&request.body);

    for (key, value) in &request.headers {
        builder = builder.header(key.as_str(), value.as_str());
    }

    let response = builder
        .send()
        .map_err(|error| format!("网络请求失败: {error}"))?;
    let status = response.status();
    let data = response
        .json::<Value>()
        .map_err(|error| format!("解析响应失败: {error}"))?;

    if !status.is_success() {
        if let Some(message) = data
            .get("error")
            .and_then(|error| error.get("message"))
            .and_then(Value::as_str)
        {
            return Err(message.to_string());
        }
        return Err(format!("API 请求失败，状态码：{status}"));
    }

    parse_api_response(data, request.provider.as_str(), request.expect_json)
}

fn openai_chat_url(base_url: &str) -> Result<String, String> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.contains("/v1/chat/completions") {
        validate_url(trimmed)
    } else {
        join_url(trimmed, "/v1/chat/completions")
    }
}

fn join_url(base_url: &str, path: &str) -> Result<String, String> {
    let full = format!("{}{}", base_url.trim().trim_end_matches('/'), path);
    validate_url(full.as_str())
}

fn validate_url(value: &str) -> Result<String, String> {
    Url::parse(value)
        .map(|_| value.to_string())
        .map_err(|_| format!("无效的 API URL: {value}"))
}

fn format_anthropic_body(body: Value) -> Value {
    let messages = body
        .get("messages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let system = messages
        .iter()
        .find(|message| message.get("role").and_then(Value::as_str) == Some("system"))
        .and_then(|message| message.get("content").and_then(Value::as_str))
        .unwrap_or_default()
        .to_string();
    let filtered = messages
        .into_iter()
        .filter(|message| message.get("role").and_then(Value::as_str) != Some("system"))
        .map(|message| {
            let role = if message.get("role").and_then(Value::as_str) == Some("assistant") {
                "assistant"
            } else {
                "user"
            };
            json!({
                "role": role,
                "content": message.get("content").and_then(Value::as_str).unwrap_or_default(),
            })
        })
        .collect::<Vec<_>>();

    json!({
        "model": body.get("model").cloned().unwrap_or_else(|| json!("minimax-m2")),
        "max_tokens": body.get("max_tokens").cloned().unwrap_or_else(|| json!(MAX_OUTPUT_TOKENS)),
        "messages": filtered,
        "system": system,
    })
}

fn format_gemini_body(body: Value) -> Value {
    let messages = body
        .get("messages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let system = messages
        .iter()
        .find(|message| message.get("role").and_then(Value::as_str) == Some("system"))
        .and_then(|message| message.get("content").and_then(Value::as_str))
        .map(str::to_string);
    let contents = messages
        .into_iter()
        .filter(|message| message.get("role").and_then(Value::as_str) != Some("system"))
        .map(|message| {
            let role = if message.get("role").and_then(Value::as_str) == Some("assistant") {
                "model"
            } else {
                "user"
            };
            json!({
                "role": role,
                "parts": [
                    { "text": message.get("content").and_then(Value::as_str).unwrap_or_default() }
                ],
            })
        })
        .collect::<Vec<_>>();
    let mut result = json!({
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": body.get("max_tokens").cloned().unwrap_or_else(|| json!(MAX_OUTPUT_TOKENS)),
            "temperature": body.get("temperature").cloned().unwrap_or_else(|| json!(0.7)),
        }
    });

    if let Some(system) = system {
        result["systemInstruction"] = json!({
            "parts": [{ "text": system }]
        });
    }

    result
}

fn extract_response_content(response: &Value, provider: &str) -> Result<String, String> {
    match provider {
        "anthropic" => response
            .get("content")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("text"))
            .and_then(Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| "Claude API 返回格式异常".to_string()),
        "gemini" => response
            .get("candidates")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("content"))
            .and_then(|content| content.get("parts"))
            .and_then(Value::as_array)
            .and_then(|parts| parts.first())
            .and_then(|part| part.get("text"))
            .and_then(Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| "Gemini API 返回格式异常".to_string()),
        _ => response
            .get("choices")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| "API 返回格式异常".to_string()),
    }
}

fn extract_json_candidates(content: &str) -> Vec<String> {
    let mut candidates = Vec::new();
    if let Some(fenced) = extract_json_fence(content) {
        candidates.push(fenced);
    }

    if let (Some(first), Some(last)) = (content.find('{'), content.rfind('}')) {
        if last > first {
            let braced = content[first..=last].trim().to_string();
            if !braced.is_empty() && !candidates.contains(&braced) {
                candidates.push(braced);
            }
        }
    }

    let trimmed = content.trim().to_string();
    if !trimmed.is_empty() && !candidates.contains(&trimmed) {
        candidates.push(trimmed);
    }

    candidates
}

fn extract_json_fence(content: &str) -> Option<String> {
    let marker = content
        .find("```json")
        .or_else(|| content.find("```JSON"))?;
    let after_marker = &content[marker..];
    let first_newline = after_marker.find('\n')?;
    let body_start = marker + first_newline + 1;
    let body = &content[body_start..];
    let end = body.rfind("```")?;
    let fenced = body[..end].trim().to_string();
    if fenced.is_empty() {
        None
    } else {
        Some(fenced)
    }
}

fn is_likely_truncated_json(content: &str) -> bool {
    let value = content.trim();
    if value.is_empty() {
        return false;
    }
    value.ends_with(',') || has_unclosed_json_string(value)
}

fn has_unclosed_json_string(value: &str) -> bool {
    let mut in_string = false;
    let mut escaped = false;

    for char in value.chars() {
        if escaped {
            escaped = false;
            continue;
        }
        if char == '\\' {
            escaped = true;
            continue;
        }
        if char == '"' {
            in_string = !in_string;
        }
    }

    in_string
}

fn preview_content(content: &str) -> String {
    content
        .trim()
        .chars()
        .take(JSON_ERROR_PREVIEW_LENGTH)
        .collect()
}

fn normalize_ai_question(question: &Value) -> Option<Value> {
    let object = question.as_object()?;
    let mut normalized = object.clone();
    let question_type = normalize_ai_type(
        object
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    );
    normalized.insert("type".to_string(), Value::String(question_type.clone()));

    let options = object.get("options").cloned().unwrap_or(Value::Null);
    if matches!(question_type.as_str(), "single" | "multiple") {
        normalized.insert("options".to_string(), normalize_ai_options(options.clone()));
    }

    let answer = object.get("answer").cloned().unwrap_or(Value::Null);
    let option_ids = normalized
        .get("options")
        .and_then(Value::as_array)
        .map(|items| option_ids(items.as_slice()))
        .unwrap_or_default();
    normalized.insert(
        "answer".to_string(),
        Value::String(normalize_ai_answer(
            question_type.as_str(),
            &answer,
            &option_ids,
        )),
    );

    Some(Value::Object(normalized))
}

fn normalize_ai_type(value: &str) -> String {
    match value.trim() {
        "单选题" | "单选" | "single" => "single",
        "多选题" | "多选" | "multiple" => "multiple",
        "判断题" | "判断" | "boolean" => "boolean",
        "填空题" | "填空" | "fill" => "fill",
        "简答题" | "简答" | "short" => "short",
        other => other,
    }
    .to_string()
}

fn normalize_ai_options(options: Value) -> Value {
    let Some(items) = options.as_array() else {
        return options;
    };

    Value::Array(
        items
            .iter()
            .enumerate()
            .filter_map(normalize_ai_option)
            .collect(),
    )
}

fn normalize_ai_option((index, option): (usize, &Value)) -> Option<Value> {
    let fallback_id = ((b'A' + index as u8) as char).to_string();
    if let Some(raw) = option
        .as_str()
        .or_else(|| option.as_i64().map(|_| "").filter(|_| false))
    {
        let value = raw.trim();
        if value.is_empty() {
            return None;
        }
        if let Some((id, text)) = split_option_text(value) {
            return Some(json!({ "id": id, "text": text }));
        }
        return Some(json!({ "id": fallback_id, "text": value }));
    }

    if let Some(number) = option.as_i64() {
        return Some(json!({ "id": fallback_id, "text": number.to_string() }));
    }

    let object = option.as_object()?;
    let id = object
        .get("id")
        .and_then(Value::as_str)
        .and_then(extract_option_letter)
        .unwrap_or(fallback_id);
    let text = object
        .get("text")
        .or_else(|| object.get("content"))
        .or_else(|| object.get("label"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    Some(json!({ "id": id, "text": text }))
}

fn split_option_text(value: &str) -> Option<(String, String)> {
    let mut chars = value.chars();
    let first = chars.next()?.to_ascii_uppercase();
    if !first.is_ascii_alphabetic() {
        return None;
    }
    let rest = chars.as_str().trim_start();
    let separators = ['.', '、', '．', ':', '：', ')'];
    if separators
        .iter()
        .any(|separator| rest.starts_with(*separator))
    {
        let text = rest[1..].trim().to_string();
        return Some((first.to_string(), text));
    }
    None
}

fn normalize_ai_answer(question_type: &str, answer: &Value, option_ids: &[String]) -> String {
    match question_type {
        "single" => normalize_single_answer(answer, option_ids),
        "multiple" => normalize_multiple_answer(answer, option_ids),
        "boolean" => normalize_boolean_answer(answer),
        "fill" => normalize_fill_answer(answer),
        _ => value_to_string(answer),
    }
}

fn normalize_single_answer(answer: &Value, option_ids: &[String]) -> String {
    let value = value_to_string(answer);
    if value.trim().is_empty() {
        return value;
    }
    extract_option_letter_with_allowed(value.as_str(), option_ids)
        .unwrap_or_else(|| value.to_uppercase())
}

fn normalize_multiple_answer(answer: &Value, option_ids: &[String]) -> String {
    let parts = if let Some(items) = answer.as_array() {
        items.iter().map(value_to_string).collect::<Vec<_>>()
    } else {
        split_answer_parts(value_to_string(answer).as_str())
    };
    let mut letters = Vec::new();

    for part in parts {
        let value = part.trim();
        if value.is_empty() {
            continue;
        }
        let compact = value.to_ascii_uppercase();
        if compact.chars().all(|char| char.is_ascii_alphabetic()) && compact.len() > 1 {
            for char in compact.chars() {
                let id = char.to_string();
                if option_ids.is_empty() || option_ids.contains(&id) {
                    letters.push(id);
                }
            }
            continue;
        }
        if let Some(letter) = extract_option_letter_with_allowed(value, option_ids) {
            letters.push(letter);
        }
    }

    let mut seen = Vec::<String>::new();
    letters
        .into_iter()
        .filter(|letter| {
            if seen.contains(letter) {
                false
            } else {
                seen.push(letter.clone());
                true
            }
        })
        .collect::<Vec<_>>()
        .join("|")
}

fn normalize_boolean_answer(answer: &Value) -> String {
    if answer.as_bool() == Some(true) {
        return "正确".to_string();
    }
    if answer.as_bool() == Some(false) {
        return "错误".to_string();
    }

    let value = value_to_string(answer);
    let lower = value.to_lowercase();
    if ["正确", "对", "是", "√", "true", "t", "yes", "y", "1"].contains(&value.as_str())
        || ["true", "t", "yes", "y", "1"].contains(&lower.as_str())
    {
        return "正确".to_string();
    }
    if ["错误", "错", "否", "×", "false", "f", "no", "n", "0"].contains(&value.as_str())
        || ["false", "f", "no", "n", "0"].contains(&lower.as_str())
    {
        return "错误".to_string();
    }
    value
}

fn normalize_fill_answer(answer: &Value) -> String {
    if let Some(items) = answer.as_array() {
        return items
            .iter()
            .map(value_to_string)
            .map(|value| value.trim().to_string())
            .collect::<Vec<_>>()
            .join("|");
    }
    value_to_string(answer)
}

fn split_answer_parts(value: &str) -> Vec<String> {
    value
        .replace(['，', ',', '、', ';', '；', ' '], "|")
        .split('|')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(str::to_string)
        .collect()
}

fn option_ids(options: &[Value]) -> Vec<String> {
    options
        .iter()
        .filter_map(|option| option.get("id").and_then(Value::as_str))
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(str::to_ascii_uppercase)
        .collect()
}

fn extract_option_letter(value: &str) -> Option<String> {
    extract_option_letter_with_allowed(value, &[])
}

fn extract_option_letter_with_allowed(value: &str, allowed_ids: &[String]) -> Option<String> {
    let trimmed = value.trim().to_ascii_uppercase();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.len() == 1
        && trimmed.chars().all(|char| char.is_ascii_alphabetic())
        && (allowed_ids.is_empty() || allowed_ids.contains(&trimmed))
    {
        return Some(trimmed);
    }

    let first = trimmed.chars().next()?;
    if first.is_ascii_alphabetic() {
        let id = first.to_string();
        if allowed_ids.is_empty() || allowed_ids.contains(&id) {
            return Some(id);
        }
    }

    for id in allowed_ids {
        if trimmed.contains(id) {
            return Some(id.clone());
        }
    }

    None
}

fn value_to_string(value: &Value) -> String {
    if let Some(text) = value.as_str() {
        return text.trim().to_string();
    }
    if let Some(boolean) = value.as_bool() {
        return boolean.to_string();
    }
    if let Some(number) = value.as_i64() {
        return number.to_string();
    }
    if value.is_null() {
        return String::new();
    }
    value.to_string()
}

fn collect_boundaries(text: &str) -> Vec<(usize, u8)> {
    let mut boundaries = Vec::new();
    let mut offset = 0usize;
    let lines = text.lines().collect::<Vec<_>>();

    for (index, line) in lines.iter().enumerate() {
        if is_top_heading(line) {
            boundaries.push((offset, 1));
        }
        if is_question_line(line) {
            boundaries.push((offset, 2));
            if index > 0 && lines[index - 1].trim().is_empty() {
                let blank_start = offset.saturating_sub(lines[index - 1].chars().count() + 1);
                boundaries.push((blank_start, 3));
            }
        }
        offset += line.chars().count() + 1;
    }

    boundaries
        .into_iter()
        .filter(|(position, _)| *position > 0)
        .collect()
}

fn choose_boundary(boundaries: &[(usize, u8)], start: usize, limit: usize) -> Option<usize> {
    let mut candidates = boundaries
        .iter()
        .copied()
        .filter(|(position, _)| *position > start && *position <= limit)
        .collect::<Vec<_>>();
    candidates.sort_by(|a, b| a.1.cmp(&b.1).then_with(|| b.0.cmp(&a.0)));
    candidates.first().map(|(position, _)| *position)
}

fn push_chunk(chunks: &mut Vec<String>, chunk: String) {
    let value = chunk.trim().to_string();
    if !value.is_empty() {
        chunks.push(value);
    }
}

fn skip_leading_whitespace(chars: &[char], mut index: usize) -> usize {
    while index < chars.len() && chars[index].is_whitespace() {
        index += 1;
    }
    index
}

fn is_top_heading(line: &str) -> bool {
    let trimmed = line.trim_start();
    trimmed.starts_with("# ") || trimmed.starts_with("## ")
}

fn is_question_line(line: &str) -> bool {
    let trimmed = line.trim_start();
    let lower = trimmed.to_ascii_lowercase();
    lower.starts_with('q')
        || lower.starts_with("第")
        || lower.starts_with("【")
        || lower.starts_with("(")
        || lower.starts_with("（")
        || trimmed
            .chars()
            .next()
            .map(|char| char.is_ascii_digit())
            .unwrap_or(false)
}

fn default_model(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "minimax-m2".to_string()
    } else {
        trimmed.to_string()
    }
}

fn parse_system_prompt() -> &'static str {
    r#"你是一个专业的题目解析助手。用户会给你一段包含多道题目的文本，你需要将其解析为结构化的 JSON 格式。

请严格按照以下 JSON 格式输出，不要输出任何其他内容：
{
  "questions": [
    {
      "type": "single|multiple|boolean|fill|short",
      "content": "题干内容",
      "options": [
        {"id": "A", "text": "选项A内容"},
        {"id": "B", "text": "选项B内容"}
      ],
      "answer": "答案",
      "analysis": "解析（如果有）"
    }
  ]
}

题型说明：
- single: 单选题，answer 为单个选项如 "A"
- multiple: 多选题，answer 为多个选项用|分隔如 "A|B|C"
- boolean: 判断题，answer 为 "正确" 或 "错误"，不需要 options
- fill: 填空题，题干中用 ___、_、＿＿、（ ）或( ) 表示空，answer 为答案用|分隔（多个空时），不需要 options
- short: 简答题，answer 为参考答案，不需要 options

注意事项：
1. 选择题必须有 options 数组
2. 判断题、填空题、简答题不需要 options
3. 不确定题型时优先保留题干并按 short 输出，answer 可为空字符串
4. 只输出 JSON，不要有任何解释文字"#
}
