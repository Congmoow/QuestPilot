export const BLANK_PATTERN = /_{1,}|＿+|（\s*）|\(\s*\)/g;

export function countFillBlanks(content) {
  return (String(content || '').match(BLANK_PATTERN) || []).length;
}
