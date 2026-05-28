import React from 'react';
import { Upload, FileDown, CheckCircle, AlertCircle, FileText, X, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  IconButton,
  PageHeader,
  SurfaceCard,
} from '../components/ui';
import { useCsvImport } from '../features/csv-import/hooks/useCsvImport';

const CsvImport = () => {
  const {
    bankId,
    bank,
    file,
    uploadStatus,
    parseResult,
    importResult,
    errorMessage,
    setErrorMessage,
    downloading,
    handleDownloadTemplate,
    handleSelectFile,
    handleParseFile,
    handleImport,
    handleReset,
    handleBackToBank,
  } = useCsvImport();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="CSV 批量导入"
        subtitle={bank ? `导入到题库：${bank.name}` : '通过 CSV 文件批量上传题目'}
        actions={
          <div className="flex gap-3">
            <ActionButton
              variant="secondary"
              icon={FileDown}
              onClick={handleDownloadTemplate}
              disabled={downloading}
              loading={downloading}
            >
              {downloading ? '下载中...' : '下载模板'}
            </ActionButton>
            <ActionButton variant="secondary" icon={ArrowLeft} onClick={handleBackToBank}>
              返回题库
            </ActionButton>
          </div>
        }
      />

      {errorMessage && uploadStatus !== 'error' && (
        <AlertBanner type="danger" title="操作失败" className="items-center">
          <div className="flex items-center gap-3">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              className="rounded-lg p-1 text-danger transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
              aria-label="关闭错误提示"
              title="关闭错误提示"
            >
              <X size={16} />
            </button>
          </div>
        </AlertBanner>
      )}

      <SurfaceCard padding="p-6 sm:p-8">
        {!file ? (
          <button
            type="button"
            onClick={handleSelectFile}
            className="group flex min-h-[260px] w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-8 text-center transition-all hover:border-primary hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-700/30 dark:hover:bg-gray-700"
          >
            <div className="ui-icon-tile mb-5 size-20 bg-white text-primary shadow-sm transition-transform group-hover:scale-105 dark:bg-gray-800">
              <Upload size={36} />
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 transition-colors group-hover:text-primary dark:text-gray-100">
              点击选择 CSV 文件
            </h3>
            <p className="mt-1 text-sm text-gray-400">支持扩展名：.csv</p>
          </button>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-2xl border border-green-100 bg-green-50/60 p-4 dark:border-green-900/30 dark:bg-green-900/10">
              <div className="ui-icon-tile size-11 bg-white text-success shadow-sm dark:bg-gray-800">
                <FileText size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-gray-900 dark:text-gray-100">{file.name}</p>
                <p className="text-sm text-gray-400">已选择文件</p>
              </div>
              {(uploadStatus === 'idle' || uploadStatus === 'parsed') && (
                <IconButton
                  label="移除文件"
                  icon={X}
                  tooltip={false}
                  onClick={handleReset}
                  className="text-gray-500 hover:bg-red-50 hover:text-danger"
                />
              )}
            </div>

            {uploadStatus === 'idle' && (
              <ActionButton onClick={handleParseFile} className="w-full" icon={FileText} size="lg">
                解析文件
              </ActionButton>
            )}

            {uploadStatus === 'parsing' && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.5 }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
                <p className="text-center text-sm text-gray-400">正在解析数据...</p>
              </div>
            )}

            {uploadStatus === 'parsed' && parseResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-gray-50 p-4 text-center dark:bg-gray-700">
                    <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
                      {parseResult.totalRows}
                    </p>
                    <p className="text-sm text-gray-400">总行数</p>
                  </div>
                  <div className="rounded-2xl bg-green-50 p-4 text-center dark:bg-green-900/20">
                    <p className="text-3xl font-extrabold text-green-600 dark:text-green-400">
                      {parseResult.valid.length}
                    </p>
                    <p className="text-sm text-gray-400">有效题目</p>
                  </div>
                  <div className="rounded-2xl bg-red-50 p-4 text-center dark:bg-red-900/20">
                    <p className="text-3xl font-extrabold text-red-600 dark:text-red-400">
                      {parseResult.errors.length}
                    </p>
                    <p className="text-sm text-gray-400">错误行</p>
                  </div>
                </div>

                {parseResult.errors.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-2xl border border-red-100 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/20">
                    <h4 className="mb-2 flex items-center gap-2 font-bold text-red-700 dark:text-red-400">
                      <AlertCircle size={16} />
                      错误详情
                    </h4>
                    <ul className="space-y-1 text-sm text-red-600 dark:text-red-400">
                      {parseResult.errors.map((err, idx) => (
                        <li key={idx}>
                          第 {err.row} 行{err.field ? `，${err.field}` : ''}：{err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {parseResult.valid.length > 0 ? (
                  <ActionButton
                    onClick={handleImport}
                    disabled={!bankId}
                    className="w-full"
                    size="lg"
                    icon={Upload}
                  >
                    {bankId ? `导入 ${parseResult.valid.length} 道题目` : '请先选择题库'}
                  </ActionButton>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title="没有可导入的有效题目"
                    description="请检查 CSV 文件格式、题型和答案字段。"
                    action={
                      <ActionButton variant="secondary" onClick={handleReset}>
                        重新选择文件
                      </ActionButton>
                    }
                    className="min-h-[180px] bg-blue-50/50 dark:bg-gray-700/30"
                  />
                )}
              </div>
            )}

            {uploadStatus === 'importing' && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2 }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
                <p className="text-center text-sm text-gray-400">正在导入题目...</p>
              </div>
            )}

            {uploadStatus === 'success' && importResult && (
              <EmptyState
                icon={CheckCircle}
                title="导入完成"
                description={
                  <>
                    成功导入 {importResult.success} 道题目
                    {importResult.failed > 0 && (
                      <span className="text-red-500">，{importResult.failed} 道失败</span>
                    )}
                  </>
                }
                action={
                  <div className="flex gap-3">
                    <ActionButton variant="secondary" onClick={handleReset}>
                      继续导入
                    </ActionButton>
                    <ActionButton onClick={handleBackToBank}>返回题库</ActionButton>
                  </div>
                }
                className="bg-green-50/60 dark:bg-green-900/10"
              />
            )}

            {uploadStatus === 'error' && (
              <EmptyState
                icon={AlertCircle}
                title="操作失败"
                description={errorMessage || '未知错误'}
                action={
                  <ActionButton variant="secondary" onClick={handleReset}>
                    重新选择文件
                  </ActionButton>
                }
                className="bg-red-50/60 dark:bg-red-900/10"
              />
            )}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
};

export default CsvImport;
