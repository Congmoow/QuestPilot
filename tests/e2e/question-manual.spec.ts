import { test, expect } from '@playwright/test';
import { injectTauriMock } from './helpers/tauri-mock';

test.describe('手动录入题目', () => {
  test.beforeEach(async ({ page }) => {
    await injectTauriMock(page);
  });

  test('手动录入页面正常加载', async ({ page }) => {
    await page.goto('/#/manual-entry');
    await expect(page.locator('body')).not.toContainText('页面加载失败');
    // 应有题型选择
    await expect(
      page.getByRole('combobox').or(page.getByLabel(/题型/)).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('页面包含题干输入区域', async ({ page }) => {
    await page.goto('/#/manual-entry');
    await page.waitForTimeout(500);
    // 题干 textarea 或 input 应存在
    const contentInput = page.getByPlaceholder(/题干|请输入题目/).or(
      page.locator('textarea').first(),
    );
    await expect(contentInput).toBeVisible({ timeout: 5000 });
  });

  test('切换题型时界面正常响应', async ({ page }) => {
    await page.goto('/#/manual-entry');
    await page.waitForTimeout(500);
    const select = page.getByRole('combobox').first();
    if (await select.count() > 0) {
      await select.selectOption({ label: '判断题' });
      // 界面不崩溃
      await expect(page.locator('body')).not.toContainText('Error');
    }
  });
});
