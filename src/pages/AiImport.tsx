import { CheckCircle, Code, Save, Trash2, Wand2, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  ActionButton,
  AlertBanner,
  JsonEditorPanel,
  PageHeader,
  ParsedQuestionItem,
  ParseEmptyState,
  SelectInput,
  SegmentedTabs,
  SurfaceCard,
} from '../components/ui';
import { TYPE_LABELS } from '../lib/questionLabels';
import { useAiImport } from '../features/ai-import/hooks/useAiImport';
import { getChunkIndex } from '../features/ai-import/utils/normalize';

type ImportMode = 'ai' | 'json';

const MODE_TABS: Array<{ id: ImportMode; label: string; icon: LucideIcon }> = [
  { id: 'ai', label: 'AI 智能解析', icon: Wand2 },
  { id: 'json', label: 'JSON 批量导入', icon: Code },
];

const AI_PLACEHOLDER = `请粘贴题目内容，例如：

1. 以下哪个是JavaScript的基本数据类型？
A. String
B. Array
C. Object
D. Function
答案：A
解析：String是JavaScript的基本数据类型

2. React是一个前端框架。（判断题）
答案：正确

3. HTML的全称是___。
答案：HyperText Markup Language`;

const JSON_PLACEHOLDER = `[
  {
    "题型": "单选题",
    "题目": "以下哪个是基本数据类型？",
    "选项": ["A. String", "B. Array", "C. Object"],
    "答案": "A",
    "解析": "String 是基本数据类型"
  },
  {
    "题型": "多选题",
    "题目": "请选择正确选项",
    "选项": ["A. xxx", "B. xxx", "C. xxx"],
    "答案": "A|B"
  },
  {
    "题型": "判断题",
    "题目": "React 是前端框架。",
    "答案": "正确"
  },
  {
    "题型": "填空题",
    "题目": "___ 是中国首都",
    "答案": "北京"
  },
  {
    "题型": "简答题",
    "题目": "请简述 MVC。",
    "答案": "..."
  }
]`;

const AiImport = () => {
  const {
    banks,
    selectedBankId,
    setSelectedBankId,
    mode,
    inputText,
    setInputText,
    jsonInput,
    setJsonInput,
    parsing,
    parsedQuestions,
    error,
    importing,
    importResult,
    hasApiKey,
    parseWarnings,
    showParseWarnings,
    setShowParseWarnings,
    handleParse,
    handleRemoveQuestion,
    handleImport,
    handleClear,
    handleJsonParse,
    handleModeChange,
  } = useAiImport();

  const currentInput = mode === 'ai' ? inputText : jsonInput;
  const currentPlaceholder = mode === 'ai' ? AI_PLACEHOLDER : JSON_PLACEHOLDER;

  return (
    <div className="space-y-6">
      <PageHeader title="AI 智能录入" subtitle="粘贴 JSON 格式的题目数据，直接批量导入" />

      <SegmentedTabs
        tabs={MODE_TABS.map((tab) => ({
          ...tab,
          disabled: tab.id === 'ai' && !hasApiKey,
          title: tab.id === 'ai' && !hasApiKey ? '请先在设置中配置 API Key' : '',
        }))}
        value={mode}
        onChange={handleModeChange}
      />

      {!hasApiKey && (
        <AlertBanner type="warning" title="AI 智能解析暂不可用">
          请先在系统设置中配置 API Key；当前可使用 JSON 批量导入。
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="flex h-full flex-col gap-4">
          <JsonEditorPanel
            title={mode === 'ai' ? '输入题目文本' : '输入 JSON 数据'}
            supportText="支持单选、多选、判断、填空、简答题"
            value={currentInput}
            onChange={(e) =>
              mode === 'ai' ? setInputText(e.target.value) : setJsonInput(e.target.value)
            }
            placeholder={currentPlaceholder}
          />

          <div className="flex flex-wrap gap-3">
            {mode === 'ai' ? (
              <ActionButton
                icon={Wand2}
                onClick={handleParse}
                disabled={parsing || !inputText.trim()}
                loading={parsing}
                className="min-w-52 flex-1"
              >
                {parsing ? 'AI 解析中...' : 'AI 智能解析'}
              </ActionButton>
            ) : (
              <ActionButton
                icon={Code}
                onClick={handleJsonParse}
                disabled={!jsonInput.trim()}
                className="min-w-52 flex-1"
              >
                解析 JSON
              </ActionButton>
            )}
            <ActionButton
              variant="secondary"
              icon={Trash2}
              onClick={handleClear}
              disabled={parsing}
            >
              清空
            </ActionButton>
          </div>

          {error && (
            <AlertBanner type="danger" title="解析失败">
              <span className="whitespace-pre-line">{error}</span>
            </AlertBanner>
          )}
        </div>

        <div className="flex h-full flex-col gap-4">
          <SurfaceCard className="flex flex-1 flex-col min-h-0" padding="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                解析结果 {parsedQuestions.length > 0 && `(${parsedQuestions.length} 道题目)`}
              </h2>
              {parsedQuestions.length > 0 && (
                <SelectInput
                  value={selectedBankId || ''}
                  onChange={(e) => setSelectedBankId(Number(e.target.value) || null)}
                  className="h-10 min-h-10 w-full sm:w-52"
                >
                  <option value="">选择题库</option>
                  {banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name}
                    </option>
                  ))}
                </SelectInput>
              )}
            </div>

            {parseWarnings && (
              <AlertBanner type="warning" className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowParseWarnings((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span>
                    已解析 {parseWarnings.questionCount} 道题目，有{' '}
                    {parseWarnings.chunkErrors.length} 个片段未能识别
                  </span>
                  <span className="text-xs">{showParseWarnings ? '收起' : '展开'}</span>
                </button>
                {showParseWarnings && (
                  <div className="mt-3 space-y-2">
                    {parseWarnings.chunkErrors.map((item, index) => {
                      const chunkIndex = getChunkIndex(item, index);
                      return (
                        <div
                          key={`${chunkIndex}-${index}`}
                          className="rounded-xl bg-white/70 px-3 py-2 text-sm dark:bg-gray-900/30"
                        >
                          <span className="font-semibold">第 {chunkIndex + 1} 个片段：</span>
                          {item.message || '解析失败'}
                        </div>
                      );
                    })}
                  </div>
                )}
              </AlertBanner>
            )}

            {parsedQuestions.length === 0 ? (
              <ParseEmptyState />
            ) : (
              <div className="max-h-[442px] space-y-3 overflow-y-auto pr-1">
                {parsedQuestions.map((question, index) => (
                  <ParsedQuestionItem
                    key={index}
                    question={question}
                    index={index}
                    typeLabel={TYPE_LABELS[question.type] || question.type}
                    onRemove={() => handleRemoveQuestion(index)}
                    removeIcon={Trash2}
                  />
                ))}
              </div>
            )}
          </SurfaceCard>

          {parsedQuestions.length > 0 && (
            <ActionButton
              variant="success"
              icon={Save}
              onClick={handleImport}
              disabled={importing || !selectedBankId}
              loading={importing}
              className="w-full"
            >
              {importing ? '导入中...' : `导入到题库 (${parsedQuestions.length} 道)`}
            </ActionButton>
          )}

          {importResult && (
            <AlertBanner
              type={importResult.failed === 0 ? 'success' : 'warning'}
              title={importResult.failed === 0 ? '导入成功' : '部分导入失败'}
            >
              <div className="flex items-center gap-2">
                {importResult.failed === 0 ? <CheckCircle size={18} /> : <XCircle size={18} />}
                <span>
                  成功导入 {importResult.success} 道题目
                  {importResult.failed > 0 && `，${importResult.failed} 道失败`}
                </span>
              </div>
              {importResult.failed > 0 && importResult.errors?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {importResult.errors.map((item, index) => (
                    <div
                      key={`${item.index ?? index}-${index}`}
                      className="rounded-xl bg-white/60 px-3 py-2 text-sm dark:bg-gray-900/30"
                    >
                      <span className="font-semibold">第 {(item.index ?? index) + 1} 道：</span>
                      {item.message || '导入失败'}
                    </div>
                  ))}
                </div>
              )}
            </AlertBanner>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiImport;
