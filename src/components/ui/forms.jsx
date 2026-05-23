import React from 'react';
import { Eye, EyeOff, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Field({ label, required = false, hint, error, children, className }) {
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

export function TextInput({ className, error, ...props }) {
  return (
    <input
      className={cn(
        'ui-control w-full px-4 text-sm placeholder:text-gray-400',
        error && 'border-danger focus:border-danger focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]',
        className
      )}
      {...props}
    />
  );
}

export function TextareaInput({ className, error, rows = 4, ...props }) {
  return (
    <textarea
      rows={rows}
      className={cn(
        'ui-control w-full resize-y px-4 py-3 text-sm leading-6 placeholder:text-gray-400',
        error && 'border-danger focus:border-danger focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]',
        className
      )}
      {...props}
    />
  );
}

export function SelectInput({ className, children, ...props }) {
  return (
    <select className={cn('ui-control w-full px-4 text-sm', className)} {...props}>
      {children}
    </select>
  );
}

export function PasswordInput({ show, onToggleShow, className, ...props }) {
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

export function SearchInput({ value, onChange, onClear, onEnter, placeholder = '搜索', className }) {
  return (
    <div className={cn('relative', className)}>
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
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
