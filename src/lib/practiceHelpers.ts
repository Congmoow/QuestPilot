import type { Question } from '../api';
import { countFillBlanks } from './fillBlank';
import type { PracticeAnswerValue, PracticeQuestion } from '../types/viewModels';

export const shuffleArray = <T,>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const shuffleQuestionOptions = (question: PracticeQuestion): PracticeQuestion => {
  const originalOptions = Array.isArray(question.options) ? question.options : [];
  const shuffledOptions = shuffleArray(originalOptions);

  const idMap = new Map<string, string>();
  const remappedOptions = shuffledOptions.map((opt, index) => {
    const newId = String.fromCharCode(65 + index);
    if (opt && opt.id != null) idMap.set(String(opt.id), newId);
    return { ...opt, id: newId };
  });

  let remappedAnswer = question.answer;
  if (typeof question.answer === 'string' && question.answer.length > 0) {
    if (question.type === 'multiple') {
      remappedAnswer = question.answer
        .split('|')
        .map((a) => idMap.get(a) || a)
        .sort()
        .join('|');
    } else if (question.type === 'single') {
      remappedAnswer = idMap.get(question.answer) || question.answer;
    }
  }

  return { ...question, options: remappedOptions, answer: remappedAnswer };
};

export const normalizeFillAnswer = (value: PracticeAnswerValue | undefined, blankCount: number): string[] => {
  const n = Math.max(0, Number(blankCount) || 0);
  const arr = Array.isArray(value)
    ? value
    : (typeof value === 'string' ? value.split('|') : []);

  const normalized = arr.map((v) => String(v ?? ''));
  while (normalized.length < n) normalized.push('');
  if (normalized.length > n) normalized.length = n;
  return normalized;
};

export const isFillAnswerCorrect = (
  question: Pick<Question, 'content' | 'answer'>,
  userValue: PracticeAnswerValue | undefined
): boolean => {
  const blankCount = countFillBlanks(question?.content);
  const correctArr = normalizeFillAnswer(question?.answer, blankCount).map((a) => a.trim());
  const userArr = normalizeFillAnswer(userValue, blankCount).map((a) => a.trim());
  if (blankCount <= 0) return false;
  for (let i = 0; i < blankCount; i++) {
    if (correctArr[i] !== userArr[i]) return false;
  }
  return true;
};
