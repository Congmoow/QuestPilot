import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { IconButton } from './ui';

/**
 * 通用对话框组件
 * @param {Object} props
 * @param {boolean} props.open - 是否显示对话框
 * @param {() => void} props.onClose - 关闭回调
 * @param {string} props.title - 对话框标题
 * @param {React.ReactNode} props.children - 对话框内容
 * @param {string} [props.className] - 额外的样式类
 * @param {'sm' | 'md' | 'lg' | 'xl'} [props.size='md'] - 对话框尺寸
 */
export function Dialog({ open, onClose, title, children, className, size = 'md' }) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };
  const overlayRef = useRef(null);

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // 点击遮罩关闭
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "w-full max-h-[90vh] overflow-hidden rounded-card border border-gray-200 bg-white shadow-popover dark:border-gray-700 dark:bg-gray-800",
              sizeClasses[size] || sizeClasses.md,
              className
            )}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
              <IconButton label="关闭弹窗" icon={X} variant="ghost" onClick={onClose} />
            </div>
            <div className="max-h-[calc(90vh-73px)] overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Dialog;
