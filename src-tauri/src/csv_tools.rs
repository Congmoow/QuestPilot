use std::io::Cursor;

use serde::Serialize;

use crate::database::{CreateQuestionInput, Question};

const CSV_HEADERS: [&str; 10] = [
    "题型", "题干", "选项A", "选项B", "选项C", "选项D", "选项E", "选项F", "答案", "解析",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvParseResult {
    pub valid: Vec<CreateQuestionInput>,
    pub errors: Vec<CsvParseError>,
    pub total_rows: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvParseError {
    pub row: usize,
    pub field: String,
    pub message: String,
}

pub fn generate_template() -> Result<String, String> {
    let rows = [
        [
            "单选题",
            "以下哪个是 JavaScript 的基本数据类型？",
            "String",
            "Array",
            "Object",
            "Function",
            "",
            "",
            "A",
            "字符串是 JavaScript 的基本数据类型",
        ],
        [
            "多选题",
            "以下哪些是前端框架？",
            "React",
            "Vue",
            "Node.js",
            "Angular",
            "",
            "",
            "A|B|D",
            "React、Vue 和 Angular 都是前端框架",
        ],
        [
            "判断题",
            "JavaScript 是一门强类型语言。",
            "",
            "",
            "",
            "",
            "",
            "",
            "错误",
            "JavaScript 是弱类型语言",
        ],
        [
            "填空题",
            "HTML 的全称是___，CSS 的全称是___。",
            "",
            "",
            "",
            "",
            "",
            "",
            "HyperText Markup Language|Cascading Style Sheets",
            "",
        ],
        [
            "简答题",
            "请简述什么是闭包？",
            "",
            "",
            "",
            "",
            "",
            "",
            "闭包是指有权访问另一个函数作用域中变量的函数",
            "",
        ],
    ];

    write_csv_rows(rows.iter().map(|row| row.iter().copied()))
}

pub fn parse_csv_content(content: &str) -> Result<CsvParseResult, String> {
    let normalized = content.trim_start_matches('\u{feff}');
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(Cursor::new(normalized.as_bytes()));

    let mut rows = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|error| format!("CSV 解析错误: {error}"))?;
        rows.push(
            record
                .iter()
                .map(str::trim)
                .map(str::to_string)
                .collect::<Vec<_>>(),
        );
    }

    let start_index = if rows
        .first()
        .and_then(|row| row.first())
        .is_some_and(|value| value == "题型")
    {
        1
    } else {
        0
    };

    let mut result = CsvParseResult {
        valid: Vec::new(),
        errors: Vec::new(),
        total_rows: rows.len().saturating_sub(start_index),
    };

    for (index, row) in rows.into_iter().enumerate().skip(start_index) {
        if row.iter().all(|cell| cell.trim().is_empty()) {
            result.total_rows = result.total_rows.saturating_sub(1);
            continue;
        }

        match parse_row(row.as_slice(), index + 1) {
            Ok(question) => result.valid.push(question),
            Err(errors) => result.errors.extend(errors),
        }
    }

    Ok(result)
}

pub fn export_questions_to_csv(questions: &[Question]) -> Result<String, String> {
    write_csv_rows(questions.iter().map(question_to_row))
}

fn parse_row(row: &[String], row_number: usize) -> Result<CreateQuestionInput, Vec<CsvParseError>> {
    let get = |index: usize| row.get(index).map(String::as_str).unwrap_or("").trim();
    let type_text = get(0);
    let content = get(1);
    let answer = get(8);
    let analysis = get(9);
    let mut errors = Vec::new();

    if type_text.is_empty() {
        errors.push(error(row_number, "题型", "题型不能为空"));
        return Err(errors);
    }
    let Some(question_type) = normalize_type(type_text) else {
        errors.push(error(
            row_number,
            "题型",
            format!("无效的题型: {type_text}"),
        ));
        return Err(errors);
    };
    if content.is_empty() {
        errors.push(error(row_number, "题干", "题干不能为空"));
        return Err(errors);
    }

    let mut question = CreateQuestionInput {
        r#type: question_type.to_string(),
        content: content.to_string(),
        options: None,
        answer: answer.to_string(),
        analysis: (!analysis.is_empty()).then(|| analysis.to_string()),
    };

    match question_type {
        "single" | "multiple" => validate_choice_row(
            row,
            row_number,
            answer,
            question_type,
            &mut question,
            &mut errors,
        ),
        "boolean" => validate_boolean_row(row_number, answer, &mut question, &mut errors),
        "fill" => validate_fill_row(row_number, content, answer, &mut errors),
        "short" => {}
        _ => {}
    }

    if errors.is_empty() {
        Ok(question)
    } else {
        Err(errors)
    }
}

fn validate_choice_row(
    row: &[String],
    row_number: usize,
    answer: &str,
    question_type: &str,
    question: &mut CreateQuestionInput,
    errors: &mut Vec<CsvParseError>,
) {
    let options = option_letters()
        .iter()
        .enumerate()
        .filter_map(|(index, id)| {
            let text = row.get(index + 2)?.trim();
            (!text.is_empty()).then(|| serde_json::json!({ "id": id, "text": text }))
        })
        .collect::<Vec<_>>();

    if options.len() < 2 {
        errors.push(error(row_number, "选项", "选择题至少需要2个选项"));
        return;
    }
    if answer.is_empty() {
        errors.push(error(row_number, "答案", "选择题必须设置答案"));
        return;
    }

    let ids = options
        .iter()
        .filter_map(|option| option.get("id").and_then(serde_json::Value::as_str))
        .collect::<Vec<_>>();
    let answer_ids = answer
        .split('|')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();

    for id in &answer_ids {
        if !ids.contains(id) {
            errors.push(error(
                row_number,
                "答案",
                format!("答案 \"{id}\" 不是有效选项"),
            ));
            return;
        }
    }
    if question_type == "single" && answer_ids.len() > 1 {
        errors.push(error(row_number, "答案", "单选题只能有一个答案"));
        return;
    }

    question.options = Some(serde_json::Value::Array(options));
}

fn validate_boolean_row(
    row_number: usize,
    answer: &str,
    question: &mut CreateQuestionInput,
    errors: &mut Vec<CsvParseError>,
) {
    if answer.is_empty() {
        errors.push(error(row_number, "答案", "判断题必须设置答案"));
        return;
    }
    let normalized = match answer {
        "正确" | "对" | "是" | "true" | "True" | "1" => "正确",
        "错误" | "错" | "否" | "false" | "False" | "0" => "错误",
        _ => {
            errors.push(error(row_number, "答案", "判断题答案必须是“正确”或“错误”"));
            return;
        }
    };
    question.answer = normalized.to_string();
}

fn validate_fill_row(
    row_number: usize,
    content: &str,
    answer: &str,
    errors: &mut Vec<CsvParseError>,
) {
    let blank_count = count_fill_blanks(content);
    if blank_count == 0 {
        errors.push(error(row_number, "题干", "填空题题干必须包含空栏标记"));
        return;
    }
    if answer.is_empty() {
        errors.push(error(row_number, "答案", "填空题必须设置答案"));
        return;
    }
    let answer_count = answer.split('|').count();
    if answer_count != blank_count {
        errors.push(error(
            row_number,
            "答案",
            format!("答案数量({answer_count})与空栏数量({blank_count})不匹配"),
        ));
    }
}

fn question_to_row(question: &Question) -> Vec<String> {
    let mut options = ["", "", "", "", "", ""].map(str::to_string);
    if let Some(items) = question
        .options
        .as_ref()
        .and_then(serde_json::Value::as_array)
    {
        for option in items {
            let Some(id) = option.get("id").and_then(serde_json::Value::as_str) else {
                continue;
            };
            let Some(text) = option.get("text").and_then(serde_json::Value::as_str) else {
                continue;
            };
            if let Some(index) = option_letters().iter().position(|letter| *letter == id) {
                options[index] = text.to_string();
            }
        }
    }

    vec![
        display_type(question.r#type.as_str()).to_string(),
        question.content.clone(),
        options[0].clone(),
        options[1].clone(),
        options[2].clone(),
        options[3].clone(),
        options[4].clone(),
        options[5].clone(),
        question.answer.clone(),
        question.analysis.clone().unwrap_or_default(),
    ]
}

fn write_csv_rows<I, R, S>(rows: I) -> Result<String, String>
where
    I: IntoIterator<Item = R>,
    R: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut writer = csv::WriterBuilder::new()
        .quote_style(csv::QuoteStyle::Always)
        .from_writer(Vec::new());
    writer
        .write_record(CSV_HEADERS)
        .map_err(|error| format!("写入 CSV 表头失败: {error}"))?;
    for row in rows {
        writer
            .write_record(row.into_iter().map(|value| value.as_ref().to_string()))
            .map_err(|error| format!("写入 CSV 数据失败: {error}"))?;
    }
    let bytes = writer
        .into_inner()
        .map_err(|error| format!("生成 CSV 内容失败: {}", error.error()))?;
    String::from_utf8(bytes).map_err(|error| format!("CSV 内容编码错误: {error}"))
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

fn display_type(value: &str) -> &str {
    match value {
        "single" => "单选题",
        "multiple" => "多选题",
        "boolean" => "判断题",
        "fill" => "填空题",
        "short" => "简答题",
        other => other,
    }
}

fn error(row: usize, field: &str, message: impl Into<String>) -> CsvParseError {
    CsvParseError {
        row,
        field: field.to_string(),
        message: message.into(),
    }
}

fn option_letters() -> [&'static str; 6] {
    ["A", "B", "C", "D", "E", "F"]
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
