import type { ReactElement, ReactNode } from 'react';

export interface CodeAwareTextProps {
  text?: ReactNode;
  className?: string;
}

export default function CodeAwareText(props: CodeAwareTextProps): ReactElement | null;
