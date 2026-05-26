import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      theme="system"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'font-sans text-sm rounded-card border border-gray-200 shadow-popover dark:border-gray-700',
          title: 'font-semibold',
          description: 'text-gray-500 dark:text-gray-400',
        },
      }}
    />
  );
}
