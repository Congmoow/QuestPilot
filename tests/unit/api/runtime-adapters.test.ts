import { describe, expect, it } from 'vitest';

import {
  normalizeFileSelectionResult,
  normalizeSaveDialogResult,
} from '../../../src/api/runtimeAdapters';

describe('Tauri runtime adapters', () => {
  it('将 Tauri 文件选择字符串归一化为前端 CSV 选择契约', () => {
    expect(normalizeFileSelectionResult('D:\\data\\questions.csv')).toEqual({
      success: true,
      canceled: false,
      filePath: 'D:\\data\\questions.csv',
    });
  });

  it('将 Tauri 取消选择归一化为 canceled 字段', () => {
    expect(normalizeFileSelectionResult(null)).toEqual({
      success: false,
      canceled: true,
      filePath: null,
    });
  });

  it('保留对象形式的文件选择结果并补齐 canceled 字段', () => {
    expect(normalizeFileSelectionResult({ success: true, filePath: 'C:\\tmp\\items.csv' })).toEqual(
      {
        success: true,
        canceled: false,
        filePath: 'C:\\tmp\\items.csv',
      },
    );
  });

  it('将 Tauri 保存对话框 cancelled 字段归一化为 canceled', () => {
    expect(normalizeSaveDialogResult({ success: false, cancelled: true })).toEqual({
      success: false,
      canceled: true,
    });
  });

  it('保存对话框成功结果只暴露稳定字段', () => {
    expect(
      normalizeSaveDialogResult({
        success: true,
        filePath: 'D:\\export\\bank.csv',
        count: 12,
      }),
    ).toEqual({
      success: true,
      canceled: false,
      filePath: 'D:\\export\\bank.csv',
      count: 12,
    });
  });
});
