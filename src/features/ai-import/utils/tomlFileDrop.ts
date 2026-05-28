export const selectTomlDropPath = (paths: string[]): string | null => {
  return paths.find((path) => path.toLowerCase().endsWith('.toml')) ?? null;
};

export const selectJsonDropPath = (paths: string[]): string | null => {
  return paths.find((path) => path.toLowerCase().endsWith('.json')) ?? null;
};

export const selectAiDropPath = (paths: string[]): string | null => {
  return paths.find((path) => /\.(md|txt)$/i.test(path)) ?? null;
};
