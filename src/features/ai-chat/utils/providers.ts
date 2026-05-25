export type AiProviderKey =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'qwen'
  | 'zhipu'
  | 'moonshot'
  | 'doubao'
  | 'minimax'
  | 'baichuan'
  | 'yi'
  | 'groq'
  | 'together'
  | 'siliconflow'
  | 'custom';

export type AiConfigView = {
  provider: AiProviderKey | string;
  modelId: string;
};

export const AI_PROVIDER_INFO: Record<AiProviderKey, { name: string; color: string }> = {
  openai: { name: 'ChatGPT', color: '#10a37f' },
  anthropic: { name: 'Claude', color: '#d97706' },
  gemini: { name: 'Gemini', color: '#4285f4' },
  deepseek: { name: 'DeepSeek', color: '#4d6bfe' },
  qwen: { name: '通义千问', color: '#6366f1' },
  zhipu: { name: '智谱清言', color: '#2563eb' },
  moonshot: { name: 'Kimi', color: '#000000' },
  doubao: { name: '豆包', color: '#3b82f6' },
  minimax: { name: 'MiniMax', color: '#ff6b35' },
  baichuan: { name: '百川', color: '#059669' },
  yi: { name: '零一万物', color: '#8b5cf6' },
  groq: { name: 'Groq', color: '#f97316' },
  together: { name: 'Together AI', color: '#06b6d4' },
  siliconflow: { name: 'SiliconFlow', color: '#8b5cf6' },
  custom: { name: 'AI 助手', color: '#6366f1' },
};

export const isKnownProvider = (provider: string): provider is AiProviderKey => {
  return provider in AI_PROVIDER_INFO;
};

export const providerInfo = (provider: string) => {
  return isKnownProvider(provider) ? AI_PROVIDER_INFO[provider] : AI_PROVIDER_INFO.custom;
};

export const inferProviderFromModel = (modelId: string): AiProviderKey => {
  if (!modelId) return 'custom';
  const model = modelId.toLowerCase();
  if (model.includes('gpt') || model.includes('o1')) return 'openai';
  if (model.includes('claude')) return 'anthropic';
  if (model.includes('gemini')) return 'gemini';
  if (model.includes('deepseek')) return 'deepseek';
  if (model.includes('qwen')) return 'qwen';
  if (model.includes('glm')) return 'zhipu';
  if (model.includes('moonshot') || model.includes('kimi')) return 'moonshot';
  if (model.includes('doubao')) return 'doubao';
  if (model.includes('abab') || model.includes('minimax')) return 'minimax';
  if (model.includes('baichuan')) return 'baichuan';
  if (model.includes('yi-')) return 'yi';
  if (model.includes('llama') || model.includes('mixtral')) return 'groq';
  return 'custom';
};

export const getAiName = (provider: string, modelId: string): string => {
  const actualProvider = provider !== 'custom' ? provider : inferProviderFromModel(modelId);
  return providerInfo(actualProvider).name;
};
