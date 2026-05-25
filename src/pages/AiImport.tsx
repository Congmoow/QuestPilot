import { useEffect, useState } from 'react';
import {
  CheckCircle,
  Code,
  Loader2,
  Save,
  Trash2,
  Wand2,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQuestionBanks } from '../contexts/QuestionBankContext';
import api from '../api';
import type { CreateQuestionInput, ImportResult, ParseError, QuestionType } from '../api';
import { countFillBlanks } from '../lib/fillBlank';
import type { TypeLabelMap } from '../types/viewModels';
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

type ImportMode = 'ai' | 'json';

type ParseChunkError = {
  chunkIndex?: number;
  message?: string;
};

type ParseWarnings = {
  questionCount: number;
  chunkErrors: ParseChunkError[];
  chunks?: unknown;
};

type RawJsonQuestion = {
  type?: unknown;
  content?: unknown;
  question?: unknown;
  answer?: unknown;
  analysis?: unknown;
  options?: unknown;
  题型?: unknown;
  题目?: unknown;
  答案?: unknown;
  解析?: unknown;
  选项?: unknown;
};

const MODE_TABS: Array<{ id: ImportMode; label: string; icon: LucideIcon }> = [
  { id: 'ai', label: 'AI 智能解析', icon: Wand2 },
  { id: 'json', label: 'JSON 批量导入', icon: Code },
];

const TYPE_LABELS: TypeLabelMap = {
  single: '单选题',
  multiple: '多选题',
  boolean: '判断题',
  fill: '填空题',
  short: '简答题',
};

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

const normalizeBooleanAnswer = (answer: unknown): string => {
  if (answer === true) return '正确';
  if (answer === false) return '错误';

  const raw = String(answer ?? '').trim();
  const lower = raw.toLowerCase();
  const trueValues = ['正确', '对', '是', '√', 'true', 't', 'yes', 'y', '1'];
  const falseValues = ['错误', '错', '否', '×', 'false', 'f', 'no', 'n', '0'];

  if (trueValues.includes(raw) || trueValues.includes(lower)) return '正确';
  if (falseValues.includes(raw) || falseValues.includes(lower)) return '错误';
  return raw;
};

const normalizeChoiceAnswer = (answer: unknown, multiple = false): string => {
  if (Array.isArray(answer)) {
    return answer.map(a => normalizeChoiceAnswer(a, false)).filter(Boolean).join('|');
  }

  const raw = String(answer ?? '').trim().toUpperCase();
  if (!raw) return raw;

  const parts = raw
    .replace(/[，,、;；\s]+/g, '|')
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);

  const letters = [];
  for (const part of parts) {
    if (/^[A-Z]+$/.test(part)) {
      letters.push(...part.split(''));
      continue;
    }

    const match = part.match(/^([A-Z])(?:\s*[.、．:：)]|\s|$)/) || part.match(/[A-Z]/);
    if (match) letters.push(match[1] || match[0]);
  }

  const uniqueLetters = [...new Set(letters)];
  if (multiple) return uniqueLetters.join('|');
  return uniqueLetters[0] || raw;
};

const getChunkIndex = (item: ParseChunkError, fallbackIndex: number) => {
  const parsed = Number(item?.chunkIndex);
  return Number.isFinite(parsed) ? parsed : fallbackIndex;
};

const AiImport = () => {
  const { banks, fetchBanks } = useQuestionBanks();
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);

  const [mode, setMode] = useState<ImportMode>('ai');
  const [inputText, setInputText] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<CreateQuestionInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<ParseWarnings | null>(null);
  const [showParseWarnings, setShowParseWarnings] = useState(false);

  useEffect(() => {
    const checkApiConfig = async () => {
      try {
        const config = await api.settings.getApiConfig();
        setHasApiKey(Boolean(config.hasApiKey || config.apiKey));
      } catch (error) {
        console.error('检查 API 配置失败:', error);
      }
    };
    checkApiConfig();
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const handleParse = async () => {
    if (!inputText.trim()) {
      setError('请输入要解析的题目内容');
      return;
    }

    setParsing(true);
    setError(null);
    setParsedQuestions([]);
    setImportResult(null);
    setParseWarnings(null);
    setShowParseWarnings(false);

    try {
      const result = await api.ai.parseQuestions(inputText);
      const chunkErrors: ParseChunkError[] = Array.isArray(result.chunkErrors) ? result.chunkErrors as ParseChunkError[] : [];
      if (result.questions && result.questions.length > 0) {
        setParsedQuestions(result.questions);
        if (chunkErrors.length > 0) {
          setParseWarnings({
            questionCount: result.questions.length,
            chunkErrors,
            chunks: result.chunks,
          });
        }
      } else {
        if (chunkErrors.length > 0) {
          const messages = chunkErrors
            .map(item => `第 ${Number(item.chunkIndex) + 1} 个片段：${item.message || '解析失败'}`)
            .join('\n');
          setError(`未能识别出有效的题目。\n${messages}`);
        } else {
          setError('未能识别出有效的题目，请检查输入内容格式');
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'AI 解析失败，请稍后重试');
    } finally {
      setParsing(false);
    }
  };

  const handleRemoveQuestion = (index: number) => {
    setParsedQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (!selectedBankId) {
      setError('请先选择目标题库');
      return;
    }

    if (parsedQuestions.length === 0) {
      setError('没有可导入的题目');
      return;
    }

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const result = await api.question.createBatch(selectedBankId, parsedQuestions);
      const successCount = result.success || 0;
      const failCount = result.failed || 0;
      const errors = Array.isArray(result.errors) ? result.errors : [];

      setImportResult(result);

      if (successCount > 0) {
        if (failCount === 0) {
          setParsedQuestions([]);
          setInputText('');
        } else {
          const failedIndices = errors.map((e: ParseError) => e.index);
          setParsedQuestions(prev => prev.filter((_, i) => failedIndices.includes(i)));
        }
        fetchBanks();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleClear = () => {
    setInputText('');
    setJsonInput('');
    setParsedQuestions([]);
    setError(null);
    setImportResult(null);
    setParseWarnings(null);
    setShowParseWarnings(false);
  };

  const handleJsonParse = () => {
    if (!jsonInput.trim()) {
      setError('请输入 JSON 格式的题目数据');
      return;
    }

    setError(null);
    setParsedQuestions([]);
    setImportResult(null);
    setParseWarnings(null);
    setShowParseWarnings(false);

    try {
      let data = JSON.parse(jsonInput.trim());

      if (!Array.isArray(data)) {
        data = [data];
      }

      const questions: CreateQuestionInput[] = (data as RawJsonQuestion[]).map((item, index) => {
        const type = item.type || item.题型 || 'short';
        const content = String(item.content || item.题目 || item.question || '');
        const answer = item.answer ?? item.答案 ?? '';
        const analysis = String(item.analysis || item.解析 || '');
        const options = item.options || item.选项 || null;

        const typeMap: Record<string, QuestionType> = {
          '单选题': 'single', '单选': 'single', 'single': 'single',
          '多选题': 'multiple', '多选': 'multiple', 'multiple': 'multiple',
          '判断题': 'boolean', '判断': 'boolean', 'boolean': 'boolean',
          '填空题': 'fill', '填空': 'fill', 'fill': 'fill',
          '简答题': 'short', '简答': 'short', 'short': 'short',
        };

        const normalizedType = typeMap[String(type)] || 'short';

        if (!content) {
          throw new Error(`第 ${index + 1} 道题目缺少题目内容`);
        }

        let normalizedOptions = null;
        if (options && (normalizedType === 'single' || normalizedType === 'multiple')) {
          if (Array.isArray(options)) {
            normalizedOptions = options.map((opt, i) => {
              if (typeof opt === 'string') {
                const match = opt.match(/^([A-Z])[.、．]\s*(.+)$/);
                if (match) {
                  return { id: match[1], text: match[2] };
                }
                return { id: String.fromCharCode(65 + i), text: opt };
              }
              return opt as { id: string; text: string };
            });
          }
        }

        let normalizedAnswer = String(answer ?? '');

        if (normalizedType === 'multiple') {
          normalizedAnswer = normalizeChoiceAnswer(answer, true);
        }

        if (normalizedType === 'single') {
          normalizedAnswer = normalizeChoiceAnswer(answer, false);
        }

        if (normalizedType === 'fill') {
          const blankCount = countFillBlanks(content);
          if (blankCount === 0) {
            throw new Error(`第 ${index + 1} 道填空题题干必须包含空栏标记（_、___、＿＿、（ ）或( )）`);
          }

          if (Array.isArray(answer)) {
            normalizedAnswer = answer.join('|');
          } else if (typeof answer === 'string') {
            if (blankCount > 1 && !answer.includes('|')) {
              normalizedAnswer = answer.replace(/[,，、;；]+/g, '|');
            }
          }

          const answerCount = normalizedAnswer.split('|').length;
          if (answerCount !== blankCount) {
            throw new Error(`第 ${index + 1} 道填空题答案数量(${answerCount})与空栏数量(${blankCount})不匹配`);
          }
        }

        if (normalizedType === 'boolean') {
          normalizedAnswer = normalizeBooleanAnswer(answer);
        }

        return {
          type: normalizedType,
          content,
          answer: normalizedAnswer,
          analysis,
          ...(normalizedOptions && { options: normalizedOptions }),
        };
      });

      if (questions.length === 0) {
        setError('未能解析出有效的题目');
        return;
      }

      setParsedQuestions(questions);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('JSON 格式错误，请检查语法');
      } else {
        setError(err instanceof Error ? err.message : '解析失败');
      }
    }
  };

  const handleModeChange = (newMode: ImportMode) => {
    setMode(newMode);
    setError(null);
    setImportResult(null);
    setParsedQuestions([]);
    setParseWarnings(null);
    setShowParseWarnings(false);
  };



  const currentInput = mode === 'ai' ? inputText : jsonInput;
  const currentPlaceholder = mode === 'ai' ? AI_PLACEHOLDER : JSON_PLACEHOLDER;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 智能录入"
        subtitle="粘贴 JSON 格式的题目数据，直接批量导入"
      />

      <SegmentedTabs
        tabs={MODE_TABS.map(tab => ({
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
            onChange={(e) => (mode === 'ai' ? setInputText(e.target.value) : setJsonInput(e.target.value))}
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
            <ActionButton variant="secondary" icon={Trash2} onClick={handleClear} disabled={parsing}>
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
                  {banks.map(bank => (
                    <option key={bank.id} value={bank.id}>{bank.name}</option>
                  ))}
                </SelectInput>
              )}
            </div>

            {parseWarnings && (
              <AlertBanner type="warning" className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowParseWarnings(prev => !prev)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span>
                    已解析 {parseWarnings.questionCount} 道题目，有 {parseWarnings.chunkErrors.length} 个片段未能识别
                  </span>
                  <span className="text-xs">{showParseWarnings ? '收起' : '展开'}</span>
                </button>
                {showParseWarnings && (
                  <div className="mt-3 space-y-2">
                    {parseWarnings.chunkErrors.map((item, index) => {
                      const chunkIndex = getChunkIndex(item, index);
                      return (
                        <div key={`${chunkIndex}-${index}`} className="rounded-xl bg-white/70 px-3 py-2 text-sm dark:bg-gray-900/30">
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
                    <div key={`${item.index ?? index}-${index}`} className="rounded-xl bg-white/60 px-3 py-2 text-sm dark:bg-gray-900/30">
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
