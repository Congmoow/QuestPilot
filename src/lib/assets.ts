export const getPublicAssetPath = (assetPath: string): string => {
  if (!assetPath) return assetPath;

  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return `.${normalizedPath}`;
};
