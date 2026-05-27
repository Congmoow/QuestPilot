import { useEffect, useState } from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { readToasterTheme, resolveToasterTheme, type ToasterTheme } from './toasterTheme';

function useToasterTheme(): ToasterTheme {
  const [theme, setTheme] = useState<ToasterTheme>(readToasterTheme);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    const syncTheme = () => setTheme(resolveToasterTheme(root));

    syncTheme();

    if (typeof MutationObserver === 'undefined') {
      return undefined;
    }

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  return theme;
}

export function Toaster() {
  const theme = useToasterTheme();

  return (
    <SonnerToaster
      theme={theme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'font-sans text-sm rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-popover dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100',
          title: 'font-semibold text-gray-900 dark:text-gray-100',
          description: 'text-gray-500 dark:text-gray-400',
          success:
            'border-green-100 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/60 dark:text-green-200',
          warning:
            'border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/60 dark:text-amber-200',
          error:
            'border-red-100 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/60 dark:text-red-200',
          closeButton:
            'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
        },
      }}
    />
  );
}
