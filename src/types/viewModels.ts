import type { Question, QuestionType } from '../api';

export type TypeLabelMap = Record<QuestionType, string>;

export type PracticeAnswerValue = string | string[];

export type PracticeAnswerMap = Record<number, PracticeAnswerValue>;

export type AnswerCardState = 'default' | 'selected' | 'correct' | 'wrong';

export type PracticeResultView = {
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
  bankId: number | null;
  timestamp: string;
};

export type PracticeQuestion = Question;
