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
  CalendarDays,
  Clock,
  Database,
  Loader2,
  PieChart as PieChartIcon,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ActionButton,
  AlertBanner,
  ChartCard,
  EmptyState,
  PageHeader,
  SelectInput,
  StatCard,
  SurfaceCard,
  TimelineLog,
} from '../components/ui';
import { TYPE_LABELS } from '../lib/questionLabels';
import { AccuracyTooltip, PieTooltip } from '../features/dashboard/components/ChartTooltips';
import {
  TYPE_ORDER,
  TYPE_COLORS,
  formatOperationTime,
  formatNumber,
  useDashboard,
} from '../features/dashboard/hooks/useDashboard';

const Dashboard = () => {
  const {
    banks,
    loading,
    error,
    dashboardStats,
    operationLogs,
    selectedBankId,
    setSelectedBankId,
    isBankManuallySelected: _isBankManuallySelected,
    setIsBankManuallySelected,
    loadingRecords,
    trendBanks,
    selectedTypeBankId,
    setSelectedTypeBankId,
    typeDistribution,
    totalPracticeCount,
    practiceChartData,
  } = useDashboard();

  const stats = [
    {
      title: '总题目数',
      value: formatNumber(dashboardStats.totalQuestions),
      iconIndex: 0,
      tone: 'blue',
      trend: { label: '今日新增', value: `+${formatNumber(dashboardStats.todayQuestions)}` },
    },
    {
      title: '今日新增',
      value: formatNumber(dashboardStats.todayQuestions),
      iconIndex: 1,
      tone: 'green',
      trend: { label: '题库同步', value: '实时' },
    },
    {
      title: '本周新增',
      value: formatNumber(dashboardStats.weekQuestions),
      iconIndex: 2,
      tone: 'orange',
      trend: { label: '本周累计', value: `+${formatNumber(dashboardStats.weekQuestions)}` },
    },
    {
      title: '练习次数',
      value: formatNumber(totalPracticeCount),
      iconIndex: 3,
      tone: 'purple',
      trend: { label: '累计完成', value: `${formatNumber(totalPracticeCount)}` },
    },
  ];

  const chartData = TYPE_ORDER.map((type) => {
    const found = typeDistribution.find((item) => item.type === type);
    return {
      name: TYPE_LABELS[type as keyof typeof TYPE_LABELS],
      value: found ? found.count : 0,
      type,
    };
  }).filter((item) => item.value > 0);

  const displayChartData =
    chartData.length > 0 ? chartData : [{ name: '暂无数据', value: 1, type: 'empty' }];
  const currentTotalQuestions = typeDistribution.reduce((sum, item) => sum + item.count, 0);

  const todayText = new Date()
    .toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/\//g, '-');

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
        <AlertBanner type="danger" title="数据加载失败">
          {error}
        </AlertBanner>
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
        actions={
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-control border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-blue-50 hover:text-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <CalendarDays size={18} />
              {todayText}
            </button>
          </div>
        }
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
            action={
              <SelectInput
                value={selectedBankId || ''}
                onChange={(e) => {
                  setIsBankManuallySelected(true);
                  setSelectedBankId(Number(e.target.value) || null);
                }}
                className="h-10 min-h-10 w-48"
              >
                <option value="">选择题库</option>
                {trendBanks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </SelectInput>
            }
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
                  <AreaChart
                    data={practiceChartData}
                    margin={{ top: 10, right: 18, left: 2, bottom: 0 }}
                  >
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
                    <Tooltip
                      cursor={{ stroke: '#BFDBFE', strokeWidth: 1 }}
                      content={<AccuracyTooltip />}
                    />
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
            action={
              <SelectInput
                value={selectedTypeBankId || ''}
                onChange={(e) =>
                  setSelectedTypeBankId(e.target.value ? Number(e.target.value) : null)
                }
                className="h-10 min-h-10 w-48"
              >
                <option value="">全部题库</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </SelectInput>
            }
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
                          fill={
                            chartData.length > 0
                              ? TYPE_COLORS[TYPE_ORDER.indexOf(entry.type) % TYPE_COLORS.length]
                              : '#E2E8F0'
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className="text-sm font-semibold text-gray-400">
                    {selectedTypeBankId ? '题库题数' : '总题数'}
                  </p>
                  <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">
                    {formatNumber(
                      selectedTypeBankId ? currentTotalQuestions : dashboardStats.totalQuestions,
                    )}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {TYPE_ORDER.map((type, index) => {
                  const found = typeDistribution.find((item) => item.type === type);
                  const count = found ? found.count : 0;
                  const total = selectedTypeBankId
                    ? currentTotalQuestions
                    : dashboardStats.totalQuestions;
                  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';

                  return (
                    <div
                      key={type}
                      className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/80"
                    >
                      <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: TYPE_COLORS[index] }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                          {TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
                        </p>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-lg font-extrabold text-gray-900 dark:text-white">
                            {count}
                          </span>
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
            <TimelineLog
              logs={operationLogs as Parameters<typeof TimelineLog>[0]['logs']}
              formatTime={formatOperationTime}
            />
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
