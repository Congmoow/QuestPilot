use serde::Serialize;

use crate::database::CreateQuestionInput;

const CHINESE_KEYS: [&str; 5] = ["题型", "题目", "选项", "答案", "解析"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TomlParseResult {
    pub valid: Vec<CreateQuestionInput>,
    pub errors: Vec<TomlParseError>,
    pub total_rows: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TomlParseError {
    pub row: usize,
    pub field: String,
    pub message: String,
}

pub fn parse_toml_content(content: &str) -> Result<TomlParseResult, String> {
    let normalized_content = quote_known_chinese_keys(content.trim_start_matches('\u{feff}'));
    let value = normalized_content
        .as_str()
        .parse::<toml::Value>()
        .map_err(|error| format!("TOML 格式错误: {error}"))?;
    let questions = value
        .get("questions")
        .and_then(toml::Value::as_array)
        .ok_or_else(|| "未能解析出有效的题目".to_string())?;

    let mut result = TomlParseResult {
        valid: Vec::new(),
        errors: Vec::new(),
        total_rows: questions.len(),
    };

    for (index, item) in questions.iter().enumerate() {
        match parse_question(item, index + 1) {
            Ok(question) => result.valid.push(question),
            Err(errors) => result.errors.extend(errors),
        }
    }

    Ok(result)
}

fn quote_known_chinese_keys(content: &str) -> String {
    let mut output = String::with_capacity(content.len());
    for (index, line) in content.lines().enumerate() {
        if index > 0 {
            output.push('\n');
        }
        output.push_str(quote_known_chinese_key_line(line).as_str());
    }
    if content.ends_with('\n') {
        output.push('\n');
    }
    output
}

fn quote_known_chinese_key_line(line: &str) -> String {
    let trimmed = line.trim_start_matches([' ', '\t']);
    let indent_len = line.len() - trimmed.len();
    let indent = &line[..indent_len];

    for key in CHINESE_KEYS {
        let Some(after_key) = trimmed.strip_prefix(key) else {
            continue;
        };
        let after_spaces = after_key.trim_start_matches([' ', '\t']);
        if after_spaces.starts_with('=') {
            let spaces_len = after_key.len() - after_spaces.len();
            return format!(
                "{indent}\"{key}\"{}{}",
                &after_key[..spaces_len],
                after_spaces
            );
        }
    }

    line.to_string()
}

fn parse_question(
    value: &toml::Value,
    row: usize,
) -> Result<CreateQuestionInput, Vec<TomlParseError>> {
    let Some(table) = value.as_table() else {
        return Err(vec![error(row, "题目", "题目必须是 TOML 表")]);
    };
    let mut errors = Vec::new();
    let type_text = get_string(table, &["type", "题型"]).unwrap_or_else(|| "short".to_string());
    let Some(question_type) = normalize_type(type_text.as_str()) else {
        errors.push(error(row, "题型", format!("无效的题型: {type_text}")));
        return Err(errors);
    };
    let content = get_string(table, &["content", "题目", "question"]).unwrap_or_default();
    if content.trim().is_empty() {
        errors.push(error(row, "题干", "题干不能为空"));
        return Err(errors);
    }

    let answer_value = get_value(table, &["answer", "答案"]);
    let answer = normalize_answer_value(answer_value);
    let analysis =
        get_string(table, &["analysis", "解析"]).filter(|value| !value.trim().is_empty());
    let mut question = CreateQuestionInput {
        r#type: question_type.to_string(),
        content,
        options: None,
        answer,
        analysis,
    };

    match question_type {
        "single" | "multiple" => {
            validate_choice_question(table, row, question_type, &mut question, &mut errors)
        }
        "boolean" => validate_boolean_answer(row, &mut question, &mut errors),
        "fill" => validate_fill_answer(row, &mut question, &mut errors),
        "short" => {}
        _ => {}
    }

    if errors.is_empty() {
        Ok(question)
    } else {
        Err(errors)
    }
}

fn validate_choice_question(
    table: &toml::map::Map<String, toml::Value>,
    row: usize,
    question_type: &str,
    question: &mut CreateQuestionInput,
    errors: &mut Vec<TomlParseError>,
) {
    let options = normalize_options(get_value(table, &["options", "选项"]));
    if options.len() < 2 {
        errors.push(error(row, "选项", "选择题至少需要2个选项"));
        return;
    }
    let ids = options
        .iter()
        .filter_map(|option| option.get("id").and_then(serde_json::Value::as_str))
        .collect::<Vec<_>>();
    let normalized_answer =
        normalize_choice_answer(question.answer.as_str(), question_type == "multiple");
    if normalized_answer.is_empty() {
        errors.push(error(row, "答案", "选择题必须设置答案"));
        return;
    }
    let answer_ids = normalized_answer
        .split('|')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    if question_type == "single" && answer_ids.len() > 1 {
        errors.push(error(row, "答案", "单选题只能有一个答案"));
        return;
    }
    for id in &answer_ids {
        if !ids.contains(id) {
            errors.push(error(row, "答案", format!("答案 \"{id}\" 不是有效选项")));
            return;
        }
    }
    question.answer = normalized_answer;
    question.options = Some(serde_json::Value::Array(options));
}

fn validate_boolean_answer(
    row: usize,
    question: &mut CreateQuestionInput,
    errors: &mut Vec<TomlParseError>,
) {
    let raw = question.answer.trim();
    let lower = raw.to_lowercase();
    question.answer = match raw {
        "正确" | "对" | "是" | "√" | "1" => "正确".to_string(),
        "错误" | "错" | "否" | "×" | "0" => "错误".to_string(),
        _ if matches!(lower.as_str(), "true" | "t" | "yes" | "y") => "正确".to_string(),
        _ if matches!(lower.as_str(), "false" | "f" | "no" | "n") => "错误".to_string(),
        _ => {
            errors.push(error(row, "答案", "判断题答案必须是“正确”或“错误”"));
            return;
        }
    };
}

fn validate_fill_answer(
    row: usize,
    question: &mut CreateQuestionInput,
    errors: &mut Vec<TomlParseError>,
) {
    let blank_count = count_fill_blanks(&question.content);
    if blank_count == 0 {
        errors.push(error(row, "题干", "填空题题干必须包含空栏标记"));
        return;
    }
    if blank_count > 1 && !question.answer.contains('|') {
        question.answer = question.answer.replace([',', '，', '、', ';', '；'], "|");
    }
    let answer_count = question.answer.split('|').count();
    if answer_count != blank_count {
        errors.push(error(
            row,
            "答案",
            format!("答案数量({answer_count})与空栏数量({blank_count})不匹配"),
        ));
    }
}

fn normalize_options(value: Option<&toml::Value>) -> Vec<serde_json::Value> {
    value
        .and_then(toml::Value::as_array)
        .map(|items| {
            items
                .iter()
                .enumerate()
                .filter_map(|(index, item)| normalize_option(item, index))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn normalize_option(value: &toml::Value, index: usize) -> Option<serde_json::Value> {
    if let Some(text) = value.as_str() {
        let trimmed = text.trim();
        if let Some((id, option_text)) = split_option_label(trimmed) {
            return Some(serde_json::json!({ "id": id, "text": option_text }));
        }
        return Some(serde_json::json!({
            "id": option_id(index),
            "text": trimmed,
        }));
    }
    let table = value.as_table()?;
    let id = get_string(table, &["id", "ID"]).unwrap_or_else(|| option_id(index));
    let text = get_string(table, &["text", "Text", "文本", "内容"]).unwrap_or_default();
    (!text.trim().is_empty()).then(|| serde_json::json!({ "id": id, "text": text }))
}

fn split_option_label(value: &str) -> Option<(String, String)> {
    let mut chars = value.chars();
    let first = chars.next()?;
    if !first.is_ascii_uppercase() {
        return None;
    }
    let rest = chars.as_str().trim_start();
    let mut rest_chars = rest.chars();
    let separator = rest_chars.next()?;
    if matches!(separator, '.' | '、' | '．' | ':' | '：' | ')') {
        let text = rest_chars.as_str().trim_start();
        if !text.is_empty() {
            return Some((first.to_string(), text.to_string()));
        }
    }
    None
}

fn normalize_choice_answer(answer: &str, multiple: bool) -> String {
    let normalized = answer
        .trim()
        .to_uppercase()
        .replace(['，', ',', '、', ';', '；', ' '], "|");
    let mut letters = Vec::new();
    for part in normalized
        .split('|')
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if part.chars().all(|ch| ch.is_ascii_uppercase()) {
            letters.extend(part.chars().map(|ch| ch.to_string()));
        } else if let Some(letter) = part.chars().find(char::is_ascii_uppercase) {
            letters.push(letter.to_string());
        }
    }
    let mut unique = Vec::new();
    for letter in letters {
        if !unique.contains(&letter) {
            unique.push(letter);
        }
    }
    if multiple {
        unique.join("|")
    } else {
        unique
            .first()
            .cloned()
            .unwrap_or_else(|| answer.trim().to_string())
    }
}

fn normalize_answer_value(value: Option<&toml::Value>) -> String {
    match value {
        Some(toml::Value::Array(items)) => items
            .iter()
            .filter_map(|item| match item {
                toml::Value::String(value) => Some(value.clone()),
                toml::Value::Integer(value) => Some(value.to_string()),
                toml::Value::Boolean(value) => {
                    Some(if *value { "true" } else { "false" }.to_string())
                }
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("|"),
        Some(toml::Value::String(value)) => value.clone(),
        Some(toml::Value::Integer(value)) => value.to_string(),
        Some(toml::Value::Boolean(value)) => {
            if *value {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        Some(value) => value.to_string(),
        None => String::new(),
    }
}

fn get_value<'a>(
    table: &'a toml::map::Map<String, toml::Value>,
    keys: &[&str],
) -> Option<&'a toml::Value> {
    keys.iter().find_map(|key| table.get(*key))
}

fn get_string(table: &toml::map::Map<String, toml::Value>, keys: &[&str]) -> Option<String> {
    get_value(table, keys).and_then(|value| match value {
        toml::Value::String(value) => Some(value.clone()),
        toml::Value::Integer(value) => Some(value.to_string()),
        toml::Value::Boolean(value) => Some(value.to_string()),
        _ => None,
    })
}

fn normalize_type(value: &str) -> Option<&'static str> {
    match value.trim() {
        "单选题" | "单选" | "single" => Some("single"),
        "多选题" | "多选" | "multiple" => Some("multiple"),
        "判断题" | "判断" | "boolean" => Some("boolean"),
        "填空题" | "填空" | "fill" => Some("fill"),
        "简答题" | "简答" | "short" => Some("short"),
        _ => None,
    }
}

fn count_fill_blanks(content: &str) -> usize {
    let chars = content.chars().collect::<Vec<_>>();
    let mut count = 0;
    let mut index = 0;

    while index < chars.len() {
        match chars[index] {
            '_' | '＿' => {
                count += 1;
                let current = chars[index];
                while index < chars.len() && chars[index] == current {
                    index += 1;
                }
            }
            '（' => {
                let mut cursor = index + 1;
                while cursor < chars.len() && chars[cursor].is_whitespace() {
                    cursor += 1;
                }
                if cursor < chars.len() && chars[cursor] == '）' {
                    count += 1;
                    index = cursor + 1;
                } else {
                    index += 1;
                }
            }
            '(' => {
                let mut cursor = index + 1;
                while cursor < chars.len() && chars[cursor].is_whitespace() {
                    cursor += 1;
                }
                if cursor < chars.len() && chars[cursor] == ')' {
                    count += 1;
                    index = cursor + 1;
                } else {
                    index += 1;
                }
            }
            _ => index += 1,
        }
    }

    count
}

fn option_id(index: usize) -> String {
    char::from_u32('A' as u32 + index as u32)
        .unwrap_or('A')
        .to_string()
}

fn error(row: usize, field: &str, message: impl Into<String>) -> TomlParseError {
    TomlParseError {
        row,
        field: field.to_string(),
        message: message.into(),
    }
}
