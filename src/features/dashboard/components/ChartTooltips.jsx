export function AccuracyTooltip({ active, payload }) {
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

export function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm shadow-popover dark:border-gray-700 dark:bg-gray-800">
      <p className="font-semibold text-gray-900 dark:text-white">{data.name}</p>
      <p className="mt-1 text-gray-500">数量：{data.value}</p>
    </div>
  );
}
