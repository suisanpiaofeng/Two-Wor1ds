import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import AuthPage from './pages/AuthPage';
import SquarePage from './pages/SquarePage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';
import PostDetailPage from './pages/PostDetailPage';
import ChatPage from './pages/ChatPage';
import UserProfilePage from './pages/UserProfilePage';
import TabBar from './components/TabBar';
import type { User } from './types';
import { getAvatarUrl } from './utils/avatar';

function MainContent() {
  const [activeTab, setActiveTab] = useState<'square' | 'messages' | 'profile'>('square');
  const [activePostTarget, setActivePostTarget] = useState<{ postId: string; focusCommentId?: string } | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeUserProfileId, setActiveUserProfileId] = useState<string | null>(null);
  const [userActionTarget, setUserActionTarget] = useState<User | null>(null);
  const { isAuthenticated, loading, openConversationWithUser } = useApp();

  const handleOpenUserActions = (user: User) => {
    setUserActionTarget(user);
  };

  const handleStartChat = async (userId: string) => {
    const conversation = await openConversationWithUser(userId);
    setActiveTab('messages');
    setUserActionTarget(null);
    setActiveUserProfileId(null);
    setActiveConversationId(conversation.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 relative">
      {activeTab === 'square' && (
        <SquarePage
          onOpenPostDetail={(postId, focusCommentId) => setActivePostTarget({ postId, focusCommentId })}
          onOpenUserActions={handleOpenUserActions}
        />
      )}
      {activeTab === 'messages' && (
        <MessagesPage
          onOpenPostDetail={(postId, focusCommentId) => setActivePostTarget({ postId, focusCommentId })}
          onOpenConversation={setActiveConversationId}
          onOpenUserActions={handleOpenUserActions}
        />
      )}
      {activeTab === 'profile' && <ProfilePage onOpenPostDetail={(postId, focusCommentId) => setActivePostTarget({ postId, focusCommentId })} />}
      {!activePostTarget && !activeConversationId && !activeUserProfileId && (
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      )}
      {activePostTarget && (
        <PostDetailPage
          postId={activePostTarget.postId}
          focusCommentId={activePostTarget.focusCommentId}
          onBack={() => setActivePostTarget(null)}
          onAvatarClick={handleOpenUserActions}
        />
      )}
      {activeUserProfileId && (
        <UserProfilePage
          userId={activeUserProfileId}
          onBack={() => setActiveUserProfileId(null)}
          onOpenPostDetail={(postId) => setActivePostTarget({ postId })}
          onStartChat={(userId) => void handleStartChat(userId)}
        />
      )}
      {activeConversationId && (
        <ChatPage
          conversationId={activeConversationId}
          onBack={() => setActiveConversationId(null)}
          onOpenUserActions={handleOpenUserActions}
          onDeleted={() => setActiveConversationId(null)}
        />
      )}
      {userActionTarget && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 px-4 pb-8" onClick={() => setUserActionTarget(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <img
                src={getAvatarUrl(userActionTarget.avatarSeed)}
                alt="Avatar"
                className="h-12 w-12 rounded-full"
              />
              <div>
                <p className="font-medium text-gray-900">{userActionTarget.nickname}</p>
                <p className="text-xs text-gray-400">选择你要进行的操作</p>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setUserActionTarget(null);
                  setActiveUserProfileId(userActionTarget.id);
                }}
                className="w-full rounded-2xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-800"
              >
                查看主页
              </button>
              <button
                onClick={() => void handleStartChat(userActionTarget.id)}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-medium text-white"
              >
                去聊天
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

export default App;
