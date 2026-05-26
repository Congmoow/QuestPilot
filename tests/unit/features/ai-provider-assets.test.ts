import { describe, expect, it } from 'vitest';

import {
  getAiProviderHeroImageClassName,
  getAiProviderHeroImagePath,
  getAiProviderHeroLabel,
  getAiProviderIconPath,
} from '../../../src/features/ai-chat/utils/providerAssets';

describe('AI provider icon assets', () => {
  it('为已有素材的服务商返回 webp 图标', () => {
    expect(getAiProviderIconPath('deepseek')).toBe('/ai-icons/deepseek.webp');
    expect(getAiProviderIconPath('qwen')).toBe('/ai-icons/qianwen.webp');
    expect(getAiProviderIconPath('anthropic')).toBe('/ai-icons/claude.webp');
    expect(getAiProviderIconPath('moonshot')).toBe('/ai-icons/kimi.webp');
  });

  it('OpenAI 和自定义服务商继续使用原图标', () => {
    expect(getAiProviderIconPath('openai')).toBeNull();
    expect(getAiProviderIconPath('custom')).toBeNull();
    expect(getAiProviderIconPath('custom', 'deepseek-chat')).toBeNull();
  });

  it('没有专属素材的服务商回退到原图标', () => {
    expect(getAiProviderIconPath('zhipu')).toBeNull();
    expect(getAiProviderIconPath('unknown-provider')).toBeNull();
  });

  it('欢迎页使用服务商图片，并保留 OpenAI 和自定义默认图', () => {
    expect(getAiProviderHeroImagePath('qwen')).toBe('/ai-icons/qianwen.webp');
    expect(getAiProviderHeroImagePath('openai')).toBe('/ai-bot.webp');
    expect(getAiProviderHeroImagePath('custom')).toBe('/ai-bot.webp');
    expect(getAiProviderHeroImagePath('custom', 'qwen-plus')).toBe('/ai-bot.webp');
  });

  it('服务商专属欢迎图缩小到原主图约三分之一', () => {
    expect(getAiProviderHeroImageClassName('qwen')).toBe('h-[74px]');
    expect(getAiProviderHeroImageClassName('openai')).toBe('h-56');
    expect(getAiProviderHeroImageClassName('custom')).toBe('h-56');
  });

  it('仅在显示服务商专属欢迎图时显示 AI 服务提供商名称', () => {
    expect(getAiProviderHeroLabel('qwen', 'qwen-plus')).toBe('通义千问');
    expect(getAiProviderHeroLabel('qwen', '')).toBe('通义千问');
    expect(getAiProviderHeroLabel('openai')).toBeNull();
    expect(getAiProviderHeroLabel('custom')).toBeNull();
  });
});
