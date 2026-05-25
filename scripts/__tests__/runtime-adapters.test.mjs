import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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

test('保留对象形式的文件选择结果并补齐 canceled 字段', () => {
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

test('Tauri 迁移冲突处置暴露显式备份替换入口', () => {
  const apiSource = fs.readFileSync('src/api/index.js', 'utf8');
  const settingsSource = fs.readFileSync('src/pages/Settings.jsx', 'utf8');

  assert.match(apiSource, /migration_get_legacy_status/);
  assert.match(apiSource, /migration_backup_and_replace_from_legacy/);
  assert.match(apiSource, /BACKUP_AND_REPLACE/);
  assert.match(settingsSource, /requires_explicit_reset/);
  assert.match(settingsSource, /备份并使用旧库替换/);
});
