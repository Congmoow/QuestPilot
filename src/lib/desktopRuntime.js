export const getDesktopRuntime = () => 'tauri';

export const invokeTauriCommand = async (command, args = {}) => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(command, args);
};

export const windowControls = {
  minimize: async () => invokeTauriCommand('window_minimize'),
  maximize: async () => invokeTauriCommand('window_maximize'),
  close: async () => invokeTauriCommand('window_close'),
  isMaximized: async () => invokeTauriCommand('window_is_maximized'),
};
