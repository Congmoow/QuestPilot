import React, { useState, useEffect } from 'react';
import { Upload, FileDown, CheckCircle, AlertCircle, FileText, X, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { downloadCsvTemplate, selectCsvFile, parseCsvFile, importQuestions, getQuestionBankById } from '../api';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  IconButton,
  PageHeader,
  StatusBadge,
  SurfaceCard
} from '../components/ui';

const CsvImport = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bankId = searchParams.get('bankId');
  
  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState(null);
  const [filePath, setFilePath] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, parsing, parsed, importing, success, error
  const [parseResult, setParseResult] = useState(null); // { valid: [], errors: [], totalRows: 0 }
  const [importResult, setImportResult] = useState(null); // { success: 0, failed: 0, errors: [] }
  const [errorMessage, setErrorMessage] = useState('');
  const [bank, setBank] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const steps = [
    { id: 1, title: '下载模板', desc: '获取标准导入格式' },
    { id: 2, title: '填写数据', desc: '按照规则完善信息' },
    { id: 3, title: '上传文件', desc: '拖拽或点击上传' },
  ];

  // 加载题库信息
  useEffect(() => {
    if (bankId) {
      getQuestionBankById(parseInt(bankId)).then(setBank).catch(console.error);
    }
  }, [bankId]);

  // 下载模板
  const handleDownloadTemplate = async () => {
    setDownloading(true);
    setErrorMessage('');
    try {
      const result = await downloadCsvTemplate();
      if (result.success) {
        setCurrentStep(2);
      } else if (!result.canceled) {
        setErrorMessage('下载模板失败');
      }
    } catch (error) {
      setErrorMessage(error.message || '下载模板失败');
    } finally {
      setDownloading(false);
    }
  };

  // 选择文件
  const handleSelectFile = async () => {
    setErrorMessage('');
    try {
      const result = await selectCsvFile();
      if (result.success && result.filePath) {
        const fileName = result.filePath.split(/[/\\]/).pop();
        setFile({ name: fileName, path: result.filePath });
        setFilePath(result.filePath);
        setUploadStatus('idle');
        setParseResult(null);
        setImportResult(null);
      }
    } catch (error) {
      setErrorMessage(error.message || '选择文件失败');
    }
  };

  // 解析文件
  const handleParseFile = async () => {
    if (!filePath) return;
    
    setUploadStatus('parsing');
    setErrorMessage('');
    
    try {
      const result = await parseCsvFile(filePath);
      setParseResult(result);
      setUploadStatus('parsed');
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error.message || '解析文件失败');
    }
  };

  // 导入题目
  const handleImport = async () => {
    if (!parseResult || !parseResult.valid || parseResult.valid.length === 0) {
      setErrorMessage('没有可导入的有效题目');
      return;
    }
    
    if (!bankId) {
      setErrorMessage('请先选择题库');
      return;
    }
    
    setUploadStatus('importing');
    setErrorMessage('');
    
    try {
      const result = await importQuestions(parseInt(bankId), parseResult.valid);
      setImportResult(result);
      setUploadStatus('success');
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error.message || '导入失败');
    }
  };

  // 重置状态
  const handleReset = () => {
    setFile(null);
    setFilePath(null);
    setUploadStatus('idle');
    setParseResult(null);
    setImportResult(null);
    setErrorMessage('');
  };

  // 返回题库
  const handleBackToBank = () => {
    navigate('/question-preview');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="批量导入"
        subtitle={bank ? `导入到题库：${bank.name}` : '通过 CSV 文件批量上传题目'}
        actions={(
          <ActionButton variant="secondary" icon={ArrowLeft} onClick={handleBackToBank}>
            返回题库
          </ActionButton>
        )}
      />

      {/* 错误提示 */}
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

      {/* Stepper */}
      <SurfaceCard padding="p-6">
        <div className="relative grid gap-4 md:grid-cols-3">
          <div className="absolute left-8 right-8 top-6 hidden h-1 rounded-full bg-blue-100 dark:bg-gray-700 md:block" />
          {steps.map((step) => {
            const isActive = currentStep >= step.id;
            const isCurrent = currentStep === step.id;
            
            return (
              <button
                type="button"
                key={step.id} 
                className="relative z-10 flex items-center gap-4 rounded-2xl border border-transparent p-3 text-left transition-all hover:border-blue-100 hover:bg-blue-50/60 dark:hover:bg-gray-700 md:flex-col md:text-center"
                onClick={() => setCurrentStep(step.id)}
              >
                <div className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold shadow-sm transition-all duration-300",
                  isActive ? "bg-primary text-white" : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-300",
                  isCurrent && "ring-4 ring-primary/10"
                )}>
                  {currentStep > step.id ? <CheckCircle size={20} /> : step.id}
                </div>
                <div className="min-w-0 bg-transparent px-0 md:px-2">
                  <p className={cn("text-sm font-extrabold", isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400")}>
                    {step.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{step.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Content Area */}
      <SurfaceCard className="min-h-[440px] overflow-hidden" padding="p-0">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex min-h-[440px] flex-col items-center justify-center space-y-6 p-8 text-center sm:p-12"
            >
              <div className="ui-icon-tile size-24 bg-gradient-to-br from-blue-50 to-blue-100 text-primary">
                <FileDown size={40} />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">下载标准模板</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-500 dark:text-gray-400">
                  请务必使用系统提供的标准模板进行填写，不要修改表头信息，否则可能导致导入失败。
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ActionButton
                  onClick={handleDownloadTemplate}
                  disabled={downloading}
                  loading={downloading}
                  icon={FileDown}
                >
                  {downloading ? '下载中...' : '下载 CSV 模板'}
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  onClick={() => setCurrentStep(2)}
                >
                  已有模板，跳过
                </ActionButton>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
             <motion.div 
             key="step2"
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: -20 }}
             className="p-6 sm:p-10"
           >
             <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
               <div>
                 <h3 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">模板填写规范</h3>
                 <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">按规则填写后再上传，可减少解析错误。</p>
               </div>
               <StatusBadge variant="primary">CSV 模板</StatusBadge>
             </div>
             <div className="grid gap-4 lg:grid-cols-2">
               {[
                 '题型：单选题/多选题/判断题/填空题/简答题',
                 '题干：题目内容，填空题使用 _、___、＿＿、（ ）或( ) 表示空栏',
                 '选项A-F：选择题的选项内容，非选择题留空',
                 '答案：单选填选项字母(如A)，多选用|分隔(如A|B)，判断填"正确"或"错误"，填空用|分隔多个答案',
                 '解析：题目解析说明（可选）'
               ].map((rule, idx) => (
                 <div key={idx} className="flex items-start gap-3 rounded-2xl border border-blue-50 bg-blue-50/60 p-4 dark:border-gray-700 dark:bg-gray-700/40">
                   <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-bold text-primary shadow-sm dark:bg-gray-800">
                     {idx + 1}
                   </div>
                   <span className="text-sm font-medium leading-6 text-gray-700 dark:text-gray-300">{rule}</span>
                 </div>
               ))}
             </div>
             <div className="mt-8 flex flex-col justify-between gap-3 sm:flex-row">
               <ActionButton
                 variant="secondary"
                 onClick={() => setCurrentStep(1)}
               >
                 上一步
               </ActionButton>
               <ActionButton
                 onClick={() => setCurrentStep(3)}
                 icon={Upload}
               >
                 我已填写完毕，下一步
               </ActionButton>
             </div>
           </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 sm:p-10"
            >
              {!file ? (
                <div className="space-y-6">
                  <button
                    type="button"
                    onClick={handleSelectFile}
                    className="group flex min-h-[280px] w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-8 text-center transition-all hover:border-primary hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-700/30 dark:hover:bg-gray-700"
                  >
                    <div className="ui-icon-tile mb-6 size-24 bg-white text-primary shadow-sm transition-transform group-hover:scale-105 dark:bg-gray-800">
                      <Upload size={40} />
                    </div>
                    <h3 className="text-xl font-extrabold text-gray-900 transition-colors group-hover:text-primary dark:text-gray-100">点击选择文件</h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">支持扩展名：.csv</p>
                  </button>
                  <div className="flex justify-start">
                    <ActionButton
                      variant="secondary"
                      onClick={() => setCurrentStep(2)}
                    >
                      上一步
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 文件信息 */}
                  <div className="flex items-center gap-4 rounded-3xl border border-green-100 bg-green-50/60 p-4 dark:border-green-900/30 dark:bg-green-900/10">
                    <div className="ui-icon-tile size-12 bg-white text-success shadow-sm dark:bg-gray-800">
                      <FileText size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-extrabold text-gray-900 dark:text-gray-100">{file.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">已选择文件</p>
                    </div>
                    {(uploadStatus === 'idle' || uploadStatus === 'parsed') && (
                      <IconButton
                        label="移除文件"
                        icon={X}
                        onClick={handleReset}
                        className="text-gray-500 hover:bg-red-50 hover:text-danger"
                      />
                    )}
                  </div>

                  {/* 解析按钮 */}
                  {uploadStatus === 'idle' && (
                    <ActionButton
                      onClick={handleParseFile}
                      className="w-full"
                      icon={FileText}
                      size="lg"
                    >
                      解析文件
                    </ActionButton>
                  )}

                  {/* 解析中 */}
                  {uploadStatus === 'parsing' && (
                    <div className="space-y-2">
                      <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 1.5 }}
                          className="h-full rounded-full bg-primary"
                        />
                      </div>
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400">正在解析数据...</p>
                    </div>
                  )}

                  {/* 解析结果预览 */}
                  {uploadStatus === 'parsed' && parseResult && (
                    <div className="space-y-4">
                      {/* 统计信息 */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-2xl bg-gray-50 p-4 text-center dark:bg-gray-700">
                          <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{parseResult.totalRows}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">总行数</p>
                        </div>
                        <div className="rounded-2xl bg-green-50 p-4 text-center dark:bg-green-900/20">
                          <p className="text-3xl font-extrabold text-green-600 dark:text-green-400">{parseResult.valid.length}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">有效题目</p>
                        </div>
                        <div className="rounded-2xl bg-red-50 p-4 text-center dark:bg-red-900/20">
                          <p className="text-3xl font-extrabold text-red-600 dark:text-red-400">{parseResult.errors.length}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">错误行</p>
                        </div>
                      </div>

                      {/* 错误详情 */}
                      {parseResult.errors.length > 0 && (
                        <div className="max-h-52 overflow-y-auto rounded-2xl border border-red-100 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/20">
                          <h4 className="mb-3 flex items-center gap-2 font-bold text-red-700 dark:text-red-400">
                            <AlertCircle size={18} />
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

                      {/* 导入按钮 */}
                      {parseResult.valid.length > 0 && (
                        <ActionButton
                          onClick={handleImport}
                          disabled={!bankId}
                          className="w-full"
                          size="lg"
                          icon={Upload}
                        >
                          {bankId ? `导入 ${parseResult.valid.length} 道题目` : '请先选择题库'}
                        </ActionButton>
                      )}

                      {parseResult.valid.length === 0 && (
                        <EmptyState
                          icon={FileText}
                          title="没有可导入的有效题目"
                          description="请检查 CSV 文件格式、题型和答案字段，再重新选择文件解析。"
                          action={<ActionButton variant="secondary" onClick={handleReset}>重新选择文件</ActionButton>}
                          className="min-h-[220px] bg-blue-50/50 dark:bg-gray-700/30"
                        />
                      )}
                    </div>
                  )}

                  {/* 导入中 */}
                  {uploadStatus === 'importing' && (
                    <div className="space-y-2">
                      <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 2 }}
                          className="h-full rounded-full bg-primary"
                        />
                      </div>
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400">正在导入题目...</p>
                    </div>
                  )}

                  {/* 导入成功 */}
                  {uploadStatus === 'success' && importResult && (
                    <EmptyState
                      icon={CheckCircle}
                      title="导入完成"
                      description={(
                        <>
                          成功导入 {importResult.success} 道题目
                          {importResult.failed > 0 && (
                            <span className="text-red-500">，{importResult.failed} 道失败</span>
                          )}
                        </>
                      )}
                      action={(
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <ActionButton variant="secondary" onClick={handleReset}>继续导入</ActionButton>
                          <ActionButton onClick={handleBackToBank}>返回题库</ActionButton>
                        </div>
                      )}
                      className="bg-green-50/60 dark:bg-green-900/10"
                    />
                  )}

                  {/* 导入失败 */}
                  {uploadStatus === 'error' && (
                    <EmptyState
                      icon={AlertCircle}
                      title="操作失败"
                      description={errorMessage || '未知错误'}
                      action={<ActionButton variant="secondary" onClick={handleReset}>重新选择文件</ActionButton>}
                      className="bg-red-50/60 dark:bg-red-900/10"
                    />
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </SurfaceCard>
    </div>
  );
};

export default CsvImport;
