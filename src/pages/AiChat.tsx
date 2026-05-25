import { Loader2, Trash2, User } from 'lucide-react';
import {
  AIChatWelcome,
  AlertBanner,
  ChatComposer,
  ChatMessageBubble,
  PageHeaderNoTitle,
  SurfaceCard,
} from '../components/ui';
import AiIcon from '../features/ai-chat/components/AiIcon';
import ChatHistoryPanel from '../features/ai-chat/components/ChatHistoryPanel';
import MessageRenderer from '../features/ai-chat/components/MessageRenderer';
import PromptSelector from '../features/ai-chat/components/PromptSelector';
import { useAiChat } from '../features/ai-chat/hooks/useAiChat';
import {
  getAiProviderDisplayInfo,
  getAiProviderHeroImageClassName,
  getAiProviderHeroImagePath,
  getAiProviderHeroLabel,
} from '../features/ai-chat/utils/providerAssets';

const features = [
  {
    title: '上传题目解析',
    description: '上传题目图片\n获取详细解析',
    iconSrc: '/aichat-icon/icon-1.webp',
    iconClass: 'bg-blue-50 text-blue-600',
  },
  {
    title: '知识点总结',
    description: '梳理知识要点\n构建知识体系',
    iconSrc: '/aichat-icon/icon-2.webp',
    iconClass: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: '错题分析',
    description: '智能分析错因\n提供改进建议',
    iconSrc: '/aichat-icon/icon-3.webp',
    iconClass: 'bg-orange-50 text-orange-600',
  },
  {
    title: '生成练习题',
    description: '生成相似题目\n巩固知识掌握',
    iconSrc: '/aichat-icon/icon-4.webp',
    iconClass: 'bg-violet-50 text-violet-600',
  },
];

const AiChat = () => {
  const {
    messages,
    input,
    setInput,
    loading,
    error,
    prompts,
    selectedPrompt,
    setSelectedPrompt,
    showPromptDropdown,
    setShowPromptDropdown,
    chatHistoryList,
    currentChatId,
    showHistory,
    setShowHistory,
    aiConfig,
    messagesEndRef,
    inputRef,
    dropdownRef,
    historyRef,
    handleSend,
    handleKeyDown,
    loadChat,
    deleteChat,
    newChat,
    clearChat,
  } = useAiChat();
  const aiDisplayInfo = getAiProviderDisplayInfo(aiConfig.provider, aiConfig.modelId);
  const aiHeroImagePath = getAiProviderHeroImagePath(aiConfig.provider, aiConfig.modelId);
  const aiHeroImageClassName = getAiProviderHeroImageClassName(aiConfig.provider, aiConfig.modelId);
  const aiHeroImageLabel = getAiProviderHeroLabel(aiConfig.provider, aiConfig.modelId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <PageHeaderNoTitle
        subtitle="有任何学习问题，都可以问我"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ChatHistoryPanel
              panelRef={historyRef}
              show={showHistory}
              onToggle={() => setShowHistory(!showHistory)}
              historyList={chatHistoryList}
              currentChatId={currentChatId}
              onLoad={loadChat}
              onDelete={deleteChat}
              onNew={newChat}
            />
            <PromptSelector
              panelRef={dropdownRef}
              prompts={prompts}
              selectedPrompt={selectedPrompt}
              showDropdown={showPromptDropdown}
              onToggle={() => setShowPromptDropdown(!showPromptDropdown)}
              onSelect={(prompt) => {
                setSelectedPrompt(prompt);
                setShowPromptDropdown(false);
              }}
            />
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-danger"
              >
                <Trash2 size={16} />
                清空对话
              </button>
            )}
          </div>
        }
      />

      <SurfaceCard className="flex min-h-0 flex-1 flex-col overflow-hidden" padding="p-0">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">
          {messages.length === 0 ? (
            <div className="flex min-h-full items-center justify-center py-10">
              <AIChatWelcome
                features={features}
                heroImageSrc={aiHeroImagePath}
                heroImageAlt={aiDisplayInfo.name}
                heroImageClassName={aiHeroImageClassName}
                heroImageLabel={aiHeroImageLabel}
              />
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-5">
              {messages.map((msg, index) => (
                <ChatMessageBubble
                  key={index}
                  role={msg.role}
                  avatar={
                    msg.role === 'user' ? (
                      <User size={18} />
                    ) : (
                      <AiIcon provider={aiConfig.provider} modelId={aiConfig.modelId} size={28} />
                    )
                  }
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content.trim()}</div>
                  ) : (
                    <MessageRenderer content={msg.content} />
                  )}
                </ChatMessageBubble>
              ))}
              {loading && (
                <ChatMessageBubble
                  role="assistant"
                  avatar={
                    <AiIcon provider={aiConfig.provider} modelId={aiConfig.modelId} size={28} />
                  }
                >
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </ChatMessageBubble>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {error && (
          <div className="px-6 pb-3">
            <AlertBanner type="danger">{error}</AlertBanner>
          </div>
        )}

        <div className="p-5">
          <ChatComposer
            inputRef={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onSend={handleSend}
            loading={loading}
            disabled={!input.trim()}
            placeholder="输入你的问题..."
          />
        </div>
      </SurfaceCard>
    </div>
  );
};

export default AiChat;
