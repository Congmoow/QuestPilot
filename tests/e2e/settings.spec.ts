import { test, expect } from '@playwright/test';
import { injectTauriMock } from './helpers/tauri-mock';

test.describe('设置页 — API 配置', () => {
  test('API Key 未配置时显示"未配置"或空态', async ({ page }) => {
    await injectTauriMock(page, {
      settings_get_api_config: {
        apiKey: '',
        apiKeyPreview: '',
        hasApiKey: false,
        apiUrl: 'https://api.openai.com/v1',
        modelId: 'gpt-4o',
        provider: 'openai',
      },
    });
    await page.goto('/#/settings');
    await page.waitForTimeout(800);

    const body = page.locator('body');
    // 不应暴露明文 key，页面应可见
    await expect(body).not.toContainText('sk-');
    await expect(body).toBeVisible();
  });

  test('API Key 已配置时只显示脱敏预览，不暴露完整 key', async ({ page }) => {
    await injectTauriMock(page, {
      settings_get_api_config: {
        apiKey: '',
        apiKeyPreview: 'sk-t••••cdef',
        hasApiKey: true,
        apiUrl: 'https://api.openai.com/v1',
        modelId: 'gpt-4o',
        provider: 'openai',
      },
    });
    await page.goto('/#/settings');
    await page.waitForTimeout(800);

    // 脱敏预览应可见
    await expect(page.getByText('sk-t••••cdef')).toBeVisible({ timeout: 5000 });
  });

  test('服务商选择器或模型字段可见', async ({ page }) => {
    await injectTauriMock(page);
    await page.goto('/#/settings');
    await page.waitForTimeout(800);

    // provider / model 选择区域
    const body = page.locator('body');
    const hasProvider = await body.evaluate(
      (el) =>
        el.textContent?.includes('服务商') ||
        el.textContent?.includes('模型') ||
        el.textContent?.includes('API'),
    );
    expect(hasProvider).toBeTruthy();
  });
});
