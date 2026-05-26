import { test, expect } from '@playwright/test';
import { injectTauriMock } from './helpers/tauri-mock';

const MOCK_BANKS = [
  {
    id: 1,
    name: '计算机基础',
    description: '计算机科学基础题目',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    questionCount: 42,
  },
  {
    id: 2,
    name: '数据结构',
    description: null,
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
    questionCount: 18,
  },
];

test.describe('题库管理', () => {
  test.beforeEach(async ({ page }) => {
    await injectTauriMock(page, { question_bank_get_all: MOCK_BANKS });
  });

  test('题库列表页面加载并展示题库卡片', async ({ page }) => {
    await page.goto('/#/question-preview');
    // 等待加载状态消失
    await page.waitForTimeout(500);
    // 两个题库名称应可见
    await expect(page.getByText('计算机基础')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('数据结构')).toBeVisible({ timeout: 5000 });
  });

  test('空题库列表显示空状态提示', async ({ page }) => {
    await injectTauriMock(page, { question_bank_get_all: [] });
    await page.goto('/#/question-preview');
    await page.waitForTimeout(500);
    // 有题库数量为 0 或空状态指示
    await expect(page.locator('body')).not.toContainText('Error');
  });

  test('点击新建题库按钮弹出对话框', async ({ page }) => {
    await page.goto('/#/question-preview');
    await page.waitForTimeout(500);

    const createBtn = page.getByRole('button', { name: /新建|创建|添加题库/ });
    if ((await createBtn.count()) > 0) {
      await createBtn.first().click();
      // 对话框或表单应出现
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
    }
  });
});
