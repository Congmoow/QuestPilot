export type QuestionType = 'single' | 'multiple' | 'boolean' | 'fill' | 'short';
export type ThemeType = 'light' | 'dark' | 'system';

export interface QuestionBank {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  questionCount?: number;
  question_count?: number;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: number;
  bankId: number;
  type: QuestionType;
  content: string;
  options: QuestionOption[] | null;
  answer: string;
  analysis: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuestionBankInput {
  name: string;
  description?: string;
}

export interface CreateQuestionInput {
  bankId?: number;
  type: QuestionType;
  content: string;
  options?: QuestionOption[] | null;
  answer: string;
  analysis?: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface QueryOptions {
  page?: number;
  pageSize?: number;
  type?: QuestionType | null;
}

export interface DashboardStats {
  totalQuestions: number;
  todayQuestions: number;
  weekQuestions: number;
  typeDistribution: Array<{ type: QuestionType; count: number }>;
}

export interface OperationLog {
  id: number;
  action: string;
  detail: string;
  createdAt: string;
}

export interface DraftData {
  type: QuestionType;
  content: string;
  options?: QuestionOption[];
  answer?: string;
  answers?: string[];
  fillAnswers?: string[];
  analysis?: string;
  savedAt: string;
}

export interface ParseError {
  row?: number;
  index?: number;
  field?: string;
  message: string;
}

export interface ParseResult {
  valid: CreateQuestionInput[];
  errors: ParseError[];
  totalRows: number;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: ParseError[];
}

export interface FileSelectionResult {
  success: boolean;
  canceled: boolean;
  filePath: string | null;
}

export interface SaveDialogResult {
  success: boolean;
  canceled: boolean;
  filePath?: string;
  count?: number;
}

export interface ApiConfig {
  apiKey: string;
  apiKeyPreview: string;
  hasApiKey: boolean;
  apiUrl: string;
  modelId: string;
  provider: string;
}

export interface ApiConnectionResult {
  success: boolean;
  message?: string;
}

export interface LegacyDatabaseCandidate {
  path: string;
  exists: boolean;
  hasUserData: boolean;
  inspectError?: string | null;
}

export interface LegacyDatabaseStatus {
  targetPath: string;
  targetExists: boolean;
  targetHasUserData: boolean;
  candidates: LegacyDatabaseCandidate[];
  recommendedAction: string;
}

export interface LegacyDatabaseReplaceResult {
  success: boolean;
  backupPath?: string | null;
  targetPath?: string;
}

export interface AiMessage {
  role: string;
  content: string;
}

export interface AiParseResult {
  questions: CreateQuestionInput[];
  chunkErrors?: unknown[];
  chunks?: unknown;
}

export interface AiChatResult {
  success: boolean;
  message?: string;
  content: string;
}

export interface Prompt {
  id: number;
  name: string;
  content: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatHistory {
  id: number;
  title?: string | null;
  messages: unknown;
  promptId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeRecordInput {
  bankId: number;
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
}

export interface PracticeRecord extends PracticeRecordInput {
  id: number;
  createdAt: string;
}

export interface PracticeStats {
  bankId: number;
  bankName: string;
  practiceCount: number;
  avgAccuracy: number;
  lastPractice?: string | null;
}

export interface WrongBookPracticeResult {
  questionId: number;
  bankId: number;
  isCorrect: boolean;
}

export interface WrongBookItem {
  questionId: number;
  bankId: number;
  wrongCount: number;
  correctCount: number;
  addedAt: string;
  lastWrongAt: string;
  question: Question;
}
