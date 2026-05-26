import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, getOperationLogs, getTypeDistribution } from '../../../api';
import api from '../../../api';
import { useQuestionBanks } from '../../../contexts/QuestionBankContext';
import { queryKeys } from '../../../api/queryKeys';

export const TYPE_ORDER = ['single', 'multiple', 'boolean', 'fill', 'short'];
export const TYPE_COLORS = ['#2563EB', '#16A34A', '#F97316', '#8B5CF6', '#38BDF8'];

const normalizeDateString = (value: unknown): string => {
  if (!value) return '';
  const s = String(value);
  return s.includes('T') ? s : s.replace(' ', 'T');
};

const safeTime = (value: unknown): number => {
  const s = normalizeDateString(value);
  if (!s) return 0;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
};

export const formatOperationTime = (value: unknown): string => {
  const s = normalizeDateString(value);
  if (!s) return '';
  const iso = /Z$|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatNumber = (num: unknown): string => Number(num || 0).toLocaleString('zh-CN');

export const useDashboard = () => {
  const { banks } = useQuestionBanks();
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [isBankManuallySelected, setIsBankManuallySelected] = useState(false);
  const [selectedTypeBankId, setSelectedTypeBankId] = useState<number | null>(null);

  const {
    data: dashboardStats,
    isLoading: loadingStats,
    error: statsError,
  } = useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: getDashboardStats,
  });

  const { data: operationLogs = [] } = useQuery({
    queryKey: queryKeys.dashboard.operationLogs(10),
    queryFn: () => getOperationLogs(10),
  });

  const { data: practiceStatsRaw = [] } = useQuery({
    queryKey: queryKeys.dashboard.practiceStats(),
    queryFn: () =>
      api.practice.getAllStats().catch((e: unknown) => {
        console.error('加载练习统计失败:', e);
        return [];
      }),
  });

  const { data: practiceRecordsRaw = [], isFetching: loadingRecords } = useQuery({
    queryKey: queryKeys.dashboard.practiceRecords(selectedBankId),
    queryFn: async () => {
      if (!selectedBankId) return [];
      const records = await api.practice.getRecords(selectedBankId, 10);
      return (records as unknown[]).slice().reverse();
    },
    enabled: selectedBankId !== null,
  });

  const { data: typeDistributionRaw = [] } = useQuery({
    queryKey: queryKeys.dashboard.typeDistribution(selectedTypeBankId),
    queryFn: () => getTypeDistribution(selectedTypeBankId),
  });

  const loading = loadingStats;
  const error = statsError instanceof Error ? statsError.message : null;
  const practiceStats = practiceStatsRaw;
  const practiceRecords = practiceRecordsRaw;
  const typeDistribution = typeDistributionRaw as Array<{ type: string; count: number }>;
  const stats = dashboardStats ?? {
    totalQuestions: 0,
    todayQuestions: 0,
    weekQuestions: 0,
    typeDistribution: [],
  };

  const practiceLastTimeByBankId = useMemo(
    () =>
      new Map(
        (practiceStats as Array<{ bankId: unknown; lastPractice?: unknown }>).map((s) => [
          Number(s.bankId),
          s && s.lastPractice ? safeTime(s.lastPractice) : 0,
        ]),
      ),
    [practiceStats],
  );

  const trendBanks = useMemo(
    () =>
      [...(banks || [])].sort((a, b) => {
        const aPractice = practiceLastTimeByBankId.get(Number(a.id)) || 0;
        const bPractice = practiceLastTimeByBankId.get(Number(b.id)) || 0;
        if (aPractice !== bPractice) return bPractice - aPractice;
        const aUpdated = (a as { updatedAt?: unknown }).updatedAt
          ? safeTime((a as { updatedAt?: unknown }).updatedAt)
          : 0;
        const bUpdated = (b as { updatedAt?: unknown }).updatedAt
          ? safeTime((b as { updatedAt?: unknown }).updatedAt)
          : 0;
        return bUpdated - aUpdated;
      }),
    [banks, practiceLastTimeByBankId],
  );

  const latestPracticedBankId = useMemo(() => {
    let latest: { bankId: number; time: number } | null = null;
    for (const s of practiceStats as Array<{ bankId: unknown; lastPractice?: unknown }>) {
      const bankId = Number(s.bankId);
      const time = s && s.lastPractice ? safeTime(s.lastPractice) : 0;
      if (!Number.isFinite(bankId) || bankId <= 0) continue;
      if (!time) continue;
      if (!latest || time > latest.time) latest = { bankId, time };
    }
    if (!latest) return null;
    return trendBanks.some((b) => Number(b.id) === latest!.bankId) ? latest.bankId : null;
  }, [practiceStats, trendBanks]);

  useEffect(() => {
    if (isBankManuallySelected) return;
    if (latestPracticedBankId) {
      if (selectedBankId !== latestPracticedBankId) setSelectedBankId(latestPracticedBankId);
      return;
    }
    if (!selectedBankId && trendBanks.length > 0) setSelectedBankId(trendBanks[0].id);
  }, [isBankManuallySelected, latestPracticedBankId, selectedBankId, trendBanks]);

  const totalPracticeCount = useMemo(
    () =>
      (practiceStats as Array<{ practiceCount?: unknown }>).reduce(
        (sum, item) => sum + Number(item.practiceCount || 0),
        0,
      ),
    [practiceStats],
  );

  const practiceChartData = (
    practiceRecords as Array<{
      accuracy: number;
      total?: number;
      correct?: number;
      createdAt?: unknown;
    }>
  ).map((record, index) => {
    const createdAt = new Date(normalizeDateString(record.createdAt));
    return {
      name: `第${index + 1}次`,
      accuracy: record.accuracy,
      date: Number.isFinite(createdAt.getTime())
        ? createdAt.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
        : `第${index + 1}次`,
      fullDate: Number.isFinite(createdAt.getTime())
        ? createdAt.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
        : '',
      time: Number.isFinite(createdAt.getTime())
        ? createdAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : '',
      totalQuestions: record.total || 0,
      correctCount: record.correct || 0,
      index: index + 1,
    };
  });

  return {
    banks,
    loading,
    error,
    dashboardStats: stats,
    operationLogs,
    selectedBankId,
    setSelectedBankId,
    isBankManuallySelected,
    setIsBankManuallySelected,
    loadingRecords,
    trendBanks,
    selectedTypeBankId,
    setSelectedTypeBankId,
    typeDistribution: typeDistribution as Array<{ type: string; count: number }>,
    totalPracticeCount,
    practiceChartData,
  };
};
