import { BookOpen } from 'lucide-react';
import { ActionButton, AlertBanner, Field, SurfaceCard, TextInput } from '../../../components/ui';
import { useWrongBookThreshold } from '../hooks/useWrongBookThreshold';

const ThresholdSection = () => {
  const {
    wrongBookThreshold,
    setWrongBookThreshold,
    savingWrongBook,
    savedWrongBook,
    handleSaveWrongBookThreshold,
  } = useWrongBookThreshold();

  return (
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
  );
};

export default ThresholdSection;
