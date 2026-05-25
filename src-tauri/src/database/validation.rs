use super::CreateQuestionInput;

const QUESTION_TYPES: [&str; 5] = ["single", "multiple", "boolean", "fill", "short"];

pub fn default_if_blank(value: &str, default_value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        default_value.to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn validate_non_blank(value: &str, message: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        Err(message.to_string())
    } else {
        Ok(trimmed.to_string())
    }
}

pub fn validate_messages(messages: &serde_json::Value) -> Result<(), String> {
    let Some(items) = messages.as_array() else {
        return Err("聊天记录不能为空".to_string());
    };

    if items.is_empty() {
        return Err("聊天记录不能为空".to_string());
    }

    Ok(())
}

pub fn normalize_description(description: Option<String>) -> Option<String> {
    description.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

pub fn validate_bank_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("题库名称不能为空".to_string());
    }

    if trimmed.chars().count() > 50 {
        return Err("题库名称长度不能超过50字符".to_string());
    }

    Ok(trimmed.to_string())
}

pub fn validate_question(question: &CreateQuestionInput) -> Result<(), String> {
    if !QUESTION_TYPES.contains(&question.r#type.as_str()) {
        return Err("无效的题型".to_string());
    }

    if question.content.trim().is_empty() {
        return Err("题干内容不能为空".to_string());
    }

    match question.r#type.as_str() {
        "single" => validate_single_choice(question),
        "multiple" => validate_multiple_choice(question),
        "boolean" => validate_boolean(question),
        "fill" => validate_fill_blank(question),
        "short" => validate_short_answer(question),
        _ => Err("无效的题型".to_string()),
    }
}

fn choice_options(question: &CreateQuestionInput) -> Result<&Vec<serde_json::Value>, String> {
    let options = question
        .options
        .as_ref()
        .and_then(|value| value.as_array())
        .ok_or_else(|| "选择题至少需要2个选项".to_string())?;

    if options.len() < 2 {
        return Err("选择题至少需要2个选项".to_string());
    }

    for (index, option) in options.iter().enumerate() {
        let id = option
            .get("id")
            .and_then(|value| value.as_str())
            .unwrap_or_default();
        let text = option
            .get("text")
            .and_then(|value| value.as_str())
            .unwrap_or_default();
        if id.trim().is_empty() || text.trim().is_empty() {
            return Err(format!("选项 {} 格式无效", index + 1));
        }
    }

    Ok(options)
}

fn option_ids(options: &[serde_json::Value]) -> Vec<&str> {
    options
        .iter()
        .filter_map(|option| option.get("id").and_then(|value| value.as_str()))
        .collect()
}

fn validate_single_choice(question: &CreateQuestionInput) -> Result<(), String> {
    let options = choice_options(question)?;
    if question.answer.trim().is_empty() {
        return Err("单选题必须设置正确答案".to_string());
    }

    let ids = option_ids(options);
    if !ids.contains(&question.answer.as_str()) {
        return Err("答案必须是有效的选项".to_string());
    }

    Ok(())
}

fn validate_multiple_choice(question: &CreateQuestionInput) -> Result<(), String> {
    let options = choice_options(question)?;
    if question.answer.trim().is_empty() {
        return Err("多选题必须设置正确答案".to_string());
    }

    let ids = option_ids(options);
    let answers = question
        .answer
        .split('|')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();

    if answers.is_empty() {
        return Err("多选题必须至少选择一个正确答案".to_string());
    }

    for answer in answers {
        if !ids.contains(&answer) {
            return Err(format!("答案 \"{answer}\" 不是有效的选项"));
        }
    }

    Ok(())
}

fn validate_boolean(question: &CreateQuestionInput) -> Result<(), String> {
    if matches!(question.answer.as_str(), "正确" | "错误") {
        Ok(())
    } else {
        Err("判断题答案必须是\"正确\"或\"错误\"".to_string())
    }
}

fn validate_fill_blank(question: &CreateQuestionInput) -> Result<(), String> {
    let blank_count = count_fill_blanks(&question.content);
    if blank_count == 0 {
        return Err("填空题题干中必须包含至少一个空栏标记（_、___、＿＿、（ ）或( )）".to_string());
    }

    if question.answer.trim().is_empty() {
        return Err("填空题必须设置答案".to_string());
    }

    let answers = question.answer.split('|').collect::<Vec<_>>();
    if answers.len() != blank_count {
        return Err(format!(
            "答案数量({})与空栏数量({blank_count})不匹配",
            answers.len()
        ));
    }

    for (index, answer) in answers.iter().enumerate() {
        if answer.trim().is_empty() {
            return Err(format!("第 {} 个空的答案不能为空", index + 1));
        }
    }

    Ok(())
}

fn validate_short_answer(question: &CreateQuestionInput) -> Result<(), String> {
    if question.answer.is_empty() {
        Ok(())
    } else if question.answer.trim().is_empty() {
        Err("答案必须是字符串".to_string())
    } else {
        Ok(())
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

pub fn options_to_json(options: &Option<serde_json::Value>) -> Result<Option<String>, String> {
    options
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|error| format!("序列化选项失败: {error}"))
}
