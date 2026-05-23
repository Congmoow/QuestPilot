export const getElectronAPI = () => {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }

  return null;
};

export const isTauriRuntime = () => {
  if (typeof window === 'undefined') return false;

  return Boolean(window.__TAURI_INTERNALS__ || window.isTauri);
};

export const getDesktopRuntime = () => {
  if (getElectronAPI()) return 'electron';
  if (isTauriRuntime()) return 'tauri';
  return 'browser';
};

export const invokeTauriCommand = async (command, args = {}) => {
  if (!isTauriRuntime()) {
    throw new Error('Tauri API 不可用');
  }

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(command, args);
};

export const getDesktopApiUnavailableError = () => {
  if (isTauriRuntime()) {
    return new Error('Tauri PoC 暂未实现此接口');
  }

  return new Error('桌面 API 不可用');
};

export const getUnsupportedTauriApiError = (apiName) => {
  return new Error(`Tauri PoC 暂未实现接口：${apiName}`);
};

export const windowControls = {
  minimize: async () => {
    const api = getElectronAPI();
    if (api?.window?.minimize) return api.window.minimize();
    if (isTauriRuntime()) return invokeTauriCommand('window_minimize');
    throw getDesktopApiUnavailableError();
  },

  maximize: async () => {
    const api = getElectronAPI();
    if (api?.window?.maximize) return api.window.maximize();
    if (isTauriRuntime()) return invokeTauriCommand('window_maximize');
    throw getDesktopApiUnavailableError();
  },

  close: async () => {
    const api = getElectronAPI();
    if (api?.window?.close) return api.window.close();
    if (isTauriRuntime()) return invokeTauriCommand('window_close');
    throw getDesktopApiUnavailableError();
  },

  isMaximized: async () => {
    const api = getElectronAPI();
    if (api?.window?.isMaximized) return api.window.isMaximized();
    if (isTauriRuntime()) return invokeTauriCommand('window_is_maximized');
    return false;
  },
};
