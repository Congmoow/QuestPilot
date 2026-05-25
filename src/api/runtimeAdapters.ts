type MaybeCanceled = { canceled?: boolean; cancelled?: boolean } | null | undefined;

type FileSelectionResult = {
  success: boolean;
  canceled: boolean;
  filePath: string | null;
};

type SaveDialogResult = {
  success: boolean;
  canceled: boolean;
  filePath?: string;
  count?: number;
};

const toCanceled = (value: MaybeCanceled): boolean =>
  Boolean(
    (value as Record<string, unknown>)?.canceled ??
    (value as Record<string, unknown>)?.cancelled ??
    false,
  );

export const normalizeFileSelectionResult = (result: unknown): FileSelectionResult => {
  if (typeof result === 'string' && result.trim() !== '') {
    return { success: true, canceled: false, filePath: result };
  }

  if (!result) {
    return { success: false, canceled: true, filePath: null };
  }

  const r = result as Record<string, unknown>;
  const filePath = (r.filePath as string) || null;
  const canceled = toCanceled(r as MaybeCanceled);

  return {
    success: Boolean(r.success ?? (filePath && !canceled)),
    canceled,
    filePath,
  };
};

export const normalizeSaveDialogResult = (result: unknown): SaveDialogResult => {
  const r = result as Record<string, unknown> | null | undefined;
  const canceled = toCanceled(r as MaybeCanceled);
  const normalized: SaveDialogResult = {
    success: Boolean(r?.success ?? false),
    canceled,
  };

  if (r?.filePath) normalized.filePath = r.filePath as string;
  if (typeof r?.count === 'number') normalized.count = r.count;

  return normalized;
};
