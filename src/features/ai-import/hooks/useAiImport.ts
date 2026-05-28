import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import api from '../../../api';
import type { CreateQuestionInput, ImportResult, ParseError, QuestionType } from '../../../api';
import { countFillBlanks } from '../../../lib/fillBlank';
import { useQuestionBanks } from '../../../contexts/QuestionBankContext';
import type { ParseChunkError } from '../utils/normalize';
import { normalizeBooleanAnswer, normalizeChoiceAnswer } from '../utils/normalize';
import { selectAiDropPath, selectJsonDropPath, selectTomlDropPath } from '../utils/tomlFileDrop';
import { parseTomlQuestions } from '../utils/tomlImport';

type ImportMode = 'ai' | 'json' | 'toml';

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

const JSON_TYPE_MAP: Record<string, QuestionType> = {
  单选题: 'single',
  单选: 'single',
  single: 'single',
  多选题: 'multiple',
  多选: 'multiple',
  multiple: 'multiple',
  判断题: 'boolean',
  判断: 'boolean',
  boolean: 'boolean',
  填空题: 'fill',
  填空: 'fill',
  fill: 'fill',
  简答题: 'short',
  简答: 'short',
  short: 'short',
};

export const useAiImport = (dropZoneRef?: RefObject<HTMLElement>) => {
  const { banks, fetchBanks } = useQuestionBanks();
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [mode, setMode] = useState<ImportMode>('ai');
  const [inputText, setInputText] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [tomlInput, setTomlInput] = useState('');
  const [tomlFile, setTomlFile] = useState<{ name: string; path: string } | null>(null);
  const [draggingTomlFile, setDraggingTomlFile] = useState(false);
  const [draggingOverEditor, setDraggingOverEditor] = useState(false);
  const [draggingFilePaths, setDraggingFilePaths] = useState<string[]>([]);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [fileIconUrl, setFileIconUrl] = useState<string | null>(null);
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

  const parseAiText = useCallback(async (text: string) => {
    if (!text.trim()) {
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
      const result = await api.ai.parseQuestions(text);
      const chunkErrors: ParseChunkError[] = Array.isArray(result.chunkErrors)
        ? (result.chunkErrors as ParseChunkError[])
        : [];
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
            .map(
              (item) => `第 ${Number(item.chunkIndex) + 1} 个片段：${item.message || '解析失败'}`,
            )
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
  }, []);

  const handleParse = () => parseAiText(inputText);

  const loadAiFilePath = useCallback(
    async (filePath: string) => {
      setError(null);
      setInputText('');
      setParsedQuestions([]);
      setImportResult(null);
      try {
        const content = await api.file.readText(filePath);
        setInputText(content);
        void parseAiText(content);
      } catch (error) {
        setError(error instanceof Error ? error.message : '读取文件失败');
      }
    },
    [parseAiText],
  );

  const handleRemoveQuestion = (index: number) => {
    setParsedQuestions((prev) => prev.filter((_, i) => i !== index));
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
          if (mode === 'ai') setInputText('');
          if (mode === 'json') setJsonInput('');
          if (mode === 'toml') {
            setTomlInput('');
            setTomlFile(null);
          }
        } else {
          const failedIndices = errors.map((e: ParseError) => e.index);
          setParsedQuestions((prev) => prev.filter((_, i) => failedIndices.includes(i)));
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
    setTomlInput('');
    setTomlFile(null);
    setParsedQuestions([]);
    setError(null);
    setImportResult(null);
    setParseWarnings(null);
    setShowParseWarnings(false);
  };

  const parseJsonText = useCallback((text: string) => {
    if (!text.trim()) {
      setError('请输入 JSON 格式的题目数据');
      return;
    }
    setError(null);
    setParsedQuestions([]);
    setImportResult(null);
    setParseWarnings(null);
    setShowParseWarnings(false);
    try {
      let data = JSON.parse(text.trim());
      if (!Array.isArray(data)) data = [data];

      const questions: CreateQuestionInput[] = (data as RawJsonQuestion[]).map((item, index) => {
        const type = item.type || item.题型 || 'short';
        const content = String(item.content || item.题目 || item.question || '');
        const answer = item.answer ?? item.答案 ?? '';
        const analysis = String(item.analysis || item.解析 || '');
        const options = item.options || item.选项 || null;
        const normalizedType = JSON_TYPE_MAP[String(type)] || 'short';
        if (!content) throw new Error(`第 ${index + 1} 道题目缺少题目内容`);

        let normalizedOptions = null;
        if (options && (normalizedType === 'single' || normalizedType === 'multiple')) {
          if (Array.isArray(options)) {
            normalizedOptions = options.map((opt, i) => {
              if (typeof opt === 'string') {
                const match = opt.match(/^([A-Z])[.、．]\s*(.+)$/);
                return match
                  ? { id: match[1], text: match[2] }
                  : { id: String.fromCharCode(65 + i), text: opt };
              }
              return opt as { id: string; text: string };
            });
          }
        }

        let normalizedAnswer = String(answer ?? '');
        if (normalizedType === 'multiple') normalizedAnswer = normalizeChoiceAnswer(answer, true);
        if (normalizedType === 'single') normalizedAnswer = normalizeChoiceAnswer(answer, false);
        if (normalizedType === 'fill') {
          const blankCount = countFillBlanks(content);
          if (blankCount === 0) throw new Error(`第 ${index + 1} 道填空题题干必须包含空栏标记`);
          if (Array.isArray(answer)) {
            normalizedAnswer = answer.join('|');
          } else if (typeof answer === 'string' && blankCount > 1 && !answer.includes('|')) {
            normalizedAnswer = answer.replace(/[,，、;；]+/g, '|');
          }
          const answerCount = normalizedAnswer.split('|').length;
          if (answerCount !== blankCount) {
            throw new Error(
              `第 ${index + 1} 道填空题答案数量(${answerCount})与空栏数量(${blankCount})不匹配`,
            );
          }
        }
        if (normalizedType === 'boolean') normalizedAnswer = normalizeBooleanAnswer(answer);

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
      setError(
        err instanceof SyntaxError
          ? 'JSON 格式错误，请检查语法'
          : err instanceof Error
            ? err.message
            : '解析失败',
      );
    }
  }, []);

  const handleJsonParse = () => parseJsonText(jsonInput);

  const handleTomlParse = () => {
    setError(null);
    setParsedQuestions([]);
    setImportResult(null);
    setParseWarnings(null);
    setShowParseWarnings(false);
    try {
      setParsedQuestions(parseTomlQuestions(tomlInput));
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败');
    }
  };

  const parseTomlFilePath = useCallback(async (filePath: string) => {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    setTomlFile({ name: fileName, path: filePath });
    setParsing(true);
    setError(null);
    setParsedQuestions([]);
    setImportResult(null);
    setParseWarnings(null);
    setShowParseWarnings(false);
    try {
      const [result, rawText] = await Promise.all([
        api.toml.parseFile(filePath),
        api.file.readText(filePath).catch(() => ''),
      ]);
      if (rawText) setTomlInput(rawText);
      const errors = Array.isArray(result.errors) ? result.errors : [];
      if (result.valid.length > 0) {
        setParsedQuestions(result.valid);
        if (errors.length > 0) {
          setParseWarnings({
            questionCount: result.valid.length,
            chunkErrors: errors.map((item, index) => ({
              chunkIndex: Math.max(Number(item.row ?? index + 1) - 1, 0),
              message: item.field ? `${item.field}：${item.message}` : item.message,
            })),
          });
        }
      } else if (errors.length > 0) {
        setError(
          errors
            .map(
              (item, index) =>
                `第 ${item.row ?? index + 1} 道${item.field ? `，${item.field}` : ''}：${item.message}`,
            )
            .join('\n'),
        );
      } else {
        setError('未能解析出有效的题目');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '解析 TOML 文件失败');
    } finally {
      setParsing(false);
    }
  }, []);

  const handleSelectTomlFile = async () => {
    setError(null);
    try {
      const result = await api.toml.selectFile();
      if (result.success && result.filePath) {
        await parseTomlFilePath(result.filePath);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '选择 TOML 文件失败');
    }
  };

  const loadJsonFilePath = useCallback(
    async (filePath: string) => {
      setError(null);
      setJsonInput('');
      setParsedQuestions([]);
      setImportResult(null);
      try {
        const content = await api.file.readText(filePath);
        setJsonInput(content);
        parseJsonText(content);
      } catch (error) {
        setError(error instanceof Error ? error.message : '读取 JSON 文件失败');
      }
    },
    [setJsonInput, parseJsonText],
  );

  const handleTomlFileParse = async () => {
    if (!tomlFile) {
      setError('请先选择 TOML 文件');
      return;
    }
    await parseTomlFilePath(tomlFile.path);
  };

  useEffect(() => {
    const html = document.documentElement;
    if (draggingTomlFile) {
      html.classList.add('file-dragging');
    } else {
      html.classList.remove('file-dragging');
    }
    return () => {
      html.classList.remove('file-dragging');
    };
  }, [draggingTomlFile]);

  useEffect(() => {
    if (draggingFilePaths.length === 0) {
      setFileIconUrl(null);
      return;
    }
    void api.icon
      .getFileIcon(draggingFilePaths[0])
      .then((b64) => setFileIconUrl(`data:image/png;base64,${b64}`))
      .catch(() => setFileIconUrl(null));
  }, [draggingFilePaths]);

  useEffect(() => {
    if (mode !== 'toml' && mode !== 'json' && mode !== 'ai') {
      setDraggingTomlFile(false);
      return;
    }

    let cancelled = false;
    let unlisten: (() => void) | null = null;

    void import('@tauri-apps/api/webview')
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent((event) => {
          const payload = event.payload;
          const dpr = window.devicePixelRatio || 1;
          const checkOver = (rawX: number, rawY: number) => {
            if (!dropZoneRef?.current) return true;
            const r = dropZoneRef.current.getBoundingClientRect();
            const x = rawX / dpr;
            const y = rawY / dpr;
            return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
          };
          if (payload.type === 'enter') {
            setDraggingFilePaths(payload.paths ?? []);
            setDraggingTomlFile(true);
            setDragPosition({ x: payload.position.x / dpr, y: payload.position.y / dpr });
            setDraggingOverEditor(checkOver(payload.position.x, payload.position.y));
            return;
          }
          if (payload.type === 'over') {
            setDraggingTomlFile(true);
            setDragPosition({ x: payload.position.x / dpr, y: payload.position.y / dpr });
            setDraggingOverEditor(checkOver(payload.position.x, payload.position.y));
            return;
          }
          if (payload.type === 'leave') {
            setDraggingTomlFile(false);
            setDraggingFilePaths([]);
            setDragPosition(null);
            setDraggingOverEditor(false);
            return;
          }
          const filePath =
            mode === 'json'
              ? selectJsonDropPath(payload.paths)
              : mode === 'ai'
                ? selectAiDropPath(payload.paths)
                : selectTomlDropPath(payload.paths);
          setDraggingTomlFile(false);
          setDraggingFilePaths([]);
          setDragPosition(null);
          setDraggingOverEditor(false);
          if (!filePath) {
            setError(
              mode === 'json'
                ? '请拖入 .json 文件'
                : mode === 'ai'
                  ? '请拖入 .md 或 .txt 文件'
                  : '请拖入 .toml 文件',
            );
            return;
          }
          if (!checkOver(payload.position.x, payload.position.y)) {
            return;
          }
          if (mode === 'json') {
            void loadJsonFilePath(filePath);
          } else if (mode === 'ai') {
            void loadAiFilePath(filePath);
          } else {
            void parseTomlFilePath(filePath);
          }
        }),
      )
      .then((cleanup) => {
        if (cancelled) cleanup();
        else unlisten = cleanup;
      })
      .catch((error) => {
        setDraggingTomlFile(false);
        setError(error instanceof Error ? error.message : '监听 TOML 拖拽失败');
      });

    return () => {
      cancelled = true;
      setDraggingTomlFile(false);
      setDraggingFilePaths([]);
      setDragPosition(null);
      setDraggingOverEditor(false);
      setFileIconUrl(null);
      if (unlisten) unlisten();
    };
  }, [mode, dropZoneRef, parseTomlFilePath, loadJsonFilePath, loadAiFilePath]);

  const handleModeChange = (newMode: ImportMode) => {
    setMode(newMode);
    setError(null);
    setImportResult(null);
    setParsedQuestions([]);
    setParseWarnings(null);
    setShowParseWarnings(false);
  };

  return {
    banks,
    selectedBankId,
    setSelectedBankId,
    mode,
    inputText,
    setInputText,
    jsonInput,
    setJsonInput,
    tomlInput,
    setTomlInput,
    tomlFile,
    draggingTomlFile,
    draggingOverEditor,
    draggingFilePaths,
    dragPosition,
    fileIconUrl,
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
    handleTomlParse,
    handleSelectTomlFile,
    handleTomlFileParse,
    handleModeChange,
  };
};
