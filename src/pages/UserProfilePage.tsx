import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getAvatarUrl } from '../utils/avatar';
import { formatPublishedTime } from '../utils/helpers';

interface UserProfilePageProps {
  userId: string;
  onBack: () => void;
  onOpenPostDetail: (postId: string) => void;
  onStartChat: (userId: string) => void;
}

export default function UserProfilePage({
  userId,
  onBack,
  onOpenPostDetail,
  onStartChat
}: UserProfilePageProps) {
  const { currentUser, getUserProfile } = useApp();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getUserProfile>> | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const result = await getUserProfile(userId);
        if (mounted) {
          setProfile(result);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [getUserProfile, userId]);

  const isSelf = currentUser?.id === userId;
  const posts = useMemo(() => profile?.posts || [], [profile]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50">
      <div className="mx-auto min-h-full max-w-2xl">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur">
          <button
            onClick={onBack}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700"
            aria-label="返回"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900">个人主页</h1>
            <p className="text-xs text-gray-400">查看对方公开帖子</p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-500" />
          </div>
        ) : !profile ? (
          <div className="px-6 py-16 text-center text-gray-400">该用户不存在</div>
        ) : (
          <>
            <section className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 pb-8 pt-8 text-white">
              <div className="flex items-center gap-4">
                <img
                  src={getAvatarUrl(profile.user.avatarSeed)}
                  alt="Avatar"
                  className="h-20 w-20 rounded-full border-4 border-white/80 bg-white"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-2xl font-bold">{profile.user.nickname}</h2>
                  <p className="mt-1 text-sm text-white/70">共发布 {posts.length} 条帖子</p>
                </div>
              </div>
              {!isSelf && (
                <button
                  onClick={() => onStartChat(profile.user.id)}
                  className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-medium text-blue-600"
                >
                  去聊天
                </button>
              )}
            </section>

            <main className="space-y-4 px-4 py-5">
              {posts.length === 0 ? (
                <div className="rounded-2xl bg-white px-4 py-12 text-center text-sm text-gray-400 shadow-sm">
                  这个人还没有发布帖子
                </div>
              ) : (
                posts.map(post => (
                  <div
                    key={post.id}
                    className="cursor-pointer rounded-2xl bg-white p-4 shadow-sm"
                    onClick={() => onOpenPostDetail(post.id)}
                  >
                    <p
                      className="whitespace-pre-wrap text-sm leading-7 text-gray-800"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 5,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {post.content}
                    </p>
                    {post.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {post.tags.map(tag => (
                          <span
                            key={tag}
                            className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                      <span>{formatPublishedTime(post.createdAt)}</span>
                      <div className="flex items-center gap-4">
                        <span>❤️ {post.likes}</span>
                        <span>⭐ {post.collectionsCount}</span>
                        <span>💬 {post.commentsCount}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </main>
          </>
        )}
      </div>
    </div>
  );
}
