import { useEffect, useRef, useState, type MouseEvent } from 'react';
import api from '../../../api';
import type { AiMessage, ChatHistory, Prompt } from '../../../api';
import type { AiConfigView } from '../utils/providers';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const normalizeHistoryMessages = (value: unknown): AiMessage[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is AiMessage =>
          Boolean(item) &&
          typeof item.role === 'string' &&
          typeof item.content === 'string'
      )
    : [];

export const useAiChat = () => {
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

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
          const defaultPrompt = list.find((p) => p.isDefault) || list[0];
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const loadChatHistory = async () => {
    try {
      const list = await api.chatHistory.getAll(50);
      setChatHistoryList(list);
    } catch (err) {
      console.error('加载聊天记录失败:', err);
    }
  };

  const saveChatToHistory = async (msgs: AiMessage[]) => {
    try {
      const firstUserMsg = msgs.find((m) => m.role === 'user');
      const title =
        firstUserMsg
          ? firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')
          : '新对话';

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

  const loadChat = async (chatId: number) => {
    try {
      const chat = await api.chatHistory.getById(chatId);
      if (chat) {
        setMessages(normalizeHistoryMessages(chat.messages));
        setCurrentChatId(chat.id);
        if (chat.promptId && prompts.length > 0) {
          const prompt = prompts.find((p) => p.id === chat.promptId);
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

  return {
    messages,
    input,
    setInput,
    loading,
    error,
    prompts,
    selectedPrompt,
    setSelectedPrompt,
    showPromptDropdown,
    setShowPromptDropdown,
    chatHistoryList,
    currentChatId,
    showHistory,
    setShowHistory,
    aiConfig,
    messagesEndRef,
    inputRef,
    dropdownRef,
    historyRef,
    handleSend,
    handleKeyDown,
    loadChat,
    deleteChat,
    newChat,
    clearChat,
  };
};
