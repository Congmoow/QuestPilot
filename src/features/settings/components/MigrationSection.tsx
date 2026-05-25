import { DatabaseBackup, RefreshCw } from 'lucide-react';
import { ActionButton, AlertBanner, SurfaceCard } from '../../../components/ui';
import { useMigration } from '../hooks/useMigration';

const MigrationSection = () => {
  const {
    migrationStatus,
    loadingMigrationStatus,
    replacingLegacyPath,
    migrationResult,
    migrationError,
    legacyCandidatesWithData,
    needsExplicitReset,
    loadMigrationStatus,
    handleBackupAndReplace,
  } = useMigration();

  return (
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
  );
};

export default MigrationSection;
