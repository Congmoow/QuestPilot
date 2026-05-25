import { Bot } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { type AiConfigView, inferProviderFromModel, providerInfo } from '../utils/providers';

type AiIconProps = AiConfigView & {
  size?: number;
  className?: string;
};

const AiIcon = ({ provider, modelId, size = 24, className = '' }: AiIconProps) => {
  const actualProvider = provider !== 'custom' ? provider : inferProviderFromModel(modelId);
  const info = providerInfo(actualProvider);

  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-xl bg-primary-soft text-primary', className)}
      style={{ width: size, height: size, color: info.color }}
    >
      <Bot size={Math.max(16, size * 0.62)} />
    </span>
  );
};

export default AiIcon;
