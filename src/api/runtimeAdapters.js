const toCanceled = (value) => Boolean(value?.canceled ?? value?.cancelled ?? false);

export const normalizeFileSelectionResult = (result) => {
  if (typeof result === 'string' && result.trim() !== '') {
    return {
      success: true,
      canceled: false,
      filePath: result,
    };
  }

  if (!result) {
    return {
      success: false,
      canceled: true,
      filePath: null,
    };
  }

  const filePath = result.filePath || null;
  const canceled = toCanceled(result);

  return {
    success: Boolean(result.success ?? (filePath && !canceled)),
    canceled,
    filePath,
  };
};

export const normalizeSaveDialogResult = (result) => {
  const canceled = toCanceled(result);
  const normalized = {
    success: Boolean(result?.success ?? false),
    canceled,
  };

  if (result?.filePath) {
    normalized.filePath = result.filePath;
  }

  if (typeof result?.count === 'number') {
    normalized.count = result.count;
  }

  return normalized;
};
