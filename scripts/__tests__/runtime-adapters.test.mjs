import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeFileSelectionResult,
  normalizeSaveDialogResult,
} from '../../src/api/runtimeAdapters.js';

test('将 Tauri 文件选择字符串归一化为前端 CSV 选择契约', () => {
  assert.deepEqual(normalizeFileSelectionResult('D:\\data\\questions.csv'), {
    success: true,
    canceled: false,
    filePath: 'D:\\data\\questions.csv',
  });
});

test('将 Tauri 取消选择归一化为 canceled 字段', () => {
  assert.deepEqual(normalizeFileSelectionResult(null), {
    success: false,
    canceled: true,
    filePath: null,
  });
});

test('保留 Electron 文件选择结果并补齐 canceled 字段', () => {
  assert.deepEqual(
    normalizeFileSelectionResult({ success: true, filePath: 'C:\\tmp\\items.csv' }),
    {
      success: true,
      canceled: false,
      filePath: 'C:\\tmp\\items.csv',
    }
  );
});

test('将 Tauri 保存对话框 cancelled 字段归一化为 canceled', () => {
  assert.deepEqual(normalizeSaveDialogResult({ success: false, cancelled: true }), {
    success: false,
    canceled: true,
  });
});

test('保存对话框成功结果只暴露稳定字段', () => {
  assert.deepEqual(
    normalizeSaveDialogResult({
      success: true,
      filePath: 'D:\\export\\bank.csv',
      count: 12,
    }),
    {
      success: true,
      canceled: false,
      filePath: 'D:\\export\\bank.csv',
      count: 12,
    }
  );
});
