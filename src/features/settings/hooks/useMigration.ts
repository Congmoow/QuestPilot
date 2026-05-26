import { useEffect, useState } from 'react';
import api from '../../../api';
import type {
  LegacyDatabaseCandidate,
  LegacyDatabaseReplaceResult,
  LegacyDatabaseStatus,
} from '../../../api';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const useMigration = () => {
  const [migrationStatus, setMigrationStatus] = useState<LegacyDatabaseStatus | null>(null);
  const [loadingMigrationStatus, setLoadingMigrationStatus] = useState(false);
  const [replacingLegacyPath, setReplacingLegacyPath] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<LegacyDatabaseReplaceResult | null>(null);
  const [migrationError, setMigrationError] = useState('');

  useEffect(() => {
    loadMigrationStatus();
  }, []);

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

  const handleBackupAndReplace = async (legacyPath: string) => {
    const confirmed = window.confirm(
      '此操作会先备份当前 Tauri 数据库，然后使用选中的旧数据库替换当前数据库。替换后建议重启应用继续使用。是否继续？',
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

  const legacyCandidatesWithData: LegacyDatabaseCandidate[] = (
    migrationStatus?.candidates || []
  ).filter((c: LegacyDatabaseCandidate) => c.hasUserData);
  const needsExplicitReset = migrationStatus?.recommendedAction === 'requires_explicit_reset';

  return {
    migrationStatus,
    loadingMigrationStatus,
    replacingLegacyPath,
    migrationResult,
    migrationError,
    legacyCandidatesWithData,
    needsExplicitReset,
    loadMigrationStatus,
    handleBackupAndReplace,
  };
};
