import { z } from 'zod';

// ==================== 基础枚举 ====================

export const QuestionTypeSchema = z.enum(['single', 'multiple', 'boolean', 'fill', 'short']);

export const ThemeTypeSchema = z.enum(['light', 'dark', 'system']);

// ==================== 题目相关 ====================

export const QuestionOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const QuestionSchema = z.object({
  id: z.number(),
  bankId: z.number(),
  type: QuestionTypeSchema,
  content: z.string(),
  options: z.array(QuestionOptionSchema).nullable(),
  answer: z.string(),
  analysis: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateQuestionInputSchema = z.object({
  bankId: z.number().optional(),
  type: QuestionTypeSchema,
  content: z.string(),
  options: z.array(QuestionOptionSchema).nullable().optional(),
  answer: z.string(),
  analysis: z.string().nullable().optional(),
});

// ==================== 题库 ====================

export const QuestionBankSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  questionCount: z.number().optional(),
  question_count: z.number().optional(),
});

// ==================== API 配置 ====================

export const ApiConfigSchema = z.object({
  apiKey: z.string(),
  apiKeyPreview: z.string(),
  hasApiKey: z.boolean(),
  apiUrl: z.string(),
  modelId: z.string(),
  provider: z.string(),
});

// ==================== AI 解析结果 ====================

export const AiParseResultSchema = z.object({
  questions: z.array(CreateQuestionInputSchema),
  chunkErrors: z.array(z.unknown()).optional(),
  chunks: z.unknown().optional(),
});

// ==================== 分页结果 ====================

export const PaginatedResultSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  });

// ==================== 辅助函数 ====================

/**
 * 安全校验：解析失败时记录警告并直接返回原始数据（不抛出），保证已有功能不中断。
 */
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[schema] ${context} 数据校验失败:`, result.error.flatten());
    return data as T;
  }
  return result.data;
}

/**
 * 严格校验：解析失败时抛出中文错误提示。用于不可信外部输入（AI 响应、JSON 导入等）。
 */
export function strictValidate<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join('.') || 'root').join(', ');
    throw new Error(
      `${context}：数据格式不符合预期（字段：${fields}），请检查 AI 返回或导入文件。`,
    );
  }
  return result.data;
}
