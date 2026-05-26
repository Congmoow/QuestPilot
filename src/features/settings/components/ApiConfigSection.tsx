import { useEffect } from 'react';
import { Cpu, Globe, Key, TestTube } from 'lucide-react';
import { toast } from 'sonner';
import {
  ActionButton,
  Field,
  PasswordInput,
  SelectInput,
  SurfaceCard,
  TextInput,
} from '../../../components/ui';
import { useApiConfig } from '../hooks/useApiConfig';
import { AI_PROVIDERS } from '../utils/providers';

const ApiConfigSection = () => {
  const {
    provider,
    apiKey,
    setApiKey,
    apiKeyPreview,
    hasSavedApiKey,
    apiUrl,
    setApiUrl,
    modelId,
    setModelId,
    showApiKey,
    setShowApiKey,
    testing,
    testResult,
    saving,
    saved,
    currentProvider,
    handleProviderChange,
    handleSaveApiConfig,
    handleTestConnection,
  } = useApiConfig();

  useEffect(() => {
    if (saved) {
      toast.success('配置已保存');
    }
  }, [saved]);

  useEffect(() => {
    if (testResult) {
      if (testResult.success) {
        toast.success(testResult.message || 'API 连接成功');
      } else {
        toast.error(testResult.message || 'API 连接失败');
      }
    }
  }, [testResult]);

  return (
    <SurfaceCard padding="p-6">
      <div className="mb-4 flex items-start gap-4">
        <div className="ui-icon-tile size-12 bg-violet-50 text-violet-600">
          <Key size={24} />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">AI API 配置</h2>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-gray-500 dark:text-gray-400">
            支持 OpenAI、Claude、Gemini、DeepSeek、通义千问、智谱等主流 AI 服务，配置后可使用 AI
            智能识别和问答功能。
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <Field
          label={
            <span className="inline-flex items-center gap-2">
              <Globe size={16} />
              AI 服务提供商
            </span>
          }
        >
          <SelectInput value={provider} onChange={(e) => handleProviderChange(e.target.value)}>
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field
          label={
            <span className="inline-flex items-center gap-2">
              <Globe size={16} />
              API 地址
            </span>
          }
          hint={provider === 'custom' ? '支持 OpenAI 兼容的 API 地址' : undefined}
        >
          <TextInput
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder={currentProvider.placeholder || 'https://api.openai.com'}
            disabled={provider !== 'custom'}
          />
        </Field>

        <Field
          label={
            <span className="inline-flex items-center gap-2">
              <Key size={16} />
              API Key
            </span>
          }
          hint={
            hasSavedApiKey
              ? `已保存：${apiKeyPreview || '已隐藏'}；留空保存会保留现有 Key`
              : '保存后不会在界面回显完整 Key'
          }
        >
          <PasswordInput
            show={showApiKey}
            onToggleShow={() => setShowApiKey(!showApiKey)}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              hasSavedApiKey
                ? '留空则保留已保存 Key'
                : currentProvider.placeholder || '输入 API Key'
            }
          />
        </Field>

        <Field
          label={
            <span className="inline-flex items-center gap-2">
              <Cpu size={16} />
              模型名称（可选）
            </span>
          }
        >
          {currentProvider.models.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              <SelectInput
                value={currentProvider.models.includes(modelId) ? modelId : ''}
                onChange={(e) => setModelId(e.target.value)}
              >
                {currentProvider.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
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
  );
};

export default ApiConfigSection;
