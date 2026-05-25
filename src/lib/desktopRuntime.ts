export const getDesktopRuntime = (): 'tauri' => 'tauri';

export const invokeTauriCommand = async <T = unknown>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
};

export const windowControls = {
  minimize: async (): Promise<void> => invokeTauriCommand('window_minimize'),
  maximize: async (): Promise<void> => invokeTauriCommand('window_maximize'),
  close: async (): Promise<void> => invokeTauriCommand('window_close'),
  isMaximized: async (): Promise<boolean> => invokeTauriCommand('window_is_maximized'),
};
