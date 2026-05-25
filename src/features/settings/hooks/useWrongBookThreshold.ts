import { useEffect, useState } from 'react';
import api from '../../../api';

export const useWrongBookThreshold = () => {
  const [wrongBookThreshold, setWrongBookThreshold] = useState('3');
  const [savingWrongBook, setSavingWrongBook] = useState(false);
  const [savedWrongBook, setSavedWrongBook] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const threshold = await api.settings.getWrongBookThreshold();
        setWrongBookThreshold(String(threshold || 3));
      } catch (error) {
        console.error('加载错题本阈值失败:', error);
      }
    };
    load();
  }, []);

  const handleSaveWrongBookThreshold = async () => {
    setSavingWrongBook(true);
    setSavedWrongBook(false);
    try {
      const parsed = Number(wrongBookThreshold);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 999) {
        alert('阈值必须是 1-999 的数字');
        return;
      }
      await api.settings.setWrongBookThreshold(parsed);
      setSavedWrongBook(true);
      setTimeout(() => setSavedWrongBook(false), 3000);
    } catch (error) {
      console.error('保存错题本阈值失败:', error);
    } finally {
      setSavingWrongBook(false);
    }
  };

  return {
    wrongBookThreshold,
    setWrongBookThreshold,
    savingWrongBook,
    savedWrongBook,
    handleSaveWrongBookThreshold,
  };
};
