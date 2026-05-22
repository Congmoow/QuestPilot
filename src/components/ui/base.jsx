import React from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

const buttonVariants = {
  primary: 'bg-primary text-white shadow-soft hover:bg-primary-hover active:bg-primary-active disabled:bg-primary/45',
  secondary: 'border border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50 hover:text-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
  ghost: 'text-gray-600 hover:bg-blue-50 hover:text-primary dark:text-gray-300 dark:hover:bg-gray-700',
  danger: 'bg-danger text-white shadow-sm hover:bg-red-600 disabled:bg-danger/45',
  success: 'bg-success text-white shadow-sm hover:bg-green-700 disabled:bg-success/45',
};

const badgeVariants = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  muted: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  purple: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

const alertVariants = {
  info: {
    icon: Info,
    className: 'border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-green-100 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300',
  },
  warning: {
    icon: AlertCircle,
    className: 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  },
  danger: {
    icon: XCircle,
    className: 'border-red-100 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
  },
};

export function PageHeader({ title, subtitle, actions, className }) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="ui-title">{title}</h1>
        {subtitle && <p className="ui-subtitle mt-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

export function SurfaceCard({ children, className, hover = false, padding = 'p-6', as: Component = 'section' }) {
  return (
    <Component className={cn('ui-card', hover && 'ui-card-hover', padding, className)}>
      {children}
    </Component>
  );
}

export function ToolbarCard({ children, className }) {
  return (
    <SurfaceCard className={cn('flex flex-col gap-4', className)} padding="p-5">
      {children}
    </SurfaceCard>
  );
}

export function ActionButton({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  className,
  type = 'button',
  ...props
}) {
  const sizes = {
    sm: 'h-10 px-4 text-sm',
    md: 'h-[46px] px-5 text-sm',
    lg: 'h-12 px-6 text-base',
  };

  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70',
        buttonVariants[variant] || buttonVariants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : Icon ? <Icon size={18} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ label, icon: Icon, variant = 'ghost', className, type = 'button', ...props }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-control transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60',
        buttonVariants[variant] || buttonVariants.ghost,
        className
      )}
      {...props}
    >
      {Icon && <Icon size={18} />}
    </button>
  );
}

export function StatusBadge({ children, variant = 'primary', className }) {
  return (
    <span className={cn('inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold', badgeVariants[variant] || badgeVariants.primary, className)}>
      {children}
    </span>
  );
}

export function AlertBanner({ type = 'info', title, children, className }) {
  const config = alertVariants[type] || alertVariants.info;
  const Icon = config.icon;

  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm', config.className, className)}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-1')}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, description, action, className }) {
  return (
    <div className={cn('flex min-h-[260px] flex-col items-center justify-center rounded-card px-6 py-12 text-center', className)}>
      <div className="relative mb-5">
        <div className="absolute -left-4 top-3 size-3 rounded-full bg-blue-200/70" />
        <div className="absolute -right-5 bottom-2 size-2 rounded-full bg-primary/40" />
        <div className="ui-icon-tile size-24 bg-gradient-to-br from-blue-50 to-blue-100 text-primary">
          <Icon size={44} strokeWidth={1.8} />
        </div>
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-7 text-gray-500 dark:text-gray-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function SegmentedTabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-800', className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            title={tab.title}
            className={cn(
              'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'bg-primary-soft text-primary shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
            )}
          >
            {Icon && <Icon size={17} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
