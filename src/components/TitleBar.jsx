import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

// 获取图标路径，兼容开发环境和打包后环境
const getIconPath = () => {
  // 打包后的 Electron 环境
  if (window.electronAPI) {
    return './icon.png';
  }
  // 开发环境
  return '/icon.png';
};

const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const iconPath = getIconPath();

  useEffect(() => {
    const checkMaximized = async () => {
      if (window.electronAPI?.window?.isMaximized) {
        const maximized = await window.electronAPI.window.isMaximized();
        setIsMaximized(maximized);
      }
    };
    checkMaximized();
    
    // 监听窗口大小变化
    const handleResize = () => checkMaximized();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.window?.minimize();
  };

  const handleMaximize = async () => {
    await window.electronAPI?.window?.maximize();
    const maximized = await window.electronAPI?.window?.isMaximized();
    setIsMaximized(maximized);
  };

  const handleClose = () => {
    window.electronAPI?.window?.close();
  };

  return (
    <div className="app-drag flex h-10 select-none items-center justify-between overflow-hidden rounded-t-xl border-b border-gray-200/70 bg-white/92 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 px-4">
        <img src={iconPath} alt="题库助手系统 Logo" className="size-6" />
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">题库助手系统</span>
      </div>
      
      <div className="app-no-drag flex h-full items-center">
        <button
          onClick={handleMinimize}
          className="flex h-full items-center justify-center px-5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          title="最小化"
        >
          <Minus size={17} className="text-gray-500 dark:text-gray-400" />
        </button>
        <button
          onClick={handleMaximize}
          className="flex h-full items-center justify-center px-5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          title={isMaximized ? "还原" : "最大化"}
        >
          {isMaximized ? (
            <Copy size={14} className="text-gray-500 dark:text-gray-400" />
          ) : (
            <Square size={14} className="text-gray-500 dark:text-gray-400" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="group flex h-full items-center justify-center px-5 transition-colors hover:bg-red-500 hover:text-white"
          title="关闭"
        >
          <X size={17} className="text-gray-500 group-hover:text-white dark:text-gray-400" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
