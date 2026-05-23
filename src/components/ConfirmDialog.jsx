import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Dialog from './Dialog';
import { ActionButton } from './ui';

/**
 * 确认对话框组件
 * @param {Object} props
 * @param {boolean} props.open - 是否显示对话框
 * @param {() => void} props.onClose - 关闭回调
 * @param {() => Promise<void>} props.onConfirm - 确认回调
 * @param {string} props.title - 对话框标题
 * @param {string} props.message - 确认消息
 * @param {string} [props.confirmText] - 确认按钮文本
 * @param {string} [props.cancelText] - 取消按钮文本
 * @param {'danger' | 'warning' | 'primary'} [props.type] - 对话框类型
 * @param {boolean} [props.loading] - 加载状态
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'danger',
  loading = false,
}) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      // 错误由调用方处理
    }
  };

  const typeStyles = {
    danger: {
      icon: 'bg-danger/10 text-danger',
      button: 'danger',
    },
    warning: {
      icon: 'bg-orange-100 text-orange-600',
      button: 'primary',
    },
    primary: {
      icon: 'bg-primary/10 text-primary',
      button: 'primary',
    },
  };

  const styles = typeStyles[type] || typeStyles.danger;

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className={`rounded-2xl p-3 ${styles.icon}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <p className="leading-7 text-gray-600 dark:text-gray-300">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <ActionButton type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </ActionButton>
          <ActionButton type="button" variant={styles.button} onClick={handleConfirm} disabled={loading} loading={loading}>
            {confirmText}
          </ActionButton>
        </div>
      </div>
    </Dialog>
  );
}

export default ConfirmDialog;
