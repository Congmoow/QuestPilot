import { expect, test } from '@playwright/test';
import { injectTauriSmokeHarness, readTauriInvocations } from './helpers/tauri-mock';

const CSV_PATH = 'D:\\release-smoke\\questions.csv';
const LEGACY_DB_PATH = 'D:\\release-smoke\\legacy-questpilot.db';
const BACKUP_DB_PATH = 'D:\\release-smoke\\questpilot.backup.db';

test.describe('Tauri 发布闸门 smoke harness', () => {
  test('CSV 文件选择取消时停留在上传空态并记录 Tauri 调用', async ({ page }) => {
    await injectTauriSmokeHarness(page, {
      csv_select_file: null,
    });

    await page.goto('/#/csv-import');
    await page.getByRole('button', { name: /点击选择/ }).click();

    await expect(page.getByRole('button', { name: /点击选择/ })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('questions.csv');
    await expect(await readTauriInvocations(page, 'csv_select_file')).toHaveLength(1);
  });

  test('CSV 文件选择成功后显示文件并可进入解析', async ({ page }) => {
    await injectTauriSmokeHarness(page, {
      csv_select_file: CSV_PATH,
      csv_parse_file: {
        valid: [{ type: 'boolean', content: 'Tauri smoke 题目', answer: '正确' }],
        errors: [],
        totalRows: 1,
      },
    });

    await page.goto('/#/csv-import');
    await page.getByRole('button', { name: /点击选择/ }).click();
    await page.getByRole('button', { name: '解析文件' }).click();

    await expect(page.getByText('questions.csv')).toBeVisible();
    await expect(page.locator('body')).toContainText('有效题目');
    await expect(page.locator('body')).toContainText('总行数');
    await expect(await readTauriInvocations(page, 'csv_select_file')).toHaveLength(1);
    await expect(await readTauriInvocations(page, 'csv_parse_file')).toContainEqual(
      expect.objectContaining({
        command: 'csv_parse_file',
        args: { filePath: CSV_PATH },
      }),
    );
  });

  test('设置页显示数据迁移卡片并完成备份替换基础流程', async ({ page }) => {
    await injectTauriSmokeHarness(page, {
      migration_get_legacy_status: {
        targetPath: 'D:\\release-smoke\\questpilot.db',
        targetExists: true,
        targetHasUserData: true,
        recommendedAction: 'requires_explicit_reset',
        candidates: [
          {
            path: LEGACY_DB_PATH,
            exists: true,
            hasUserData: true,
            inspectError: null,
          },
        ],
      },
      migration_backup_and_replace_from_legacy: {
        success: true,
        backupPath: BACKUP_DB_PATH,
        targetPath: 'D:\\release-smoke\\questpilot.db',
      },
    });
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto('/#/settings');

    await expect(page.getByText('Tauri 数据迁移')).toBeVisible();
    await expect(page.getByText('检测到旧库数据')).toBeVisible();
    await expect(page.getByText('legacy-questpilot.db', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '备份并使用旧库替换' }).click();
    await expect(page.getByRole('alertdialog', { name: '危险操作确认' })).toBeVisible();
    await page.getByRole('button', { name: '确认替换' }).click();

    await expect(page.getByText('已备份并使用旧库替换')).toBeVisible();
    await expect(page.getByText(BACKUP_DB_PATH, { exact: false })).toBeVisible();
    await expect(
      await readTauriInvocations(page, 'migration_backup_and_replace_from_legacy'),
    ).toContainEqual(
      expect.objectContaining({
        command: 'migration_backup_and_replace_from_legacy',
        args: {
          legacyPath: LEGACY_DB_PATH,
          confirmation: 'BACKUP_AND_REPLACE',
        },
      }),
    );
  });

  test('标题栏窗口控制会触发可观测 Tauri 命令', async ({ page }) => {
    await injectTauriSmokeHarness(page);

    await page.goto('/#/dashboard');
    await page.locator('button[title="最小化"]').click();
    await page.locator('button[title="最大化"]').click();
    await expect(page.locator('button[title="还原"]')).toBeVisible();
    await page.locator('button[title="关闭"]').click();

    await expect(await readTauriInvocations(page, 'window_minimize')).toHaveLength(1);
    await expect(await readTauriInvocations(page, 'window_maximize')).toHaveLength(1);
    await expect(await readTauriInvocations(page, 'window_close')).toHaveLength(1);
    await expect((await readTauriInvocations(page, 'window_is_maximized')).length).toBeGreaterThan(
      1,
    );
  });
});
