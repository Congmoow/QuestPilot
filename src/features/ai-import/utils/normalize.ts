export const normalizeBooleanAnswer = (answer: unknown): string => {
  if (answer === true) return '正确';
  if (answer === false) return '错误';
  const raw = String(answer ?? '').trim();
  const lower = raw.toLowerCase();
  const trueValues = ['正确', '对', '是', '√', 'true', 't', 'yes', 'y', '1'];
  const falseValues = ['错误', '错', '否', '×', 'false', 'f', 'no', 'n', '0'];
  if (trueValues.includes(raw) || trueValues.includes(lower)) return '正确';
  if (falseValues.includes(raw) || falseValues.includes(lower)) return '错误';
  return raw;
};

export const normalizeChoiceAnswer = (answer: unknown, multiple = false): string => {
  if (Array.isArray(answer)) {
    return answer.map((a) => normalizeChoiceAnswer(a, false)).filter(Boolean).join('|');
  }
  const raw = String(answer ?? '').trim().toUpperCase();
  if (!raw) return raw;
  const parts = raw
    .replace(/[，,、;；\s]+/g, '|')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  const letters: string[] = [];
  for (const part of parts) {
    if (/^[A-Z]+$/.test(part)) {
      letters.push(...part.split(''));
      continue;
    }
    const match = part.match(/^([A-Z])(?:\s*[.、．:：)]|\s|$)/) || part.match(/[A-Z]/);
    if (match) letters.push(match[1] || match[0]);
  }
  const uniqueLetters = [...new Set(letters)];
  if (multiple) return uniqueLetters.join('|');
  return uniqueLetters[0] || raw;
};

export type ParseChunkError = { chunkIndex?: number; message?: string };

export const getChunkIndex = (item: ParseChunkError, fallbackIndex: number): number => {
  const parsed = Number(item?.chunkIndex);
  return Number.isFinite(parsed) ? parsed : fallbackIndex;
};
