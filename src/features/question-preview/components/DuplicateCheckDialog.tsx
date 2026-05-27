import { useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, Loader2, ScanSearch, Trash2 } from 'lucide-react';
import { chatWithAI, findDuplicates, getQuestionsByBankId } from '../../../api';
import type { DedupResult, DuplicateGroup } from '../../../api';
import Dialog from '../../../components/Dialog';
import { ActionButton } from '../../../components/ui';

type DialogMode = 'idle' | 'exact-checking' | 'ai-checking' | 'results' | 'no-duplicates' | 'error';

type DuplicateCheckDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirmDedup: (idsToDelete: number[]) => Promise<void>;
  bankId: number;
  submitting: boolean;
};

const MAX_CONTENT_PREVIEW = 60;

function truncate(text: string, max: number) {
  return text.length <= max ? text : text.slice(0, max) + '…';
}

export function DuplicateCheckDialog({
  open,
  onClose,
  onConfirmDedup,
  bankId,
  submitting,
}: DuplicateCheckDialogProps) {
  const [mode, setMode] = useState<DialogMode>('idle');
  const [result, setResult] = useState<DedupResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [checkType, setCheckType] = useState<'exact' | 'ai'>('exact');

  const reset = () => {
    setMode('idle');
    setResult(null);
    setErrorMsg('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleExactCheck = async () => {
    setCheckType('exact');
    setMode('exact-checking');
    try {
      const res = await findDuplicates(bankId);
      setResult(res);
      setMode(res.groups.length > 0 ? 'results' : 'no-duplicates');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '查重失败，请重试');
      setMode('error');
    }
  };

  const handleAiCheck = async () => {
    setCheckType('ai');
    setMode('ai-checking');
    try {
      const page = await getQuestionsByBankId(bankId, { page: 1, pageSize: 1000 });
      const questions = page.data;
      if (questions.length === 0) {
        setResult({ groups: [], totalDuplicateCount: 0 });
        setMode('no-duplicates');
        return;
      }

      const listText = questions
        .map((q) => `${q.id}|${q.content.slice(0, 100)}|${q.answer}`)
        .join('\n');

      const prompt = `你是一个题目查重助手。以下是题库中的题目列表（格式：ID|题干|答案），请找出其中语义相同或高度相似的题目。

${listText}

请以JSON格式返回重复组，只返回JSON，不要有任何其他内容：
{"groups":[{"ids":[1,2],"reason":"题干语义相同"}]}

如果没有发现重复，返回：{"groups":[]}`;

      const aiRes = await chatWithAI([{ role: 'user', content: prompt }]);
      const content = aiRes.content ?? '';

      let parsed: { groups: Array<{ ids: number[]; reason?: string }> } = { groups: [] };
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = { groups: [] };
        }
      }

      if (!parsed.groups || parsed.groups.length === 0) {
        setResult({ groups: [], totalDuplicateCount: 0 });
        setMode('no-duplicates');
        return;
      }

      const questionMap = new Map(questions.map((q) => [q.id, q.content]));
      const dupGroups: DuplicateGroup[] = parsed.groups
        .filter((g) => g.ids && g.ids.length > 1)
        .map((g) => {
          const [keepId, ...duplicateIds] = g.ids;
          return {
            keepId,
            duplicateIds,
            sampleContent: questionMap.get(keepId) ?? '',
            count: g.ids.length,
          };
        });

      const totalDuplicateCount = dupGroups.reduce((s, g) => s + g.duplicateIds.length, 0);
      setResult({ groups: dupGroups, totalDuplicateCount });
      setMode(dupGroups.length > 0 ? 'results' : 'no-duplicates');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'AI 查重失败，请确认已配置 API Key');
      setMode('error');
    }
  };

  const handleConfirm = async () => {
    if (!result) return;
    const idsToDelete = result.groups.flatMap((g) => g.duplicateIds);
    await onConfirmDedup(idsToDelete);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} title="批量查重去重" size="lg">
      <div className="space-y-6">
        {mode === 'idle' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              选择查重方式，系统将自动识别重复题目并保留最早创建的一条。
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleExactCheck}
                className="flex flex-col items-start gap-2 rounded-2xl border-2 border-gray-200 p-5 text-left transition-all hover:border-primary hover:bg-primary/5 dark:border-gray-700 dark:hover:border-primary"
              >
                <ScanSearch className="size-7 text-primary" />
                <span className="font-bold text-gray-900 dark:text-gray-100">精确查重</span>
                <span className="text-xs text-gray-500">
                  匹配题干 + 答案 + 选项完全一致的题目，速度快、无需联网。
                </span>
              </button>

              <button
                type="button"
                onClick={handleAiCheck}
                className="flex flex-col items-start gap-2 rounded-2xl border-2 border-gray-200 p-5 text-left transition-all hover:border-violet-500 hover:bg-violet-50 dark:border-gray-700 dark:hover:border-violet-500 dark:hover:bg-violet-900/20"
              >
                <Bot className="size-7 text-violet-500" />
                <span className="font-bold text-gray-900 dark:text-gray-100">AI 模糊查重</span>
                <span className="text-xs text-gray-500">
                  借助 AI 识别语义相似的题目，需要已配置 API Key。
                </span>
              </button>
            </div>
          </div>
        )}

        {(mode === 'exact-checking' || mode === 'ai-checking') && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="font-semibold text-gray-600 dark:text-gray-300">
              {mode === 'ai-checking' ? 'AI 正在分析题目相似度…' : '正在扫描重复题目…'}
            </p>
          </div>
        )}

        {mode === 'no-duplicates' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <CheckCircle2 className="size-12 text-green-500" />
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100">未发现重复题目</p>
            <p className="text-sm text-gray-500">
              {checkType === 'ai' ? 'AI' : '精确扫描'}完成，当前题库中没有重复内容。
            </p>
            <ActionButton variant="secondary" onClick={handleClose}>
              关闭
            </ActionButton>
          </div>
        )}

        {mode === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-300">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <p className="text-sm">{errorMsg}</p>
            </div>
            <div className="flex justify-end gap-3">
              <ActionButton variant="secondary" onClick={reset}>
                重试
              </ActionButton>
              <ActionButton variant="secondary" onClick={handleClose}>
                关闭
              </ActionButton>
            </div>
          </div>
        )}

        {mode === 'results' && result && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-orange-50 px-4 py-3 dark:bg-orange-900/20">
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                发现 {result.groups.length} 组重复，共{' '}
                <span className="text-base font-bold">{result.totalDuplicateCount}</span>{' '}
                道多余题目将被删除，每组保留最早创建的一条。
              </p>
            </div>

            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {result.groups.map((group, i) => (
                <li
                  key={group.keepId}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <span className="shrink-0 rounded-lg bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
                    组 {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">
                    {truncate(group.sampleContent, MAX_CONTENT_PREVIEW)}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">×{group.count} 条</span>
                </li>
              ))}
            </ul>

            <div className="flex justify-end gap-3 pt-1">
              <ActionButton variant="secondary" onClick={handleClose} disabled={submitting}>
                取消
              </ActionButton>
              <ActionButton
                variant="danger"
                icon={Trash2}
                onClick={handleConfirm}
                loading={submitting}
                disabled={submitting}
              >
                确认去重（删除 {result.totalDuplicateCount} 题）
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default DuplicateCheckDialog;
