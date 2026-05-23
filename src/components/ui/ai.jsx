import React, { useRef, useCallback } from 'react';
import { Bot, Camera, Paperclip, Send, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ActionButton, EmptyState, SurfaceCard } from './base';

export function JsonEditorPanel({ value, onChange, placeholder, title = '输入 JSON 数据', supportText, className }) {
  const lineCount = Math.max(18, String(value || placeholder || '').split('\n').length);
  const lineNumbersRef = useRef(null);
  const textareaRef = useRef(null);

  const handleScroll = useCallback(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  return (
    <SurfaceCard className={cn('overflow-hidden', className)} padding="p-0">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
        {supportText && <span className="text-xs text-gray-400">{supportText}</span>}
      </div>
      <div className="grid h-[434px] grid-cols-[54px_1fr] overflow-hidden bg-white font-mono text-sm dark:bg-gray-800">
        <div ref={lineNumbersRef} className="overflow-y-hidden select-none border-r border-gray-100 bg-slate-50 px-3 py-4 text-right leading-7 text-gray-400 dark:border-gray-700 dark:bg-gray-900/30">
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
          <div className="h-14" />
        </div>
        <textarea
          ref={textareaRef}
          onScroll={handleScroll}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          spellCheck={false}
          className="h-full w-full resize-none overflow-y-auto border-0 bg-transparent px-5 py-4 leading-7 text-gray-800 placeholder:text-gray-400 focus:shadow-none focus:outline-none dark:text-gray-100"
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
    <div className="flex flex-col items-center text-center w-full max-w-[880px]">
      <div className="relative mb-2">
        {/* Main bot image */}
        <img
          src="/ai-bot.png"
          alt="AI 助手"
          className="relative h-56 w-auto object-contain"
        />
      </div>

      {features && (
        <div className="mt-2 grid w-full grid-cols-4 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon || Sparkles;
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-[20px] border border-gray-100 bg-white text-left transition-all duration-200 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 dark:border-gray-700 dark:bg-gray-800"
              >
                {feature.iconSrc ? (
                  <img src={feature.iconSrc} alt="" className="h-24 w-full object-contain object-left" />
                ) : (
                  <div className={cn('flex h-28 items-center justify-center', feature.iconClass || 'bg-primary-soft text-primary')}>
                    <Icon size={56} />
                  </div>
                )}
                <div className="px-5 pb-5 pt-3">
                  <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">{feature.title}</h3>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-[1.7] text-gray-500 dark:text-gray-400">{feature.description}</p>
                </div>
                <div className="absolute bottom-5 right-5 flex size-7 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-colors group-hover:bg-primary-soft group-hover:text-primary dark:bg-gray-700">
                  <ArrowRight size={14} />
                </div>
              </div>
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
      {avatar && (
        <div className={cn('flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl', isUser ? 'bg-primary text-white' : 'bg-primary-soft text-primary')}>
          {avatar}
        </div>
      )}
      <div className={cn('max-w-[82%] rounded-3xl px-5 py-4 text-sm leading-7 shadow-sm', isUser ? 'rounded-tr-md bg-primary text-white' : 'rounded-tl-md bg-white text-gray-800 dark:bg-gray-700 dark:text-gray-100')}>
        {children}
      </div>
    </div>
  );
}

export function ChatComposer({ value, onChange, onKeyDown, onSend, loading, disabled, inputRef, placeholder = '输入你的问题...' }) {
  return (
    <div className="rounded-[20px] border border-blue-200/60 bg-white p-4 shadow-[0_2px_16px_rgba(37,99,235,0.06)] dark:border-gray-700 dark:bg-gray-800">
      <textarea
        ref={inputRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        className="min-h-[24px] w-full resize-none border-0 bg-transparent p-0 text-[15px] text-gray-900 placeholder:text-gray-400 focus:shadow-none focus:outline-none dark:text-white"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-blue-50 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-700"
          title="上传文件"
        >
          <Paperclip size={16} />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-gray-400">
            按 Enter 发送，Shift + Enter 换行
          </span>
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || loading}
            className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-white shadow-md shadow-blue-500/25 transition-all hover:bg-primary-hover active:scale-95 disabled:cursor-not-allowed disabled:bg-primary/40"
            aria-label="发送问题"
            title="发送问题"
          >
            {loading ? <Sparkles size={18} className="animate-pulse" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

const JiexiIcon = ({ size = 44, ...props }) => (
  <img src="/jiexi-icon.png" alt="解析" width={size} height={size} {...props} />
);

export function ParseEmptyState() {
  return (
    <EmptyState
      icon={JiexiIcon}
      title="解析结果将显示在这里"
      description="粘贴题目数据并完成解析后，可以在这里检查题型、题干和答案。"
      className="flex-1"
      bareIcon
    />
  );
}
