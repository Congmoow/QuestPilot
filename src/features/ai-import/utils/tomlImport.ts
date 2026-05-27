import { parse } from 'smol-toml';
import type { CreateQuestionInput, QuestionOption, QuestionType } from '../../../api';
import { countFillBlanks } from '../../../lib/fillBlank';
import { normalizeBooleanAnswer, normalizeChoiceAnswer } from './normalize';

type RawTomlQuestion = Record<string, unknown>;

const TOML_TYPE_MAP: Record<string, QuestionType> = {
  单选题: 'single',
  单选: 'single',
  single: 'single',
  多选题: 'multiple',
  多选: 'multiple',
  multiple: 'multiple',
  判断题: 'boolean',
  判断: 'boolean',
  boolean: 'boolean',
  填空题: 'fill',
  填空: 'fill',
  fill: 'fill',
  简答题: 'short',
  简答: 'short',
  short: 'short',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pick = (item: RawTomlQuestion, keys: string[]): unknown => {
  for (const key of keys) {
    if (item[key] !== undefined) return item[key];
  }
  return undefined;
};

const quoteKnownChineseKeys = (input: string): string =>
  input.replace(/^(\s*)(题型|题目|选项|答案|解析)(\s*=)/gm, '$1"$2"$3');

const normalizeOptions = (options: unknown): QuestionOption[] | null => {
  if (!Array.isArray(options)) return null;

  return options
    .map((option, index) => {
      if (typeof option === 'string') {
        const match = option.trim().match(/^([A-Z])[.、．:：)]\s*(.+)$/);
        return match
          ? { id: match[1], text: match[2] }
          : { id: String.fromCharCode(65 + index), text: option };
      }
      if (isRecord(option)) {
        const id = String(option.id ?? option.ID ?? String.fromCharCode(65 + index));
        const text = String(option.text ?? option.Text ?? option.文本 ?? option.内容 ?? '');
        return { id, text };
      }
      return null;
    })
    .filter((option): option is QuestionOption => Boolean(option && option.text));
};

const normalizeTomlQuestion = (item: RawTomlQuestion, index: number): CreateQuestionInput => {
  const type = pick(item, ['type', '题型']) ?? 'short';
  const normalizedType = TOML_TYPE_MAP[String(type)] || 'short';
  const content = String(pick(item, ['content', '题目', 'question']) ?? '');
  const answer = pick(item, ['answer', '答案']) ?? '';
  const analysis = String(pick(item, ['analysis', '解析']) ?? '');
  const rawOptions = pick(item, ['options', '选项']);

  if (!content) throw new Error(`第 ${index + 1} 道题目缺少题目内容`);

  let normalizedAnswer = String(answer ?? '');
  if (normalizedType === 'multiple') normalizedAnswer = normalizeChoiceAnswer(answer, true);
  if (normalizedType === 'single') normalizedAnswer = normalizeChoiceAnswer(answer, false);
  if (normalizedType === 'fill') {
    const blankCount = countFillBlanks(content);
    if (blankCount === 0) throw new Error(`第 ${index + 1} 道填空题题干必须包含空栏标记`);
    if (Array.isArray(answer)) {
      normalizedAnswer = answer.join('|');
    } else if (typeof answer === 'string' && blankCount > 1 && !answer.includes('|')) {
      normalizedAnswer = answer.replace(/[,，、;；]+/g, '|');
    }
    const answerCount = normalizedAnswer.split('|').length;
    if (answerCount !== blankCount) {
      throw new Error(
        `第 ${index + 1} 道填空题答案数量(${answerCount})与空栏数量(${blankCount})不匹配`,
      );
    }
  }
  if (normalizedType === 'boolean') normalizedAnswer = normalizeBooleanAnswer(answer);

  const normalizedOptions =
    normalizedType === 'single' || normalizedType === 'multiple' ? normalizeOptions(rawOptions) : null;

  return {
    type: normalizedType,
    content,
    answer: normalizedAnswer,
    analysis,
    ...(normalizedOptions && normalizedOptions.length > 0 && { options: normalizedOptions }),
  };
};

const extractQuestions = (data: unknown): RawTomlQuestion[] => {
  if (!isRecord(data)) return [];
  const questions = data.questions ?? data.题目列表;
  if (!Array.isArray(questions)) return [];
  return questions.filter(isRecord);
};

export const parseTomlQuestions = (input: string): CreateQuestionInput[] => {
  if (!input.trim()) throw new Error('请输入 TOML 格式的题目数据');

  let data: unknown;
  try {
    data = parse(quoteKnownChineseKeys(input.trim()));
  } catch {
    throw new Error('TOML 格式错误，请检查语法');
  }

  const questions = extractQuestions(data).map(normalizeTomlQuestion);
  if (questions.length === 0) throw new Error('未能解析出有效的题目');
  return questions;
};
