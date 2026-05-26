import { test, expect } from '@playwright/test';
import { injectTauriMock } from './helpers/tauri-mock';

test.describe('CSV 导入', () => {
  test.beforeEach(async ({ page }) => {
    await injectTauriMock(page);
  });

  test('CSV 导入页面正常加载', async ({ page }) => {
    await page.goto('/#/csv-import');
    await page.waitForTimeout(500);
    await expect(page.locator('body')).not.toContainText('页面加载失败');
  });

  test('下载模板按钮可见', async ({ page }) => {
    await page.goto('/#/csv-import');
    await page.waitForTimeout(500);
    const downloadBtn = page.getByRole('button', { name: /下载模板|模板/ });
    await expect(downloadBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('选择文件按钮可见', async ({ page }) => {
    await page.goto('/#/csv-import');
    await page.waitForTimeout(500);
    const selectBtn = page.getByRole('button', { name: /选择|导入|上传|浏览/ });
    await expect(selectBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('页面包含使用说明或格式提示', async ({ page }) => {
    await page.goto('/#/csv-import');
    await page.waitForTimeout(500);
    // 页面应有 CSV 格式相关文字
    const body = page.locator('body');
    const hasCsvHint = await body.evaluate(
      (el) => el.textContent?.includes('CSV') || el.textContent?.includes('格式'),
    );
    expect(hasCsvHint).toBeTruthy();
  });
});
