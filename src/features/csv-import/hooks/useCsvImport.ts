import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  downloadCsvTemplate,
  getQuestionBankById,
  importQuestions,
  parseCsvFile,
  selectCsvFile,
} from '../../../api';
import type { ImportResult, ParseResult, QuestionBank } from '../../../api';

type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'parsed' | 'importing' | 'success' | 'error';

export const useCsvImport = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bankId = searchParams.get('bankId');

  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState<{ name: string; path: string } | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (bankId) {
      getQuestionBankById(parseInt(bankId, 10)).then(setBank).catch(console.error);
    }
  }, [bankId]);

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
      setErrorMessage(error instanceof Error ? error.message : '下载模板失败');
    } finally {
      setDownloading(false);
    }
  };

  const handleSelectFile = async () => {
    setErrorMessage('');
    try {
      const result = await selectCsvFile();
      if (result.success && result.filePath) {
        const fileName = result.filePath.split(/[/\\]/).pop() || result.filePath;
        setFile({ name: fileName, path: result.filePath });
        setFilePath(result.filePath);
        setUploadStatus('idle');
        setParseResult(null);
        setImportResult(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '选择文件失败');
    }
  };

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
      setErrorMessage(error instanceof Error ? error.message : '解析文件失败');
    }
  };

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
      const result = await importQuestions(parseInt(bankId, 10), parseResult.valid);
      setImportResult(result);
      setUploadStatus('success');
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '导入失败');
    }
  };

  const handleReset = () => {
    setFile(null);
    setFilePath(null);
    setUploadStatus('idle');
    setParseResult(null);
    setImportResult(null);
    setErrorMessage('');
  };

  const handleBackToBank = () => navigate('/question-preview');

  return {
    bankId,
    bank,
    currentStep,
    setCurrentStep,
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
  };
};
