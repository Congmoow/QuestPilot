import { Bot } from 'lucide-react';
import { getPublicAssetPath } from '../../../lib/assets';
import { cn } from '../../../lib/utils';
import { getAiProviderIconPath, resolveAiProviderId } from '../utils/providerAssets';
import { type AiConfigView, providerInfo } from '../utils/providers';

type AiIconProps = AiConfigView & {
  size?: number;
  className?: string;
};

const AiIcon = ({ provider, modelId, size = 24, className = '' }: AiIconProps) => {
  const actualProvider = resolveAiProviderId(provider, modelId);
  const info = providerInfo(actualProvider);
  const iconPath = getAiProviderIconPath(provider, modelId);

  if (iconPath) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-xl bg-white',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <img
          src={getPublicAssetPath(iconPath)}
          alt={info.name}
          className="h-full w-full object-contain"
          draggable={false}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-xl bg-primary-soft text-primary',
        className,
      )}
      style={{ width: size, height: size, color: info.color }}
    >
      <Bot size={Math.max(16, size * 0.62)} />
    </span>
  );
};

export default AiIcon;
