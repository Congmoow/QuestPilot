import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { getTheme, setTheme as setThemeApi } from '../api';
import {
  SidebarAiChatIcon,
  SidebarAiImportIcon,
  SidebarDashboardIcon,
  SidebarPracticeIcon,
  SidebarQuestionBankIcon,
  SidebarSettingsIcon,
  SidebarWrongBookIcon,
} from './SidebarIcons';

export const ThemeContext = React.createContext({
  theme: 'system',
  setTheme: () => {},
});

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setThemeState] = useState('system');

  // 处理侧边栏响应式展开状态
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1040) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 从数据库读取主题设置
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await getTheme();
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setThemeState(savedTheme);
        }
      } catch (error) {
        console.error('加载主题设置失败:', error);
        // 如果数据库读取失败，尝试从 localStorage 读取作为后备
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemeState(stored);
        }
      }
    };
    
    loadTheme();
  }, []);

  // 设置主题并持久化到数据库
  const setTheme = useCallback(async (newTheme) => {
    setThemeState(newTheme);
    // 同时保存到 localStorage 作为后备
    localStorage.setItem('theme', newTheme);
    
    try {
      await setThemeApi(newTheme);
    } catch (error) {
      console.error('保存主题设置失败:', error);
    }
  }, []);

  // 根据主题更新 html 的 dark class，并在“跟随系统”模式下监听系统主题变化
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      // 先移除 dark class，再根据条件添加
      root.classList.remove('dark');
      
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'system' && mediaQuery.matches) {
        root.classList.add('dark');
      }
      // theme === 'light' 时不添加 dark class
    };

    applyTheme();

    const handleChange = () => {
      if (theme === 'system') {
        root.classList.remove('dark');
        if (mediaQuery.matches) {
          root.classList.add('dark');
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const navItems = [
    { path: '/dashboard', label: '首页', icon: SidebarDashboardIcon },
    { path: '/question-preview', label: '题库预览', icon: SidebarQuestionBankIcon },
    { path: '/practice', label: '随机练题', icon: SidebarPracticeIcon },
    { path: '/wrong-book', label: '错题本', icon: SidebarWrongBookIcon },
    { path: '/ai-import', label: 'AI智能录入', icon: SidebarAiImportIcon },
    { path: '/ai-chat', label: 'AI问答', icon: SidebarAiChatIcon },
    { path: '/settings', label: '系统设置', icon: SidebarSettingsIcon },
  ];

  const lightModeActive = theme !== 'dark';

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className="app-canvas flex h-full overflow-hidden">
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 264 : 76 }}
        className="relative z-20 flex shrink-0 flex-col overflow-visible border-r border-gray-200/80 bg-white shadow-[8px_0_28px_rgba(15,23,42,0.04)] transition-all duration-300 dark:border-gray-800 dark:bg-gray-800"
      >
        <div className={cn('flex h-20 items-center gap-3 px-6', !isSidebarOpen && 'justify-center px-0')}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-500 text-white shadow-soft">
            <span className="text-lg font-black leading-none">M</span>
          </div>
          {isSidebarOpen && (
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold text-gray-900 dark:text-white">题库助手系统</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-2 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "group relative flex h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold transition-all duration-200",
                isActive 
                  ? "bg-primary-soft text-primary shadow-sm" 
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white",
                !isSidebarOpen && "justify-center px-0"
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && isSidebarOpen && (
                    <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <item.icon size={21} className="min-w-[21px]" />
              {isSidebarOpen && (
                    <span className="animate-fade-in whitespace-nowrap">{item.label}</span>
              )}
              {!isSidebarOpen && (
                    <span className="pointer-events-none absolute left-full ml-3 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-popover transition-opacity group-hover:opacity-100">
                  {item.label}
                    </span>
              )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-4 border-t border-gray-100 p-4 dark:border-gray-700">
          <button
            type="button"
            onClick={handleToggleTheme}
            className={cn(
              "flex h-[58px] w-full items-center rounded-2xl border border-gray-100 bg-white px-4 text-gray-700 shadow-sm transition-colors hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
              !isSidebarOpen && "justify-center px-0"
            )}
          >
            <Sun size={20} className="shrink-0" />
            {isSidebarOpen && (
              <>
                <span className="ml-3 flex-1 text-left text-sm font-semibold">{lightModeActive ? '浅色模式' : '暗色模式'}</span>
                <span className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', lightModeActive ? 'bg-primary' : 'bg-gray-300')}>
                  <span className={cn('inline-flex size-5 translate-x-5 items-center justify-center rounded-full bg-white text-primary shadow-sm transition-transform', !lightModeActive && 'translate-x-1 text-gray-500')}>
                    {lightModeActive ? <Sun size={13} /> : <Moon size={13} />}
                  </span>
                </span>
              </>
            )}
          </button>

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex h-10 w-full items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label={isSidebarOpen ? '折叠侧边栏' : '展开侧边栏'}
            title={isSidebarOpen ? '折叠侧边栏' : '展开侧边栏'}
          >
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto px-6 py-7 [scrollbar-gutter:stable] lg:px-9 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
      </div>
    </ThemeContext.Provider>
  );
};

export default Layout;
