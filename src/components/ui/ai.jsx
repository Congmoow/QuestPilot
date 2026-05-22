import React from 'react';
import { Bot, Camera, FileSearch, Paperclip, Send, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ActionButton, EmptyState, SurfaceCard } from './base';

export function JsonEditorPanel({ value, onChange, placeholder, title = '输入 JSON 数据', supportText, className }) {
  const lineCount = Math.max(18, String(value || placeholder || '').split('\n').length);
  return (
    <SurfaceCard className={cn('overflow-hidden', className)} padding="p-0">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
        {supportText && <span className="text-xs text-gray-400">{supportText}</span>}
      </div>
      <div className="grid min-h-[520px] grid-cols-[54px_1fr] bg-white font-mono text-sm dark:bg-gray-800">
        <div className="select-none border-r border-gray-100 bg-slate-50 px-3 py-4 text-right leading-7 text-gray-400 dark:border-gray-700 dark:bg-gray-900/30">
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          spellCheck={false}
          className="min-h-[520px] w-full resize-none border-0 bg-transparent px-5 py-4 leading-7 text-gray-800 placeholder:text-gray-400 focus:shadow-none dark:text-gray-100"
        />
      </div>
    </SurfaceCard>
  );
}

export function ParsedQuestionItem({ question, index, typeLabel, onRemove, removeIcon: RemoveIcon }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-lg bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">{typeLabel}</span>
            <span className="text-xs font-semibold text-gray-400">#{index + 1}</span>
          </div>
          <p className="line-clamp-2 text-sm font-semibold leading-6 text-gray-900 dark:text-white">{question.content}</p>
          <p className="mt-2 text-xs font-semibold text-success">答案：{question.answer}</p>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex size-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-red-50 hover:text-danger"
            aria-label="删除解析结果"
          >
            {RemoveIcon && <RemoveIcon size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

export function AIChatWelcome({ features }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-4">
        <div className="absolute -left-12 top-10 size-14 rounded-2xl bg-blue-50" />
        <div className="absolute -right-12 top-8 size-12 rounded-full bg-primary-soft" />
        <div className="ui-icon-tile relative size-28 bg-gradient-to-br from-blue-50 to-blue-100 text-primary">
          <Bot size={58} strokeWidth={1.7} />
        </div>
      </div>
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">开始提问吧</h2>
      <p className="mt-3 text-base text-gray-500 dark:text-gray-400">我可以帮助你解答学习问题，提升学习效率</p>
      {features && (
        <div className="mt-9 grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon || Sparkles;
            return (
              <SurfaceCard key={feature.title} hover className="text-left" padding="p-5">
                <div className={cn('ui-icon-tile mb-4 size-12', feature.iconClass || 'bg-primary-soft text-primary')}>
                  <Icon size={24} />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">{feature.title}</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-500 dark:text-gray-400">{feature.description}</p>
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ChatMessageBubble({ role, children, avatar, className }) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse', className)}>
      <div className={cn('flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl', isUser ? 'bg-primary text-white' : 'bg-primary-soft text-primary')}>
        {avatar}
      </div>
      <div className={cn('max-w-[82%] rounded-3xl px-5 py-4 text-sm leading-7 shadow-sm', isUser ? 'rounded-tr-md bg-primary text-white' : 'rounded-tl-md bg-white text-gray-800 dark:bg-gray-700 dark:text-gray-100')}>
        {children}
      </div>
    </div>
  );
}

export function ChatComposer({ value, onChange, onKeyDown, onSend, loading, disabled, inputRef, placeholder = '输入你的问题...' }) {
  return (
    <div className="rounded-card border border-blue-200 bg-white p-4 shadow-soft dark:border-gray-700 dark:bg-gray-800">
      <textarea
        ref={inputRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={2}
        className="min-h-[72px] w-full resize-none border-0 bg-transparent p-2 text-base text-gray-900 placeholder:text-gray-400 focus:shadow-none dark:text-white"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton variant="secondary" size="sm" type="button" icon={Paperclip}>上传文件</ActionButton>
          <ActionButton variant="secondary" size="sm" type="button" icon={Camera}>拍照/截图</ActionButton>
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || loading}
          className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-soft transition-all hover:bg-primary-hover active:scale-95 disabled:cursor-not-allowed disabled:bg-primary/40"
          aria-label="发送问题"
          title="发送问题"
        >
          {loading ? <Sparkles size={22} className="animate-pulse" /> : <Send size={22} />}
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">按 Enter 发送，Shift + Enter 换行</p>
    </div>
  );
}

export function ParseEmptyState() {
  return (
    <EmptyState
      icon={FileSearch}
      title="解析结果将显示在这里"
      description="粘贴题目数据并完成解析后，可以在这里检查题型、题干和答案。"
      className="min-h-[520px]"
    />
  );
}
