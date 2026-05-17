import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Notification, User } from '../types';
import { getAvatarUrl } from '../utils/avatar';

interface MessagesPageProps {
  onOpenPostDetail: (postId: string, focusCommentId?: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenUserActions: (user: User) => void;
}

export default function MessagesPage({
  onOpenPostDetail,
  onOpenConversation,
  onOpenUserActions
}: MessagesPageProps) {
  const {
    notifications,
    conversations,
    loadNotifications,
    loadConversations,
    markNotificationsRead,
    deleteConversation,
    isAuthenticated
  } = useApp();
  const [showNotificationDetails, setShowNotificationDetails] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      loadConversations();
    }
  }, [isAuthenticated, loadConversations, loadNotifications]);

  const notificationUnreadCount = useMemo(
    () => notifications.filter(notification => !notification.read).length,
    [notifications]
  );
  const conversationUnreadCount = useMemo(
    () => conversations.reduce((total, conversation) => total + conversation.unreadCount, 0),
    [conversations]
  );

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const handleOpenNotificationBox = async () => {
    setShowNotificationDetails(prev => !prev);
    if (notificationUnreadCount > 0) {
      await markNotificationsRead();
    }
  };

  const handleOpenNotificationDetail = (notification: Notification) => {
    onOpenPostDetail(notification.postId, notification.commentId || undefined);
  };

  const handleDeleteConversation = async (conversationId: string, nickname: string) => {
    if (!confirm(`确定要删除和 ${nickname} 的聊天框吗？`)) return;

    try {
      await deleteConversation(conversationId);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('删除聊天框失败，请稍后再试');
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
        return '点赞了你的帖子';
      case 'collect':
        return '收藏了你的帖子';
      case 'comment':
        return '评论了你的帖子';
      case 'comment_like':
        return '点赞了你的评论';
      case 'comment_collect':
        return '收藏了你的评论';
      case 'comment_reply':
        return '回复了你的评论';
      default:
        return '和你产生了互动';
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
      case 'comment_like':
        return '❤️';
      case 'collect':
      case 'comment_collect':
        return '⭐';
      case 'comment':
      case 'comment_reply':
        return '💬';
      default:
        return '🔔';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="border-b border-gray-200 bg-white px-4 py-4">
        <h1 className="text-lg font-bold text-gray-800">消息</h1>
      </div>

      <div className="space-y-4 p-4">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <button
            onClick={() => void handleOpenNotificationBox()}
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-gray-50"
          >
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-2xl">
              🔔
              {notificationUnreadCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-red-500 px-1.5 text-center text-xs font-bold leading-5 text-white">
                  {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-gray-800">互动提醒</span>
                <span className="text-xs text-gray-400">
                  {notifications.length > 0 ? `${notifications.length} 条` : '暂无'}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-gray-500">
                {notifications[0]
                  ? `${notifications[0].actor.nickname}${getNotificationText(notifications[0])}`
                  : '点赞、收藏、评论和回复提醒都会收进这里'}
              </p>
            </div>
            <span className={`text-gray-300 transition-transform ${showNotificationDetails ? 'rotate-90' : ''}`}>›</span>
          </button>

          {showNotificationDetails && (
            <div className="border-t border-gray-100">
              {notifications.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-gray-400">
                  暂无互动提醒
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className="cursor-pointer px-4 py-4 transition hover:bg-gray-50"
                      onClick={() => handleOpenNotificationDetail(notification)}
                    >
                      <div className="flex gap-3">
                        <img
                          src={getAvatarUrl(notification.actor.avatarSeed)}
                          alt="Avatar"
                          className="h-10 w-10 flex-shrink-0 rounded-full"
                          onClick={event => {
                            event.stopPropagation();
                            if (notification.actor.id) {
                              onOpenUserActions(notification.actor);
                            }
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium text-gray-900">{notification.actor.nickname}</span>
                            {' '}
                            {getNotificationText(notification)}
                          </p>
                          {notification.commentContent && (
                            <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                              "{notification.commentContent}"
                            </p>
                          )}
                          {notification.targetCommentContent && (
                            <p className="mt-1 line-clamp-2 text-xs text-blue-500">
                              关联评论：{notification.targetCommentContent}
                            </p>
                          )}
                          {notification.postContent && (
                            <p className="mt-2 line-clamp-2 text-xs text-gray-400">
                              帖子内容：{notification.postContent}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                            <span>{formatTime(notification.createdAt)}</span>
                            {notification.tags && notification.tags[0] && (
                              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-600">
                                #{notification.tags[0]}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-xl">{getNotificationIcon(notification.type)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800">聊天会话</span>
              <span className="text-xs text-gray-400">
                未读 {conversationUnreadCount}
              </span>
            </div>
          </div>

          {conversations.length === 0 ? (
            <div className="px-4 py-14 text-center text-sm text-gray-400">
              暂无聊天会话，点击他人头像后可发起聊天
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map(conversation => (
                <div
                  key={conversation.id}
                  className="cursor-pointer px-4 py-4 transition hover:bg-gray-50"
                  onClick={() => onOpenConversation(conversation.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={getAvatarUrl(conversation.otherUser.avatarSeed)}
                        alt="Avatar"
                        className="h-12 w-12 rounded-full"
                        onClick={event => {
                          event.stopPropagation();
                          onOpenUserActions(conversation.otherUser);
                        }}
                      />
                      {conversation.unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-red-500 px-1.5 text-center text-xs font-bold leading-5 text-white">
                          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-800">{conversation.otherUser.nickname}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{formatTime(conversation.updatedAt)}</span>
                          <button
                            onClick={event => {
                              event.stopPropagation();
                              void handleDeleteConversation(conversation.id, conversation.otherUser.nickname);
                            }}
                            className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-500"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 truncate text-sm text-gray-500">
                        {conversation.lastMessage?.content || '点击开始聊天'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
