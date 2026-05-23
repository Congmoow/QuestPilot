import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

const BRAND_FONT_FAMILY = 'QuestPilotBrand';
let brandFontLoading = null;

const getPublicAssetPath = (assetPath) => {
  if (window.electronAPI) {
    return `.${assetPath}`;
  }
  return assetPath;
};

const loadBrandFont = () => {
  if (brandFontLoading || typeof FontFace === 'undefined' || !document.fonts) {
    return brandFontLoading;
  }

  const fonts = [
    new FontFace(BRAND_FONT_FAMILY, `url("${getPublicAssetPath('/fonts/dancing-script-regular.ttf')}")`, {
      style: 'normal',
      weight: '400',
      display: 'swap',
    }),
    new FontFace(BRAND_FONT_FAMILY, `url("${getPublicAssetPath('/fonts/dancing-script-bold.ttf')}")`, {
      style: 'normal',
      weight: '700',
      display: 'swap',
    }),
  ];

  brandFontLoading = Promise.all(fonts.map((font) => font.load()))
    .then((loadedFonts) => {
      loadedFonts.forEach((font) => document.fonts.add(font));
    })
    .catch((error) => {
      console.warn('加载本地品牌字体失败:', error);
      brandFontLoading = null;
    });

  return brandFontLoading;
};

// 获取图标路径，兼容开发环境和打包后环境
const getIconPath = () => {
  return getPublicAssetPath('/icon.png');
};

const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const iconPath = getIconPath();

  useEffect(() => {
    loadBrandFont();
  }, []);

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
    <div className="app-drag flex h-14 select-none items-center justify-between overflow-hidden rounded-t-xl bg-white shadow-[8px_0_28px_rgba(15,23,42,0.04)] dark:bg-gray-800">
      <div className="flex items-center gap-2 px-4">
        <img src={iconPath} alt="QuestPilot 标志" className="size-8" />
        <span className="text-[36px] font-bold leading-none text-gray-700 dark:text-gray-200" style={{ fontFamily: `'${BRAND_FONT_FAMILY}', 'Microsoft YaHei', 'PingFang SC', cursive` }}>QuestPilot</span>
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
