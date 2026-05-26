import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

describe('Tauri-only API 门面', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('创建题库时直接调用 Tauri command', async () => {
    const { createQuestionBank } = await import('./index');
    const mockBank = {
      id: 1,
      name: '题库',
      description: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      questionCount: 0,
    };
    invokeMock.mockResolvedValueOnce(mockBank);

    await expect(createQuestionBank({ name: '题库' })).resolves.toEqual(mockBank);

    expect(invokeMock).toHaveBeenCalledWith('question_bank_create', {
      data: { name: '题库' },
    });
  });

  it('创建题目时从 payload 中拆出 bankId', async () => {
    const { createQuestion } = await import('./index');
    invokeMock.mockResolvedValueOnce({ id: 10, bankId: 2 });

    await createQuestion({
      bankId: 2,
      type: 'single',
      content: '题干',
      answer: 'A',
      options: [{ id: 'A', text: '选项' }],
    });

    expect(invokeMock).toHaveBeenCalledWith('question_create', {
      bankId: 2,
      data: {
        type: 'single',
        content: '题干',
        answer: 'A',
        options: [{ id: 'A', text: '选项' }],
      },
    });
  });

  it('CSV 文件选择结果保持前端契约', async () => {
    const { selectCsvFile } = await import('./index');
    invokeMock.mockResolvedValueOnce('D:\\data\\questions.csv');

    await expect(selectCsvFile()).resolves.toEqual({
      success: true,
      canceled: false,
      filePath: 'D:\\data\\questions.csv',
    });
  });

  it('CSV 解析直接返回类型化解析结果', async () => {
    const { parseCsvFile } = await import('./index');
    const parseResult = {
      valid: [{ type: 'boolean', content: '题干', answer: '正确' }],
      errors: [],
      totalRows: 1,
    };
    invokeMock.mockResolvedValueOnce(parseResult);

    await expect(parseCsvFile('D:\\data\\questions.csv')).resolves.toEqual(parseResult);

    expect(invokeMock).toHaveBeenCalledWith('csv_parse_file', {
      filePath: 'D:\\data\\questions.csv',
    });
  });

  it('保存 API 配置时只传递配置字段', async () => {
    const { setApiConfig } = await import('./index');
    invokeMock.mockResolvedValueOnce({ success: true });

    await setApiConfig({
      apiKey: 'sk-test',
      apiUrl: 'https://api.example.com',
      modelId: 'model-a',
      provider: 'custom',
    });

    expect(invokeMock).toHaveBeenCalledWith('settings_set_api_config', {
      config: {
        apiKey: 'sk-test',
        apiUrl: 'https://api.example.com',
        modelId: 'model-a',
        provider: 'custom',
      },
    });
  });

  it('读取 API 配置时保留脱敏预览字段', async () => {
    const { getApiConfig } = await import('./index');
    const config = {
      apiKey: '',
      apiKeyPreview: 'sk-...abcd',
      hasApiKey: true,
      apiUrl: 'https://api.example.com',
      modelId: 'model-a',
      provider: 'custom',
    };
    invokeMock.mockResolvedValueOnce(config);

    await expect(getApiConfig()).resolves.toEqual(config);

    expect(invokeMock).toHaveBeenCalledWith('settings_get_api_config', {});
  });

  it('AI 问答传递消息与 promptId', async () => {
    const { chatWithAI } = await import('./index');
    invokeMock.mockResolvedValueOnce({ success: true, content: '回答' });

    await chatWithAI([{ role: 'user', content: '问题' }], 7);

    expect(invokeMock).toHaveBeenCalledWith('ai_chat', {
      messages: [{ role: 'user', content: '问题' }],
      promptId: 7,
    });
  });

  it('迁移状态查询映射到 Tauri command', async () => {
    const { getLegacyDatabaseStatus } = await import('./index');
    const status = {
      shouldPrompt: true,
      targetHasData: true,
      legacyCandidates: [],
      requiresExplicitReset: true,
    };
    invokeMock.mockResolvedValueOnce(status);

    await expect(getLegacyDatabaseStatus()).resolves.toEqual(status);

    expect(invokeMock).toHaveBeenCalledWith('migration_get_legacy_status', {});
  });

  it('AI 解析返回 questions 数组时 schema 校验通过', async () => {
    const { parseQuestionsWithAI } = await import('./index');
    const validResult = {
      questions: [
        { type: 'single', content: '题干', answer: 'A', options: [{ id: 'A', text: '选项' }] },
      ],
    };
    invokeMock.mockResolvedValueOnce(validResult);

    const result = await parseQuestionsWithAI('题目文本');
    expect(result.questions).toHaveLength(1);
  });

  it('AI 解析返回无效数据时 strictValidate 抛出中文错误', async () => {
    const { parseQuestionsWithAI } = await import('./index');
    invokeMock.mockResolvedValueOnce({ questions: 'not-an-array' });

    await expect(parseQuestionsWithAI('题目文本')).rejects.toThrow('AI 解析题目');
  });

  it('备份替换旧库时传递固定确认短语', async () => {
    const { backupAndReplaceFromLegacy } = await import('./index');
    const result = { success: true, backupPath: 'D:\\backup\\questpilot.db' };
    invokeMock.mockResolvedValueOnce(result);

    await expect(backupAndReplaceFromLegacy('D:\\legacy\\questpilot.db')).resolves.toEqual(result);

    expect(invokeMock).toHaveBeenCalledWith('migration_backup_and_replace_from_legacy', {
      legacyPath: 'D:\\legacy\\questpilot.db',
      confirmation: 'BACKUP_AND_REPLACE',
    });
  });
});
