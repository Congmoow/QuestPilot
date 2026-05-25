import { useEffect, useState } from 'react';
import api from '../../../api';
import type { ApiConnectionResult } from '../../../api';
import { AI_PROVIDERS } from '../utils/providers';

type TestResult = ApiConnectionResult & { message: string };

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const useApiConfig = () => {
  const [provider, setProvider] = useState('custom');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyPreview, setApiKeyPreview] = useState('');
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [apiUrl, setApiUrl] = useState('https://api.newcoin.top');
  const [modelId, setModelId] = useState('minimax-m2');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await api.settings.getApiConfig();
        setApiKey('');
        setApiKeyPreview(config.apiKeyPreview || '');
        setHasSavedApiKey(Boolean(config.hasApiKey || config.apiKey));
        setApiUrl(config.apiUrl || 'https://api.newcoin.top');
        setModelId(config.modelId || 'minimax-m2');
        setProvider(config.provider || 'custom');
      } catch (error) {
        console.error('加载 API 配置失败:', error);
      }
    };
    loadConfig();
  }, []);

  const handleProviderChange = (providerId: string) => {
    setProvider(providerId);
    const selected = AI_PROVIDERS.find((p) => p.id === providerId);
    if (selected && selected.url) {
      setApiUrl(selected.url);
      if (selected.models.length > 0) {
        setModelId(selected.models[0]);
      }
    }
    setTestResult(null);
  };

  const handleSaveApiConfig = async () => {
    setSaving(true);
    setSaved(false);
    setTestResult(null);
    try {
      await api.settings.setApiConfig({ apiKey: apiKey.trim(), apiUrl, modelId, provider });
      const config = await api.settings.getApiConfig();
      setApiKey('');
      setApiKeyPreview(config.apiKeyPreview || '');
      setHasSavedApiKey(Boolean(config.hasApiKey || config.apiKey));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('保存 API 配置失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim() && !hasSavedApiKey) {
      setTestResult({ success: false, message: '请先输入 API Key' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      await api.settings.setApiConfig({ apiKey: apiKey.trim(), apiUrl, modelId, provider });
      const result = await api.settings.testApiConnection();
      const config = await api.settings.getApiConfig();
      setApiKey('');
      setApiKeyPreview(config.apiKeyPreview || '');
      setHasSavedApiKey(Boolean(config.hasApiKey || config.apiKey));
      setTestResult({ success: true, message: result.message || 'API 连接成功' });
    } catch (error) {
      setTestResult({ success: false, message: errorMessage(error, 'API 连接失败') });
    } finally {
      setTesting(false);
    }
  };

  const currentProvider = AI_PROVIDERS.find((p) => p.id === provider) || AI_PROVIDERS[0];

  return {
    provider, apiKey, setApiKey,
    apiKeyPreview, hasSavedApiKey,
    apiUrl, setApiUrl,
    modelId, setModelId,
    showApiKey, setShowApiKey,
    testing, testResult,
    saving, saved,
    currentProvider,
    handleProviderChange,
    handleSaveApiConfig,
    handleTestConnection,
  };
};
