import React, {
  type ChangeEventHandler,
  type InputHTMLAttributes,
  type KeyboardEventHandler,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Eye, EyeOff, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type FieldProps = {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function Field({ label, required = false, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs leading-5 text-gray-400">{hint}</p>}
      {error && <p className="text-xs leading-5 text-danger">{error}</p>}
    </div>
  );
}

export function TextInput({
  className,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { className?: string; error?: ReactNode | boolean }) {
  return (
    <input
      className={cn(
        'ui-control w-full px-4 text-sm placeholder:text-gray-400',
        error && 'border-danger focus:border-danger focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]',
        className,
      )}
      {...props}
    />
  );
}

export function TextareaInput({
  className,
  error,
  rows = 4,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  className?: string;
  error?: ReactNode | boolean;
}) {
  return (
    <textarea
      rows={rows}
      className={cn(
        'ui-control w-full resize-y px-4 py-3 text-sm leading-6 placeholder:text-gray-400',
        error && 'border-danger focus:border-danger focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]',
        className,
      )}
      {...props}
    />
  );
}

export function SelectInput({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { className?: string; children?: ReactNode }) {
  return (
    <div className="relative">
      <select
        className={cn(
          'ui-control w-full appearance-none px-4 pr-10 text-sm',
          'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")] bg-[length:18px] bg-[right_12px_center] bg-no-repeat',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function PasswordInput({
  show,
  onToggleShow,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  show: boolean;
  onToggleShow: () => void;
  className?: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className={cn('ui-control w-full px-4 pr-12 text-sm placeholder:text-gray-400', className)}
        {...props}
      />
      <button
        type="button"
        onClick={onToggleShow}
        aria-label={show ? '隐藏 API Key' : '显示 API Key'}
        title={show ? '隐藏 API Key' : '显示 API Key'}
        className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  onClear,
  onEnter,
  placeholder = '搜索',
  className,
}: {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onClear?: () => void;
  onEnter?: KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        value={value}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) onEnter(e);
        }}
        placeholder={placeholder}
        className="ui-control w-full px-11 text-sm placeholder:text-gray-400"
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="清空搜索"
          title="清空搜索"
          className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
