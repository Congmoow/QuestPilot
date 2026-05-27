import { describe, expect, it } from 'vitest';

import { resolveToasterTheme } from '../../../src/components/ui/toasterTheme';

const rootWithClass = (className: string) => ({
  classList: {
    contains: (token: string) => className.split(/\s+/).includes(token),
  },
});

describe('Toaster theme', () => {
  it('亮色主题下解析为 light，而不是继续跟随系统暗色', () => {
    expect(resolveToasterTheme(rootWithClass(''))).toBe('light');
  });

  it('html.dark 存在时解析为 dark', () => {
    expect(resolveToasterTheme(rootWithClass('dark'))).toBe('dark');
  });

  it('缺少 document 时默认使用 light', () => {
    expect(resolveToasterTheme(null)).toBe('light');
  });
});
