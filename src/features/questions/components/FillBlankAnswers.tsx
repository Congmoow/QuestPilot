import { Field, TextInput } from '../../../components/ui';

type FillBlankAnswersProps = {
  blankCount: number;
  fillAnswers: string[];
  onUpdateFillAnswer: (index: number, value: string) => void;
};

const FillBlankAnswers = ({
  blankCount,
  fillAnswers,
  onUpdateFillAnswer,
}: FillBlankAnswersProps) => (
  <Field label="答案设置" required>
    {blankCount === 0 ? (
      <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
        请在题干中插入空栏标记（点击"插入空栏"按钮）
      </div>
    ) : (
      <div className="space-y-3">
        {Array.from({ length: blankCount }).map((_, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-[80px_minmax(0,1fr)] sm:items-center">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              第 {index + 1} 空
            </span>
            <TextInput
              value={fillAnswers[index] || ''}
              onChange={(e) => onUpdateFillAnswer(index, e.target.value)}
              placeholder={`请输入第 ${index + 1} 空的答案`}
            />
          </div>
        ))}
      </div>
    )}
  </Field>
);

export default FillBlankAnswers;
