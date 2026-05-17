import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { ChatMessage, User } from '../types';
import { getAvatarUrl } from '../utils/avatar';

interface ChatPageProps {
  conversationId: string;
  onBack: () => void;
  onOpenUserActions: (user: User) => void;
  onDeleted?: () => void;
}

export default function ChatPage({ conversationId, onBack, onOpenUserActions, onDeleted }: ChatPageProps) {
  const {
    currentUser,
    conversations,
    loadConversationMessages,
    sendChatMessage,
    markConversationRead,
    deleteConversation
  } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const conversation = useMemo(
    () => conversations.find(item => item.id === conversationId) || null,
    [conversationId, conversations]
  );

  useEffect(() => {
    let mounted = true;

    const load = async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }
      try {
        const result = await loadConversationMessages(conversationId);
        if (mounted) {
          setMessages(result);
        }
        await markConversationRead(conversationId);
      } finally {
        if (mounted && showLoading) {
          setLoading(false);
        }
      }
    };

    void load();

    const timer = window.setInterval(() => {
      void load(false);
    }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [conversationId, loadConversationMessages, markConversationRead]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const message = await sendChatMessage(conversationId, trimmed);
      setMessages(prev => [...prev, message]);
      setInput('');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversation) return;
    if (!confirm(`确定要删除和 ${conversation.otherUser.nickname} 的聊天框吗？`)) return;

    try {
      await deleteConversation(conversationId);
      onDeleted?.();
      onBack();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('删除聊天框失败，请稍后再试');
    }
  };

  if (!conversation) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <button onClick={onBack} className="rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-700">
          返回消息列表
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      <header className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-4">
        <button
          onClick={onBack}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700"
          aria-label="返回"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <img
          src={getAvatarUrl(conversation.otherUser.avatarSeed)}
          alt="Avatar"
          className="h-10 w-10 rounded-full"
          onClick={() => onOpenUserActions(conversation.otherUser)}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{conversation.otherUser.nickname}</p>
          <p className="text-xs text-gray-400">私聊对话</p>
        </div>
        <button
          onClick={() => void handleDeleteConversation()}
          className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-100"
        >
          删除聊天框
        </button>
      </header>

      <main className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">
            还没有聊天内容，先打个招呼吧
          </div>
        ) : (
          messages.map(message => {
            const isMine = message.senderId === currentUser?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[78%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    isMine
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                      : 'bg-white text-gray-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className={`mt-1 text-[11px] ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
                    {new Date(message.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </main>

      <div className="border-t border-gray-100 bg-white px-4 py-3">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={event => setInput(event.target.value)}
            rows={2}
            placeholder={`对 ${conversation.otherUser.nickname} 说点什么...`}
            className="min-h-[52px] max-h-32 flex-1 resize-none rounded-2xl border border-blue-100 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-400"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || sending}
            className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
