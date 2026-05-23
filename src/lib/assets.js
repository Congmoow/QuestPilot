export const getPublicAssetPath = (assetPath) => {
  if (!assetPath) return assetPath;

  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;

  if (typeof window !== 'undefined' && window.electronAPI) {
    return `.${normalizedPath}`;
  }

  return normalizedPath;
};
