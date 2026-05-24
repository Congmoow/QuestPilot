import { isTauriRuntime } from './desktopRuntime';

export const getPublicAssetPath = (assetPath) => {
  if (!assetPath) return assetPath;

  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;

  if (typeof window !== 'undefined' && (window.electronAPI || isTauriRuntime())) {
    return `.${normalizedPath}`;
  }

  return normalizedPath;
};
