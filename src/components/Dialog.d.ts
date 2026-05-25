import type { ReactElement, ReactNode } from 'react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Dialog(props: DialogProps): ReactElement | null;

export default Dialog;
