import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  Database,
  FileQuestion,
  Loader2,
  PieChart as PieChartIcon,
  RefreshCw,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { getDashboardStats, getOperationLogs, getTypeDistribution } from '../api';
import api from '../api';
import { useQuestionBanks } from '../contexts/QuestionBankContext';
import {
  ActionButton,
  AlertBanner,
  ChartCard,
  EmptyState,
  PageHeader,
  SearchInput,
  SelectInput,
  StatCard,
  SurfaceCard,
  TimelineLog,
} from '../components/ui';

const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  boolean: '判断题',
  fill: '填空题',
  short: '简答题',
};

const TYPE_COLORS = ['#2563EB', '#16A34A', '#F97316', '#8B5CF6', '#38BDF8'];
const TYPE_ORDER = ['single', 'multiple', 'boolean', 'fill', 'short'];

function AccuracyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;

  return (
    <div className="min-w-[168px] rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-popover dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs text-gray-400">{data.fullDate} {data.time}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-extrabold text-primary">{data.accuracy}%</span>
        <span className="pb-1 text-xs font-semibold text-gray-500">第 {data.index} 次练习</span>
      </div>
      {data.totalQuestions > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          答对 <span className="font-semibold text-success">{data.correctCount}</span> / {data.totalQuestions} 题
        </p>
      )}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm shadow-popover dark:border-gray-700 dark:bg-gray-800">
      <p className="font-semibold text-gray-900 dark:text-white">{data.name}</p>
      <p className="mt-1 text-gray-500">数量：{data.value}</p>
    </div>
  );
}

const Dashboard = () => {
  const { banks, fetchBanks: refreshBanks } = useQuestionBanks();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({
    totalQuestions: 0,
    todayQuestions: 0,
    weekQuestions: 0,
    typeDistribution: [],
  });
  const [operationLogs, setOperationLogs] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [isBankManuallySelected, setIsBankManuallySelected] = useState(false);
  const [practiceRecords, setPracticeRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [practiceStats, setPracticeStats] = useState([]);
  const [selectedTypeBankId, setSelectedTypeBankId] = useState(null);
  const [typeDistribution, setTypeDistribution] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');

  const normalizeDateString = (value) => {
    if (!value) return '';
    const s = String(value);
    if (s.includes('T')) return s;
    return s.replace(' ', 'T');
  };

  const safeTime = (value) => {
    const s = normalizeDateString(value);
    if (!s) return 0;
    const t = new Date(s).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  const formatOperationTime = (value) => {
    const s = normalizeDateString(value);
    if (!s) return '';
    const iso = /Z$|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`;
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [stats, logs, allPracticeStats] = await Promise.all([
          getDashboardStats(),
          getOperationLogs(10),
          api.practice.getAllStats().catch((e) => {
            console.error('加载练习统计失败:', e);
            return [];
          }),
        ]);

        setDashboardStats(stats);
        setOperationLogs(logs);
        setPracticeStats(Array.isArray(allPracticeStats) ? allPracticeStats : []);
        await refreshBanks();
      } catch (err) {
        console.error('加载数据失败:', err);
        setError(err.message || '加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const loadPracticeRecords = async () => {
      if (!selectedBankId) {
        setPracticeRecords([]);
        return;
      }

      setLoadingRecords(true);
      try {
        const records = await api.practice.getRecords(selectedBankId, 10);
        setPracticeRecords(records.reverse());
      } catch (error) {
        console.error('加载练习记录失败:', error);
      } finally {
        setLoadingRecords(false);
      }
    };

    loadPracticeRecords();
  }, [selectedBankId]);

  const practiceLastTimeByBankId = useMemo(
    () => new Map(
      (practiceStats || []).map(s => [
        Number(s.bankId),
        s && s.lastPractice ? safeTime(s.lastPractice) : 0,
      ])
    ),
    [practiceStats]
  );

  const trendBanks = useMemo(() => [...(banks || [])].sort((a, b) => {
    const aPractice = practiceLastTimeByBankId.get(Number(a.id)) || 0;
    const bPractice = practiceLastTimeByBankId.get(Number(b.id)) || 0;

    if (aPractice !== bPractice) return bPractice - aPractice;

    const aUpdated = a && a.updatedAt ? safeTime(a.updatedAt) : 0;
    const bUpdated = b && b.updatedAt ? safeTime(b.updatedAt) : 0;
    return bUpdated - aUpdated;
  }), [banks, practiceLastTimeByBankId]);

  const latestPracticedBankId = useMemo(() => {
    let latest = null;
    for (const s of practiceStats || []) {
      const bankId = Number(s.bankId);
      const time = s && s.lastPractice ? safeTime(s.lastPractice) : 0;
      if (!Number.isFinite(bankId) || bankId <= 0) continue;
      if (!time) continue;
      if (!latest || time > latest.time) latest = { bankId, time };
    }
    if (!latest) return null;
    return trendBanks.some(b => Number(b.id) === latest.bankId) ? latest.bankId : null;
  }, [practiceStats, trendBanks]);

  useEffect(() => {
    if (isBankManuallySelected) return;

    if (latestPracticedBankId) {
      if (selectedBankId !== latestPracticedBankId) {
        setSelectedBankId(latestPracticedBankId);
      }
      return;
    }

    if (!selectedBankId && trendBanks.length > 0) {
      setSelectedBankId(trendBanks[0].id);
    }
  }, [isBankManuallySelected, latestPracticedBankId, selectedBankId, trendBanks]);

  useEffect(() => {
    const loadTypeDistribution = async () => {
      try {
        const data = await getTypeDistribution(selectedTypeBankId);
        setTypeDistribution(data);
      } catch (error) {
        console.error('加载题型分布失败:', error);
      }
    };
    loadTypeDistribution();
  }, [selectedTypeBankId]);

  const formatNumber = (num) => Number(num || 0).toLocaleString('zh-CN');

  const totalPracticeCount = useMemo(
    () => (practiceStats || []).reduce((sum, item) => sum + Number(item.practiceCount || 0), 0),
    [practiceStats]
  );

  const stats = [
    {
      title: '总题目数',
      value: formatNumber(dashboardStats.totalQuestions),
      icon: FileQuestion,
      tone: 'blue',
      trend: { label: '今日新增', value: `+${formatNumber(dashboardStats.todayQuestions)}` },
    },
    {
      title: '今日新增',
      value: formatNumber(dashboardStats.todayQuestions),
      icon: CheckCircle2,
      tone: 'green',
      trend: { label: '题库同步', value: '实时' },
    },
    {
      title: '本周新增',
      value: formatNumber(dashboardStats.weekQuestions),
      icon: Activity,
      tone: 'orange',
      trend: { label: '本周累计', value: `+${formatNumber(dashboardStats.weekQuestions)}` },
    },
    {
      title: '练习次数',
      value: formatNumber(totalPracticeCount),
      icon: Zap,
      tone: 'purple',
      trend: { label: '累计完成', value: `${formatNumber(totalPracticeCount)}` },
    },
  ];

  const chartData = TYPE_ORDER.map((type) => {
    const found = typeDistribution.find(item => item.type === type);
    return { name: TYPE_LABELS[type], value: found ? found.count : 0, type };
  }).filter(item => item.value > 0);

  const displayChartData = chartData.length > 0 ? chartData : [{ name: '暂无数据', value: 1, type: 'empty' }];
  const currentTotalQuestions = typeDistribution.reduce((sum, item) => sum + item.count, 0);

  const practiceChartData = practiceRecords.map((record, index) => {
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

  const todayText = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replaceAll('/', '-');

  if (loading) {
    return (
      <SurfaceCard className="flex min-h-[360px] items-center justify-center" padding="p-8">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="ml-3 text-sm font-semibold text-gray-500">正在加载数据看板...</span>
      </SurfaceCard>
    );
  }

  if (error) {
    return (
      <SurfaceCard className="space-y-5" padding="p-8">
        <AlertBanner type="danger" title="数据加载失败">{error}</AlertBanner>
        <ActionButton icon={RefreshCw} onClick={() => window.location.reload()}>
          重新加载
        </ActionButton>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="数据看板"
        subtitle="欢迎回来，查看今日题库概览"
        actions={(
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <SearchInput
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onClear={() => setSearchKeyword('')}
              placeholder="搜索题库或题目"
              className="w-full sm:w-72"
            />
            <button
              type="button"
              className="relative inline-flex size-11 items-center justify-center rounded-control border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-blue-50 hover:text-primary dark:border-gray-700 dark:bg-gray-800"
              aria-label="通知"
              title="通知"
            >
              <Bell size={20} />
              {operationLogs.length > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-bold text-white">
                  {Math.min(operationLogs.length, 9)}
                </span>
              )}
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-control border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-blue-50 hover:text-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <CalendarDays size={18} />
              {todayText}
            </button>
          </div>
        )}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ChartCard
            title="练习正确率趋势"
            icon={TrendingUp}
            action={(
              <SelectInput
                value={selectedBankId || ''}
                onChange={(e) => {
                  setIsBankManuallySelected(true);
                  setSelectedBankId(Number(e.target.value) || null);
                }}
                className="h-10 min-h-10 w-48"
              >
                <option value="">选择题库</option>
                {trendBanks.map(bank => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
              </SelectInput>
            )}
          >
            {loadingRecords ? (
              <div className="flex h-[300px] items-center justify-center">
                <Loader2 className="size-7 animate-spin text-primary" />
              </div>
            ) : practiceChartData.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="暂无练习记录"
                description="完成一次练习后，这里会展示正确率变化趋势。"
                className="min-h-[300px] bg-blue-50/40"
              />
            ) : (
              <div className="h-[300px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={practiceChartData} margin={{ top: 10, right: 18, left: 2, bottom: 0 }}>
                    <defs>
                      <linearGradient id="accuracyArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                      width={44}
                    />
                    <Tooltip cursor={{ stroke: '#BFDBFE', strokeWidth: 1 }} content={<AccuracyTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="accuracy"
                      stroke="#2563EB"
                      strokeWidth={3}
                      fill="url(#accuracyArea)"
                      dot={{ r: 4, fill: '#FFFFFF', stroke: '#2563EB', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="题型分布"
            icon={PieChartIcon}
            action={(
              <SelectInput
                value={selectedTypeBankId || ''}
                onChange={(e) => setSelectedTypeBankId(e.target.value ? Number(e.target.value) : null)}
                className="h-10 min-h-10 w-48"
              >
                <option value="">全部题库</option>
                {banks.map(bank => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
              </SelectInput>
            )}
          >
            <div className="grid items-center gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="relative h-[260px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={displayChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={104}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="#FFFFFF"
                      strokeWidth={3}
                    >
                      {displayChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.type}-${index}`}
                          fill={chartData.length > 0 ? TYPE_COLORS[TYPE_ORDER.indexOf(entry.type) % TYPE_COLORS.length] : '#E2E8F0'}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className="text-sm font-semibold text-gray-400">{selectedTypeBankId ? '题库题数' : '总题数'}</p>
                  <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">
                    {formatNumber(selectedTypeBankId ? currentTotalQuestions : dashboardStats.totalQuestions)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {TYPE_ORDER.map((type, index) => {
                  const found = typeDistribution.find(item => item.type === type);
                  const count = found ? found.count : 0;
                  const total = selectedTypeBankId ? currentTotalQuestions : dashboardStats.totalQuestions;
                  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';

                  return (
                    <div key={type} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/80">
                      <span className="size-3 rounded-full" style={{ backgroundColor: TYPE_COLORS[index] }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{TYPE_LABELS[type]}</p>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-lg font-extrabold text-gray-900 dark:text-white">{count}</span>
                          <span className="text-xs text-gray-400">({percentage}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ChartCard>
        </div>

        <SurfaceCard className="flex min-h-[520px] flex-col" padding="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database size={19} className="text-primary" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">最近操作</h2>
            </div>
            <span className="text-sm font-semibold text-primary">查看全部</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <TimelineLog logs={operationLogs} formatTime={formatOperationTime} />
          </div>
          <div className="mt-4 rounded-2xl border border-gray-100 bg-blue-50/70 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <Clock size={16} />
              已显示最新 {operationLogs.length} 条记录
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};

export default Dashboard;
