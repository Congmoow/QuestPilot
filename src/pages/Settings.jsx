import { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  Cpu,
  Globe,
  Key,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  TestTube,
  Trash2,
  XCircle,
} from 'lucide-react';
import api from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  ActionButton,
  AlertBanner,
  Field,
  IconButton,
  PageHeader,
  PasswordInput,
  SelectInput,
  SurfaceCard,
  TextareaInput,
  TextInput,
} from '../components/ui';

const AI_PROVIDERS = [
  { id: 'custom', name: '自定义', url: '', models: [], placeholder: '请输入 API 地址' },
  { id: 'openai', name: 'OpenAI', url: 'https://api.openai.com', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'], placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Claude (Anthropic)', url: 'https://api.anthropic.com', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'], placeholder: 'sk-ant-...' },
  { id: 'gemini', name: 'Google Gemini', url: 'https://generativelanguage.googleapis.com', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'], placeholder: 'AIza...' },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'], placeholder: 'sk-...' },
  { id: 'qwen', name: '通义千问 (阿里)', url: 'https://dashscope.aliyuncs.com/compatible-mode', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'], placeholder: 'sk-...' },
  { id: 'zhipu', name: '智谱 GLM', url: 'https://open.bigmodel.cn/api/paas', models: ['glm-4-plus', 'glm-4', 'glm-4-flash'], placeholder: '...' },
  { id: 'moonshot', name: 'Moonshot (月之暗面)', url: 'https://api.moonshot.cn', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], placeholder: 'sk-...' },
  { id: 'doubao', name: '豆包 (字节)', url: 'https://ark.cn-beijing.volces.com/api', models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-lite-4k'], placeholder: '...' },
  { id: 'minimax', name: 'MiniMax', url: 'https://api.minimax.chat', models: ['abab6.5s-chat', 'abab5.5-chat'], placeholder: '...' },
  { id: 'baichuan', name: '百川智能', url: 'https://api.baichuan-ai.com', models: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan2-Turbo'], placeholder: 'sk-...' },
  { id: 'yi', name: '零一万物 (Yi)', url: 'https://api.lingyiwanwu.com', models: ['yi-large', 'yi-medium', 'yi-spark'], placeholder: '...' },
  { id: 'groq', name: 'Groq', url: 'https://api.groq.com/openai', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'], placeholder: 'gsk_...' },
  { id: 'together', name: 'Together AI', url: 'https://api.together.xyz', models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'], placeholder: '...' },
  { id: 'siliconflow', name: 'SiliconFlow', url: 'https://api.siliconflow.cn', models: ['Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V3'], placeholder: 'sk-...' },
];

const Settings = () => {
  const [provider, setProvider] = useState('custom');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('https://api.newcoin.top');
  const [modelId, setModelId] = useState('minimax-m2');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [wrongBookThreshold, setWrongBookThreshold] = useState('3');
  const [savingWrongBook, setSavingWrongBook] = useState(false);
  const [savedWrongBook, setSavedWrongBook] = useState(false);

  const [prompts, setPrompts] = useState([]);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [promptName, setPromptName] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [deletePromptDialogOpen, setDeletePromptDialogOpen] = useState(false);
  const [deletingPrompt, setDeletingPrompt] = useState(null);
  const [deletingPromptLoading, setDeletingPromptLoading] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await api.settings.getApiConfig();
        setApiKey(config.apiKey || '');
        setApiUrl(config.apiUrl || 'https://api.newcoin.top');
        setModelId(config.modelId || 'minimax-m2');
        setProvider(config.provider || 'custom');
      } catch (error) {
        console.error('加载 API 配置失败:', error);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    const loadWrongBookThreshold = async () => {
      try {
        const threshold = await api.settings.getWrongBookThreshold();
        setWrongBookThreshold(String(threshold || 3));
      } catch (error) {
        console.error('加载错题本阈值失败:', error);
      }
    };
    loadWrongBookThreshold();
  }, []);

  const handleProviderChange = (providerId) => {
    setProvider(providerId);
    const selected = AI_PROVIDERS.find(p => p.id === providerId);
    if (selected && selected.url) {
      setApiUrl(selected.url);
      if (selected.models.length > 0) {
        setModelId(selected.models[0]);
      }
    }
    setTestResult(null);
  };

  const currentProvider = AI_PROVIDERS.find(p => p.id === provider) || AI_PROVIDERS[0];

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const list = await window.electronAPI.prompt.getAll();
      setPrompts(list);
    } catch (error) {
      console.error('加载 Prompt 列表失败:', error);
    }
  };

  const handleSaveWrongBookThreshold = async () => {
    setSavingWrongBook(true);
    setSavedWrongBook(false);
    try {
      const parsed = Number(wrongBookThreshold);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 999) {
        alert('阈值必须是 1-999 的数字');
        return;
      }
      await api.settings.setWrongBookThreshold(parsed);
      setSavedWrongBook(true);
      setTimeout(() => setSavedWrongBook(false), 3000);
    } catch (error) {
      console.error('保存错题本阈值失败:', error);
    } finally {
      setSavingWrongBook(false);
    }
  };

  const handleSavePrompt = async () => {
    if (!promptName.trim() || !promptContent.trim()) return;

    setSavingPrompt(true);
    try {
      if (editingPrompt) {
        await window.electronAPI.prompt.update(editingPrompt.id, {
          name: promptName,
          content: promptContent,
        });
      } else {
        await window.electronAPI.prompt.create({
          name: promptName,
          content: promptContent,
        });
      }
      await loadPrompts();
      resetPromptForm();
    } catch (error) {
      console.error('保存 Prompt 失败:', error);
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleEditPrompt = (prompt) => {
    setEditingPrompt(prompt);
    setPromptName(prompt.name);
    setPromptContent(prompt.content);
    setShowPromptForm(true);
  };

  const handleOpenDeletePromptDialog = (prompt) => {
    setDeletingPrompt(prompt);
    setDeletePromptDialogOpen(true);
  };

  const handleCloseDeletePromptDialog = () => {
    setDeletePromptDialogOpen(false);
    setDeletingPrompt(null);
  };

  const handleDeletePrompt = async () => {
    if (!deletingPrompt) return;

    setDeletingPromptLoading(true);
    try {
      await window.electronAPI.prompt.delete(deletingPrompt.id);
      await loadPrompts();
      if (editingPrompt?.id === deletingPrompt.id) {
        resetPromptForm();
      }
    } catch (error) {
      alert(error.message || '删除失败');
      throw error;
    } finally {
      setDeletingPromptLoading(false);
    }
  };

  const resetPromptForm = () => {
    setEditingPrompt(null);
    setPromptName('');
    setPromptContent('');
    setShowPromptForm(false);
  };

  const handleSaveApiConfig = async () => {
    setSaving(true);
    setSaved(false);
    setTestResult(null);
    try {
      await api.settings.setApiConfig({ apiKey, apiUrl, modelId, provider });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('保存 API 配置失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestResult({ success: false, message: '请先输入 API Key' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      await api.settings.setApiConfig({ apiKey, apiUrl, modelId, provider });
      const result = await api.settings.testApiConnection();
      setTestResult({ success: true, message: result.message || 'API 连接成功' });
    } catch (error) {
      setTestResult({ success: false, message: error.message || 'API 连接失败' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="系统设置" subtitle="配置 AI 功能与练习偏好" />

      <SurfaceCard padding="p-6">
        <div className="mb-4 flex items-start gap-4">
          <div className="ui-icon-tile size-12 bg-primary-soft text-primary">
            <BookOpen size={24} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">错题本设置</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500 dark:text-gray-400">
              错题本会记录练习中答错的题目。答对次数达到阈值后，该题会自动从错题本移除。
            </p>
          </div>
        </div>

        <div className="max-w-xl space-y-4">
          <Field label="自动移除阈值（答对次数）">
            <TextInput
              type="number"
              min={1}
              max={999}
              value={wrongBookThreshold}
              onChange={(e) => setWrongBookThreshold(e.target.value)}
            />
          </Field>

          {savedWrongBook && (
            <AlertBanner type="success">阈值已保存</AlertBanner>
          )}

          <ActionButton onClick={handleSaveWrongBookThreshold} disabled={savingWrongBook} loading={savingWrongBook}>
            保存设置
          </ActionButton>
        </div>
      </SurfaceCard>

      <SurfaceCard padding="p-6">
        <div className="mb-4 flex items-start gap-4">
          <div className="ui-icon-tile size-12 bg-violet-50 text-violet-600">
            <Key size={24} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">AI API 配置</h2>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-gray-500 dark:text-gray-400">
              支持 OpenAI、Claude、Gemini、DeepSeek、通义千问、智谱等主流 AI 服务，配置后可使用 AI 智能识别和问答功能。
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <Field label={<span className="inline-flex items-center gap-2"><Globe size={16} />AI 服务提供商</span>}>
            <SelectInput value={provider} onChange={(e) => handleProviderChange(e.target.value)}>
              {AI_PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </SelectInput>
          </Field>

          <Field label={<span className="inline-flex items-center gap-2"><Globe size={16} />API 地址</span>} hint={provider === 'custom' ? '支持 OpenAI 兼容的 API 地址' : undefined}>
            <TextInput
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder={currentProvider.placeholder || 'https://api.openai.com'}
              disabled={provider !== 'custom'}
            />
          </Field>

          <Field label={<span className="inline-flex items-center gap-2"><Key size={16} />API Key</span>}>
            <PasswordInput
              show={showApiKey}
              onToggleShow={() => setShowApiKey(!showApiKey)}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={currentProvider.placeholder || 'sk-xxxxxxxxxxxxxxxx'}
            />
          </Field>

          <Field label={<span className="inline-flex items-center gap-2"><Cpu size={16} />模型名称（可选）</span>}>
            {currentProvider.models.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                <SelectInput
                  value={currentProvider.models.includes(modelId) ? modelId : ''}
                  onChange={(e) => setModelId(e.target.value)}
                >
                  {currentProvider.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {!currentProvider.models.includes(modelId) && modelId && (
                    <option value={modelId}>{modelId} (自定义)</option>
                  )}
                </SelectInput>
                <TextInput
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="或输入自定义模型 ID"
                />
              </div>
            ) : (
              <TextInput
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="gpt-3.5-turbo"
              />
            )}
          </Field>
        </div>

        <div className="mt-5 space-y-3">
          {testResult && (
            <AlertBanner type={testResult.success ? 'success' : 'danger'}>
              <span className="inline-flex items-center gap-2">
                {testResult.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
                {testResult.message}
              </span>
            </AlertBanner>
          )}

          {saved && <AlertBanner type="success">配置已保存</AlertBanner>}

          <div className="flex flex-wrap gap-3">
            <ActionButton onClick={handleSaveApiConfig} disabled={saving} loading={saving}>
              保存配置
            </ActionButton>
            <ActionButton
              variant="secondary"
              icon={TestTube}
              onClick={handleTestConnection}
              disabled={testing || !apiKey}
              loading={testing}
            >
              测试连接
            </ActionButton>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard padding="p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="ui-icon-tile size-12 bg-blue-50 text-primary">
              <MessageSquare size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">AI Prompt 管理</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500 dark:text-gray-400">
                自定义 AI 问答的系统提示词，可以让 AI 扮演不同角色或专注于特定领域。
              </p>
            </div>
          </div>
          <ActionButton
            icon={Plus}
            onClick={() => {
              resetPromptForm();
              setShowPromptForm(true);
            }}
          >
            新建 Prompt
          </ActionButton>
        </div>

        {showPromptForm && (
          <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 dark:border-gray-700 dark:bg-gray-800/80">
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">
              {editingPrompt ? '编辑 Prompt' : '新建 Prompt'}
            </h3>
            <div className="space-y-4">
              <Field label="名称">
                <TextInput
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                  placeholder="如：英语老师、数学助手"
                />
              </Field>
              <Field label="提示词内容">
                <TextareaInput
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  placeholder="描述 AI 的角色、能力和回答风格..."
                  rows={6}
                />
              </Field>
              <div className="flex flex-wrap gap-3">
                <ActionButton
                  onClick={handleSavePrompt}
                  disabled={savingPrompt || !promptName.trim() || !promptContent.trim()}
                  loading={savingPrompt}
                >
                  保存
                </ActionButton>
                <ActionButton variant="secondary" onClick={resetPromptForm}>
                  取消
                </ActionButton>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {prompts.map((prompt) => (
            <div key={prompt.id} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">{prompt.name}</h4>
                    {prompt.isDefault && (
                      <span className="rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">默认</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                    {prompt.content}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton label="编辑 Prompt" icon={Pencil} onClick={() => handleEditPrompt(prompt)} />
                  {!prompt.isDefault && (
                    <IconButton
                      label="删除 Prompt"
                      icon={Trash2}
                      onClick={() => handleOpenDeletePromptDialog(prompt)}
                      className="hover:bg-red-50 hover:text-danger dark:hover:bg-red-900/20"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <ConfirmDialog
        open={deletePromptDialogOpen}
        onClose={handleCloseDeletePromptDialog}
        onConfirm={handleDeletePrompt}
        title="删除 Prompt"
        message={`确定要删除 Prompt「${deletingPrompt?.name || ''}」吗？删除后将无法恢复。`}
        confirmText="删除"
        type="danger"
        loading={deletingPromptLoading}
      />

      <p className="text-xs text-gray-400 dark:text-gray-500">
        说明：API Key 将安全存储在本地数据库中，不会上传到任何服务器。
      </p>
    </div>
  );
};

export default Settings;
