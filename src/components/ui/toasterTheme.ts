import type { ToasterProps } from 'sonner';

export type ToasterTheme = Exclude<NonNullable<ToasterProps['theme']>, 'system'>;

export type ThemeRoot = {
  classList: {
    contains: (token: string) => boolean;
  };
} | null;

export function resolveToasterTheme(root: ThemeRoot): ToasterTheme {
  return root?.classList.contains('dark') ? 'dark' : 'light';
}

export function readToasterTheme(): ToasterTheme {
  if (typeof document === 'undefined') {
    return 'light';
  }

  return resolveToasterTheme(document.documentElement);
}
