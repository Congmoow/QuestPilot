export const getPublicAssetPath = (assetPath) => {
  if (!assetPath) return assetPath;

  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return `.${normalizedPath}`;
};
