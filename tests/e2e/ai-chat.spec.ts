import { test, expect } from '@playwright/test';
import { injectTauriMock } from './helpers/tauri-mock';

test.describe('AI 聊天 — 空状态与服务商图标', () => {
  test.beforeEach(async ({ page }) => {
    await injectTauriMock(page, {
      prompt_get_all: [],
      chat_history_get_all: [],
      settings_get_api_config: {
        apiKey: '',
        apiKeyPreview: '',
        hasApiKey: false,
        apiUrl: 'https://api.openai.com/v1',
        modelId: 'gpt-4o',
        provider: 'openai',
      },
    });
  });

  test('AI 聊天页面正常加载', async ({ page }) => {
    await page.goto('/#/ai-chat');
    await page.waitForTimeout(800);
    await expect(page.locator('body')).not.toContainText('页面加载失败');
  });

  test('无历史记录时显示空态欢迎界面', async ({ page }) => {
    await page.goto('/#/ai-chat');
    await page.waitForTimeout(800);

    // 欢迎界面或空状态应包含 AI 相关文字
    const body = page.locator('body');
    const hasWelcome = await body.evaluate(
      (el) =>
        el.textContent?.includes('AI') ||
        el.textContent?.includes('助手') ||
        el.textContent?.includes('聊天') ||
        el.textContent?.includes('问题'),
    );
    expect(hasWelcome).toBeTruthy();
  });

  test('消息输入框可见', async ({ page }) => {
    await page.goto('/#/ai-chat');
    await page.waitForTimeout(800);

    const input = page.getByPlaceholder(/输入|问题|消息/).or(page.locator('textarea').first());
    await expect(input).toBeVisible({ timeout: 5000 });
  });

  test('服务商图标区域可见（头像或 logo）', async ({ page }) => {
    await page.goto('/#/ai-chat');
    await page.waitForTimeout(800);

    // 服务商图标通常是 img 或 svg，页面至少有一个
    const icons = page.locator('img, svg').filter({ hasNotText: '' });
    await expect(icons.first()).toBeVisible({ timeout: 5000 });
  });

  test('发送按钮存在', async ({ page }) => {
    await page.goto('/#/ai-chat');
    await page.waitForTimeout(800);

    const sendBtn = page
      .getByRole('button', { name: /发送/ })
      .or(page.locator('button[aria-label*="发送"]'));
    await expect(sendBtn.first()).toBeVisible({ timeout: 5000 });
  });
});
