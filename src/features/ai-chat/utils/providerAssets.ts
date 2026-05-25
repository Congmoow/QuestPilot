import { inferProviderFromModel, providerInfo, type AiProviderKey } from './providers';

const AI_PROVIDER_ICON_PATHS: Partial<Record<AiProviderKey, string>> = {
  anthropic: '/ai-icons/claude.webp',
  deepseek: '/ai-icons/deepseek.webp',
  doubao: '/ai-icons/doubao.webp',
  gemini: '/ai-icons/gemini.webp',
  minimax: '/ai-icons/minimax.webp',
  moonshot: '/ai-icons/kimi.webp',
  qwen: '/ai-icons/qianwen.webp',
};

export const resolveAiProviderId = (
  provider: string,
  modelId = '',
  { inferCustom = false }: { inferCustom?: boolean } = {},
): string => {
  if (provider && (provider !== 'custom' || !inferCustom)) return provider;
  return inferProviderFromModel(modelId);
};

export const getAiProviderDisplayInfo = (provider: string, modelId = '') => {
  return providerInfo(resolveAiProviderId(provider, modelId));
};

export const getAiProviderIconPath = (provider: string, modelId = ''): string | null => {
  const providerId = resolveAiProviderId(provider, modelId);
  return AI_PROVIDER_ICON_PATHS[providerId as AiProviderKey] || null;
};

export const getAiProviderHeroImagePath = (provider: string, modelId = ''): string => {
  return getAiProviderIconPath(provider, modelId) || '/ai-bot.webp';
};

export const getAiProviderHeroImageClassName = (provider: string, modelId = ''): string => {
  return getAiProviderIconPath(provider, modelId) ? 'h-[74px]' : 'h-56';
};

export const getAiProviderHeroLabel = (provider: string, modelId = ''): string | null => {
  if (!getAiProviderIconPath(provider, modelId)) return null;
  return getAiProviderDisplayInfo(provider, modelId).name;
};
