export type AiProvider = {
  id: string;
  name: string;
  url: string;
  models: string[];
  placeholder: string;
};

export const AI_PROVIDERS: AiProvider[] = [
  { id: 'custom', name: '自定义', url: '', models: [], placeholder: '请输入 API 地址' },
  {
    id: 'openai',
    name: 'OpenAI',
    url: 'https://api.openai.com',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    placeholder: 'sk-...',
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    url: 'https://api.anthropic.com',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    placeholder: 'sk-ant-...',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    url: 'https://generativelanguage.googleapis.com',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
    placeholder: 'AIza...',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    placeholder: 'sk-...',
  },
  {
    id: 'qwen',
    name: '通义千问 (阿里)',
    url: 'https://dashscope.aliyuncs.com/compatible-mode',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    placeholder: 'sk-...',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    url: 'https://open.bigmodel.cn/api/paas',
    models: ['glm-4-plus', 'glm-4', 'glm-4-flash'],
    placeholder: '...',
  },
  {
    id: 'moonshot',
    name: 'Moonshot (月之暗面)',
    url: 'https://api.moonshot.cn',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    placeholder: 'sk-...',
  },
  {
    id: 'doubao',
    name: '豆包 (字节)',
    url: 'https://ark.cn-beijing.volces.com/api',
    models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-lite-4k'],
    placeholder: '...',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    url: 'https://api.minimax.chat',
    models: ['abab6.5s-chat', 'abab5.5-chat'],
    placeholder: '...',
  },
  {
    id: 'baichuan',
    name: '百川智能',
    url: 'https://api.baichuan-ai.com',
    models: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan2-Turbo'],
    placeholder: 'sk-...',
  },
  {
    id: 'yi',
    name: '零一万物 (Yi)',
    url: 'https://api.lingyiwanwu.com',
    models: ['yi-large', 'yi-medium', 'yi-spark'],
    placeholder: '...',
  },
  {
    id: 'groq',
    name: 'Groq',
    url: 'https://api.groq.com/openai',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    placeholder: 'gsk_...',
  },
  {
    id: 'together',
    name: 'Together AI',
    url: 'https://api.together.xyz',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    placeholder: '...',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    url: 'https://api.siliconflow.cn',
    models: ['Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V3'],
    placeholder: 'sk-...',
  },
];
