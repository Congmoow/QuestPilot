import { type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import Dialog from './Dialog';
import { ActionButton } from './ui';

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: ReactNode;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
};

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
}: ConfirmDialogProps) {
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
      button: 'danger' as const,
    },
    warning: {
      icon: 'bg-orange-100 text-orange-600',
      button: 'primary' as const,
    },
    primary: {
      icon: 'bg-primary/10 text-primary',
      button: 'primary' as const,
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
