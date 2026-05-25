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
    invokeMock.mockResolvedValueOnce({ id: 1, name: '题库' });

    await expect(createQuestionBank({ name: '题库' })).resolves.toEqual({ id: 1, name: '题库' });

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
});
