import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  BookOpenCheck,
  Bot,
  Camera,
  ChevronDown,
  FileQuestion,
  History,
  Loader2,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '../lib/utils';
import api from '../api';
import type { AiMessage, ChatHistory, Prompt } from '../api';
import {
  AIChatWelcome,
  AlertBanner,
  ChatComposer,
  ChatMessageBubble,
  PageHeaderNoTitle,
  SurfaceCard,
} from '../components/ui';

type AiProviderKey =
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

type AiConfigView = {
  provider: AiProviderKey | string;
  modelId: string;
};

const errorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

const preprocessLatex = (content: string) => {
  if (!content) return content;
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
};

const AI_PROVIDER_INFO: Record<AiProviderKey, { name: string; color: string }> = {
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

const isKnownProvider = (provider: string): provider is AiProviderKey => {
  return provider in AI_PROVIDER_INFO;
};

const providerInfo = (provider: string) => {
  return isKnownProvider(provider) ? AI_PROVIDER_INFO[provider] : AI_PROVIDER_INFO.custom;
};

const inferProviderFromModel = (modelId: string): AiProviderKey => {
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

const AiIcon = ({ provider, modelId, size = 24, className = '' }: AiConfigView & { size?: number; className?: string }) => {
  const actualProvider = provider !== 'custom' ? provider : inferProviderFromModel(modelId);
  const info = providerInfo(actualProvider);

  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-xl bg-primary-soft text-primary', className)}
      style={{ width: size, height: size, color: info.color }}
    >
      <Bot size={Math.max(16, size * 0.62)} />
    </span>
  );
};

const getAiName = (provider: string, modelId: string) => {
  const actualProvider = provider !== 'custom' ? provider : inferProviderFromModel(modelId);
  const info = providerInfo(actualProvider);
  return info.name;
};

type MarkdownComponentProps = {
  children?: ReactNode;
  href?: string;
  inline?: boolean;
};

const markdownComponents = {
  p: ({ children }: MarkdownComponentProps) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: MarkdownComponentProps) => <ul className="mb-2 list-disc pl-4">{children}</ul>,
  ol: ({ children }: MarkdownComponentProps) => <ol className="mb-2 list-decimal pl-4">{children}</ol>,
  li: ({ children }: MarkdownComponentProps) => <li className="mb-1">{children}</li>,
  code: ({ inline, children }: MarkdownComponentProps) => (
    inline ? (
      <code className="rounded bg-gray-100 px-1 py-0.5 text-sm dark:bg-gray-600">{children}</code>
    ) : (
      <code className="block overflow-x-auto rounded-xl bg-gray-100 p-3 text-sm dark:bg-gray-600">{children}</code>
    )
  ),
  pre: ({ children }: MarkdownComponentProps) => <pre className="mb-2 overflow-x-auto rounded-xl bg-gray-100 p-3 dark:bg-gray-600">{children}</pre>,
  table: ({ children }: MarkdownComponentProps) => <table className="my-2 w-full border-collapse border border-gray-200 text-sm dark:border-gray-500">{children}</table>,
  th: ({ children }: MarkdownComponentProps) => <th className="border border-gray-200 bg-gray-100 px-2 py-1 dark:border-gray-500 dark:bg-gray-600">{children}</th>,
  td: ({ children }: MarkdownComponentProps) => <td className="border border-gray-200 px-2 py-1 dark:border-gray-500">{children}</td>,
  h1: ({ children }: MarkdownComponentProps) => <h1 className="mb-2 text-xl font-bold">{children}</h1>,
  h2: ({ children }: MarkdownComponentProps) => <h2 className="mb-2 text-lg font-bold">{children}</h2>,
  h3: ({ children }: MarkdownComponentProps) => <h3 className="mb-1 text-base font-bold">{children}</h3>,
  blockquote: ({ children }: MarkdownComponentProps) => <blockquote className="my-2 border-l-4 border-blue-200 pl-3 italic">{children}</blockquote>,
  hr: () => <hr className="my-3 border-gray-200 dark:border-gray-500" />,
  a: ({ href, children }: MarkdownComponentProps) => <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
};

const features = [
  { title: '上传题目解析', description: '上传题目图片\n获取详细解析', iconSrc: '/aichat-icon/icon-1.webp', iconClass: 'bg-blue-50 text-blue-600' },
  { title: '知识点总结', description: '梳理知识要点\n构建知识体系', iconSrc: '/aichat-icon/icon-2.webp', iconClass: 'bg-emerald-50 text-emerald-600' },
  { title: '错题分析', description: '智能分析错因\n提供改进建议', iconSrc: '/aichat-icon/icon-3.webp', iconClass: 'bg-orange-50 text-orange-600' },
  { title: '生成练习题', description: '生成相似题目\n巩固知识掌握', iconSrc: '/aichat-icon/icon-4.webp', iconClass: 'bg-violet-50 text-violet-600' },
];

const AiChat = () => {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [showPromptDropdown, setShowPromptDropdown] = useState(false);
  const [chatHistoryList, setChatHistoryList] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiConfigView>({ provider: 'custom', modelId: '' });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadAiConfig = async () => {
      try {
        const config = await api.settings.getApiConfig();
        setAiConfig({ provider: config.provider || 'custom', modelId: config.modelId || '' });
      } catch (err) {
        console.error('加载 AI 配置失败:', err);
      }
    };
    loadAiConfig();
  }, []);

  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const list = await api.prompt.getAll();
        setPrompts(list);
        if (list.length > 0) {
          const defaultPrompt = list.find(p => p.isDefault) || list[0];
          setSelectedPrompt(defaultPrompt);
        }
      } catch (err) {
        console.error('加载 Prompt 列表失败:', err);
      }
    };
    loadPrompts();
  }, []);

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const list = await api.chatHistory.getAll(50);
      setChatHistoryList(list);
    } catch (err) {
      console.error('加载聊天记录失败:', err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      const target = e.target instanceof Node ? e.target : null;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowPromptDropdown(false);
      }
      if (historyRef.current && !historyRef.current.contains(target)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: AiMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const result = await api.ai.chat(newMessages, selectedPrompt?.id);
      const assistantMessage: AiMessage = {
        role: 'assistant',
        content: result.message || result.content || '抱歉，我无法理解您的问题。',
      };
      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      await saveChatToHistory(finalMessages);
    } catch (err) {
      setError(errorMessage(err, 'AI 回复失败，请重试'));
      setMessages(messages);
      setInput(userMessage.content);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const normalizeHistoryMessages = (value: unknown): AiMessage[] => {
    return Array.isArray(value)
      ? value.filter((item): item is AiMessage => Boolean(item) && typeof item.role === 'string' && typeof item.content === 'string')
      : [];
  };

  const saveChatToHistory = async (msgs: AiMessage[]) => {
    try {
      const firstUserMsg = msgs.find(m => m.role === 'user');
      const title = firstUserMsg ? firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '') : '新对话';

      if (currentChatId) {
        await api.chatHistory.update(currentChatId, msgs);
      } else {
        const saved = await api.chatHistory.save({
          title,
          messages: msgs,
          promptId: selectedPrompt?.id,
        });
        setCurrentChatId(saved.id);
      }
      await loadChatHistory();
    } catch (err) {
      console.error('保存聊天记录失败:', err);
    }
  };

  const loadChat = async (chatId: number) => {
    try {
      const chat = await api.chatHistory.getById(chatId);
      if (chat) {
        setMessages(normalizeHistoryMessages(chat.messages));
        setCurrentChatId(chat.id);
        if (chat.promptId && prompts.length > 0) {
          const prompt = prompts.find(p => p.id === chat.promptId);
          if (prompt) setSelectedPrompt(prompt);
        }
      }
      setShowHistory(false);
    } catch (err) {
      console.error('加载聊天记录失败:', err);
    }
  };

  const deleteChat = async (chatId: number, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      await api.chatHistory.delete(chatId);
      await loadChatHistory();
      if (chatId === currentChatId) {
        setMessages([]);
        setCurrentChatId(null);
      }
    } catch (err) {
      console.error('删除聊天记录失败:', err);
    }
  };

  const newChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setError('');
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setError('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <PageHeaderNoTitle
        subtitle="有任何学习问题，都可以问我"
        actions={(
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative" ref={historyRef}>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-blue-50 hover:text-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <History size={16} />
                历史记录
              </button>
              {showHistory && (
                <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-popover dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-700">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">历史对话</span>
                    <button onClick={newChat} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      <Plus size={14} />
                      新对话
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-2">
                    {chatHistoryList.length === 0 ? (
                      <div className="p-5 text-center text-sm text-gray-400">暂无历史记录</div>
                    ) : (
                      chatHistoryList.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => loadChat(chat.id)}
                          className={cn(
                            'group flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors',
                            currentChatId === chat.id ? 'bg-primary-soft' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          )}
                        >
                          <p className={cn('min-w-0 flex-1 truncate text-sm font-semibold', currentChatId === chat.id ? 'text-primary' : 'text-gray-600 dark:text-gray-300')}>
                            {chat.title}
                          </p>
                          <button
                            onClick={(e) => deleteChat(chat.id, e)}
                            className="rounded-lg p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-danger group-hover:opacity-100"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowPromptDropdown(!showPromptDropdown)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-blue-50 hover:text-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                {selectedPrompt?.name || '智能模型 Pro'}
                <ChevronDown size={14} className={cn('text-gray-400 transition-transform', showPromptDropdown && 'rotate-180')} />
              </button>
              {showPromptDropdown && (
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-gray-100 bg-white p-2 shadow-popover dark:border-gray-700 dark:bg-gray-800">
                  {prompts.map((prompt) => (
                    <button
                      key={prompt.id}
                      onClick={() => {
                        setSelectedPrompt(prompt);
                        setShowPromptDropdown(false);
                      }}
                      className={cn(
                        'w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors',
                        selectedPrompt?.id === prompt.id
                          ? 'bg-primary-soft text-primary'
                          : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                      )}
                    >
                      {prompt.name}
                      {prompt.isDefault && <span className="ml-2 text-xs text-gray-400">(默认)</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-danger"
              >
                <Trash2 size={16} />
                清空对话
              </button>
            )}
          </div>
        )}
      />

      <SurfaceCard className="flex min-h-0 flex-1 flex-col overflow-hidden" padding="p-0">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">
          {messages.length === 0 ? (
            <div className="flex min-h-full items-center justify-center py-10">
              <AIChatWelcome features={features} />
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-5">
              {messages.map((msg, index) => (
                <ChatMessageBubble
                  key={index}
                  role={msg.role}
                  avatar={msg.role === 'user' ? <User size={18} /> : null}
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content.trim()}</div>
                  ) : (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={markdownComponents}
                      >
                        {preprocessLatex(msg.content.trim())}
                      </ReactMarkdown>
                    </div>
                  )}
                </ChatMessageBubble>
              ))}
              {loading && (
                <ChatMessageBubble
                  role="assistant"
                  avatar={<AiIcon provider={aiConfig.provider} modelId={aiConfig.modelId} size={28} />}
                >
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </ChatMessageBubble>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {error && (
          <div className="px-6 pb-3">
            <AlertBanner type="danger">{error}</AlertBanner>
          </div>
        )}

        <div className="p-5">
          <ChatComposer
            inputRef={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onSend={handleSend}
            loading={loading}
            disabled={!input.trim()}
            placeholder="输入你的问题..."
          />
        </div>
      </SurfaceCard>
    </div>
  );
};

export default AiChat;
