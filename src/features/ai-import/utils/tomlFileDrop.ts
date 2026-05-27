export const selectTomlDropPath = (paths: string[]): string | null => {
  return paths.find((path) => path.toLowerCase().endsWith('.toml')) ?? null;
};
