import { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  Cpu,
  DatabaseBackup,
  Globe,
  Key,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  TestTube,
  Trash2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import api from '../api';
import type { ApiConnectionResult, LegacyDatabaseCandidate, LegacyDatabaseReplaceResult, LegacyDatabaseStatus, Prompt } from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
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

type AiProvider = {
  id: string;
  name: string;
  url: string;
  models: string[];
  placeholder: string;
};

type TestResult = ApiConnectionResult & {
  message: string;
};

const errorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

const AI_PROVIDERS: AiProvider[] = [
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
  const [apiKeyPreview, setApiKeyPreview] = useState('');
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [apiUrl, setApiUrl] = useState('https://api.newcoin.top');
  const [modelId, setModelId] = useState('minimax-m2');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [wrongBookThreshold, setWrongBookThreshold] = useState('3');
  const [savingWrongBook, setSavingWrongBook] = useState(false);
  const [savedWrongBook, setSavedWrongBook] = useState(false);

  const [migrationStatus, setMigrationStatus] = useState<LegacyDatabaseStatus | null>(null);
  const [loadingMigrationStatus, setLoadingMigrationStatus] = useState(false);
  const [replacingLegacyPath, setReplacingLegacyPath] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<LegacyDatabaseReplaceResult | null>(null);
  const [migrationError, setMigrationError] = useState('');

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [promptName, setPromptName] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [deletePromptDialogOpen, setDeletePromptDialogOpen] = useState(false);
  const [deletingPrompt, setDeletingPrompt] = useState<Prompt | null>(null);
  const [deletingPromptLoading, setDeletingPromptLoading] = useState(false);

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

  useEffect(() => {
    loadMigrationStatus();
  }, []);

  const handleProviderChange = (providerId: string) => {
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
      const list = await api.prompt.getAll();
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

  const loadMigrationStatus = async () => {
    setLoadingMigrationStatus(true);
    setMigrationError('');
    try {
      const status = await api.migration.getLegacyStatus();
      setMigrationStatus(status);
    } catch (error) {
      setMigrationError(errorMessage(error, '读取旧库迁移状态失败'));
    } finally {
      setLoadingMigrationStatus(false);
    }
  };

  const legacyCandidatesWithData = (migrationStatus?.candidates || []).filter((candidate: LegacyDatabaseCandidate) => candidate.hasUserData);
  const needsExplicitReset = migrationStatus?.recommendedAction === 'requires_explicit_reset';

  const handleBackupAndReplace = async (legacyPath: string) => {
    const confirmed = window.confirm(
      '此操作会先备份当前 Tauri 数据库，然后使用选中的旧数据库替换当前数据库。替换后建议重启应用继续使用。是否继续？'
    );
    if (!confirmed) return;

    setReplacingLegacyPath(legacyPath);
    setMigrationError('');
    setMigrationResult(null);
    try {
      const result = await api.migration.backupAndReplaceFromLegacy(legacyPath);
      setMigrationResult(result);
      await loadMigrationStatus();
    } catch (error) {
      setMigrationError(errorMessage(error, '备份并替换旧库失败'));
    } finally {
      setReplacingLegacyPath(null);
    }
  };

  const handleSavePrompt = async () => {
    if (!promptName.trim() || !promptContent.trim()) return;

    setSavingPrompt(true);
    try {
      if (editingPrompt) {
        await api.prompt.update(editingPrompt.id, {
          name: promptName,
          content: promptContent,
        });
      } else {
        await api.prompt.create({
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

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setPromptName(prompt.name);
    setPromptContent(prompt.content);
    setShowPromptForm(true);
  };

  const handleOpenDeletePromptDialog = (prompt: Prompt) => {
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
      await api.prompt.delete(deletingPrompt.id);
      await loadPrompts();
      if (editingPrompt?.id === deletingPrompt.id) {
        resetPromptForm();
      }
    } catch (error) {
      alert(errorMessage(error, '删除失败'));
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
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="ui-icon-tile size-12 bg-amber-50 text-amber-600">
              <DatabaseBackup size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Tauri 数据迁移</h2>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-gray-500 dark:text-gray-400">
                当当前 Tauri 数据库已有数据时，旧 Electron 数据库不会被自动覆盖；如需切换旧库，必须先备份当前库再显式替换。
              </p>
            </div>
          </div>
          <ActionButton
            variant="secondary"
            icon={RefreshCw}
            onClick={loadMigrationStatus}
            disabled={loadingMigrationStatus}
            loading={loadingMigrationStatus}
          >
            刷新状态
          </ActionButton>
        </div>

        <div className="space-y-4">
          {migrationError && (
            <AlertBanner type="danger" title="迁移状态异常">
              {migrationError}
            </AlertBanner>
          )}

          {migrationResult && (
            <AlertBanner type="success" title="已备份并使用旧库替换">
              当前数据库已替换；备份路径：{migrationResult.backupPath || '无旧库备份'}。请重启应用确认数据。
            </AlertBanner>
          )}

          {migrationStatus ? (
            <>
              {needsExplicitReset ? (
                <AlertBanner type="warning" title="检测到旧库数据">
                  当前 Tauri 数据库和旧数据库都包含用户数据，系统不会自动覆盖。请确认后选择一个旧库执行备份替换。
                </AlertBanner>
              ) : (
                <AlertBanner type={migrationStatus.recommendedAction === 'auto_migrate' ? 'info' : 'success'}>
                  {migrationStatus.recommendedAction === 'auto_migrate'
                    ? '检测到旧库数据，当前目标库为空或缺失时会自动迁移。'
                    : '未检测到需要人工处置的旧库冲突。'}
                </AlertBanner>
              )}

              <div className="grid gap-3">
                {legacyCandidatesWithData.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">暂无包含用户数据的旧数据库候选。</p>
                ) : legacyCandidatesWithData.map((candidate) => {
                  const fileName = candidate.path.split(/[/\\]/).pop() || candidate.path;
                  const isReplacing = replacingLegacyPath === candidate.path;
                  return (
                    <div key={candidate.path} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/70">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{fileName}</p>
                          <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400" title={candidate.path}>
                            {candidate.path}
                          </p>
                          {candidate.inspectError && (
                            <p className="mt-2 text-xs text-danger">{candidate.inspectError}</p>
                          )}
                        </div>
                        <ActionButton
                          variant="danger"
                          onClick={() => handleBackupAndReplace(candidate.path)}
                          disabled={!needsExplicitReset || isReplacing}
                          loading={isReplacing}
                        >
                          备份并使用旧库替换
                        </ActionButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <AlertBanner type="info">正在读取旧库迁移状态...</AlertBanner>
          )}
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

          <Field
            label={<span className="inline-flex items-center gap-2"><Key size={16} />API Key</span>}
            hint={hasSavedApiKey ? `已保存：${apiKeyPreview || '已隐藏'}；留空保存会保留现有 Key` : '保存后不会在界面回显完整 Key'}
          >
            <PasswordInput
              show={showApiKey}
              onToggleShow={() => setShowApiKey(!showApiKey)}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasSavedApiKey ? '留空则保留已保存 Key' : (currentProvider.placeholder || '输入 API Key')}
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
              {testResult.message}
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
              disabled={testing || (!apiKey.trim() && !hasSavedApiKey)}
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

        <Dialog
          open={showPromptForm}
          onClose={resetPromptForm}
          title={editingPrompt ? '编辑 Prompt' : '新建 Prompt'}
          size="lg"
        >
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
                rows={8}
              />
            </Field>
            <div className="flex flex-wrap gap-3 pt-2">
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
        </Dialog>

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
