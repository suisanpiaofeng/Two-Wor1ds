import { useState, useEffect, useMemo, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useApp } from '../context/AppContext';
import type { Comment, Post } from '../types';
import { getAvatarUrl } from '../utils/avatar';
import { formatPublishedTime } from '../utils/helpers';

interface ProfilePageProps {
  onOpenPostDetail: (postId: string, focusCommentId?: string) => void;
}

const AVATAR_MAX_SIZE = 2 * 1024 * 1024;
const AVATAR_OUTPUT_SIZE = 160;
const AVATAR_MAX_DATA_URL_LENGTH = 280000;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('头像读取失败'));
    };
    reader.onerror = () => reject(new Error('头像读取失败'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('头像解析失败'));
    image.src = src;
  });
}

async function buildAvatarDataUrl(file: File): Promise<string> {
  const source = await fileToDataUrl(file);
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('浏览器不支持头像处理');
  }

  const cropSize = Math.min(image.width, image.height);
  const sourceX = (image.width - cropSize) / 2;
  const sourceY = (image.height - cropSize) / 2;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropSize,
    cropSize,
    0,
    0,
    AVATAR_OUTPUT_SIZE,
    AVATAR_OUTPUT_SIZE
  );

  const compressed = canvas.toDataURL('image/jpeg', 0.82);
  if (compressed.length > AVATAR_MAX_DATA_URL_LENGTH) {
    throw new Error('头像图片仍然过大，请换一张更小的图片');
  }

  return compressed;
}

export default function ProfilePage({ onOpenPostDetail }: ProfilePageProps) {
  const {
    currentUser,
    logout,
    updateProfile,
    posts,
    collectionPosts,
    myComments,
    collectedPosts,
    collectedComments,
    loadCollections,
    loadMyComments,
    deleteComment,
    isAuthenticated
  } = useApp();
  const [editing, setEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [activeTab, setActiveTab] = useState<'posts' | 'collections' | 'comments'>('posts');
  const [loading, setLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadActiveTabData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'collections') {
          await loadCollections();
        }
        if (activeTab === 'comments') {
          await loadMyComments();
        }
      } finally {
        setLoading(false);
      }
    };

    void loadActiveTabData();
  }, [activeTab, isAuthenticated, loadCollections, loadMyComments]);

  useEffect(() => {
    if (currentUser) {
      setEditNickname(currentUser.nickname);
    }
  }, [currentUser]);

  const handleSaveNickname = async () => {
    if (!editNickname.trim()) return;
    try {
      await updateProfile(editNickname.trim());
      setEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleLogout = async () => {
    if (confirm('确定要退出登录吗？')) {
      await logout();
    }
  };

  const handleDeleteComment = async (comment: Comment) => {
    if (!comment.postId) return;
    if (!confirm('确定要删除这条评论吗？')) return;

    setLoading(true);
    try {
      await deleteComment(comment.postId, comment.id);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('请选择图片文件');
      return;
    }

    if (file.size > AVATAR_MAX_SIZE) {
      setAvatarError('头像图片不能超过 2MB');
      return;
    }

    setAvatarUploading(true);
    setAvatarError('');
    try {
      const avatarDataUrl = await buildAvatarDataUrl(file);
      await updateProfile(currentUser.nickname, avatarDataUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : '头像上传失败';
      setAvatarError(message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const userPosts = posts.filter(p => p.userId === currentUser?.id);
  const syncedCollections = useMemo(() => {
    return collectionPosts
      .filter(post => collectedPosts.includes(post.id))
      .map(post => posts.find(item => item.id === post.id) || post);
  }, [collectionPosts, collectedPosts, posts]);

  const totalCollectionsCount = syncedCollections.length + collectedComments.length;

  const formatCommentType = (comment: Comment) => {
    return comment.rootCommentId ? '楼内回复' : '主评论';
  };

  const renderPostCard = (post: Post, showAuthor = false) => (
    <div
      key={post.id}
      className="bg-white rounded-xl p-4 shadow-sm cursor-pointer"
      onClick={() => onOpenPostDetail(post.id)}
    >
      {showAuthor && (
        <div className="flex items-center gap-2 mb-2">
          <img
            src={getAvatarUrl(post.userAvatarSeed)}
            alt="Avatar"
            className="w-8 h-8 rounded-full"
          />
          <span className="text-sm font-medium text-gray-700">
            {post.userNickname}
          </span>
        </div>
      )}
      <p
        className="mb-2 text-gray-800 whitespace-pre-wrap"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {post.content}
      </p>
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {post.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-gray-400 text-xs">
        <span>{formatPublishedTime(post.createdAt)}</span>
        <div className="flex items-center gap-4">
          <span>❤️ {post.likes}</span>
          <span>⭐ {post.collectionsCount}</span>
          <span>💬 {post.commentsCount}</span>
        </div>
      </div>
    </div>
  );

  const renderCommentCard = (comment: Comment, allowDelete = false) => (
    <div
      key={comment.id}
      className="bg-white rounded-xl p-4 shadow-sm cursor-pointer"
      onClick={() => comment.postId && onOpenPostDetail(comment.postId, comment.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{comment.userNickname}</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
              {formatCommentType(comment)}
            </span>
          </div>
          {comment.replyToUserNickname && (
            <p className="mt-1 text-xs text-blue-500">回复 @{comment.replyToUserNickname}</p>
          )}
        </div>
        {allowDelete && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              void handleDeleteComment(comment);
            }}
            className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-500"
          >
            删除
          </button>
        )}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800">
        {comment.content}
      </p>

      <div className="mt-3 rounded-2xl bg-gray-50 px-3 py-2">
        <p className="text-xs text-gray-400">所在帖子</p>
        <p
          className="mt-1 text-sm text-gray-600"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {comment.postContent || '原帖内容已不可见'}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>{formatPublishedTime(comment.createdAt)}</span>
        <div className="flex items-center gap-4">
          <span>❤️ {comment.likesCount}</span>
          <span>⭐ {comment.collectionsCount}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 pt-12 pb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={getAvatarUrl(currentUser?.avatarSeed)}
              alt="Avatar"
              className="w-20 h-20 rounded-full border-4 border-white shadow-lg"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="text-purple-500 text-lg">📷</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => void handleSelectAvatar(event)}
            />
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  className="flex-1 bg-white/20 border border-white/30 rounded-lg px-3 py-1 text-white placeholder-white/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNickname();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                />
                <button
                  onClick={handleSaveNickname}
                  className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30"
                >
                  保存
                </button>
              </div>
            ) : (
              <h1
                className="text-xl font-bold cursor-pointer hover:underline"
                onClick={() => setEditing(true)}
              >
                {currentUser?.nickname}
                <span className="text-sm font-normal ml-2">✏️</span>
              </h1>
            )}
            <p className="text-white/70 text-sm">{currentUser?.email}</p>
            <p className="mt-1 text-xs text-white/80">
              {avatarUploading ? '头像上传中...' : '点击头像右下角可上传自己的图片'}
            </p>
            {avatarError && (
              <p className="mt-1 text-xs text-red-100">{avatarError}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{userPosts.length}</div>
            <div className="text-white/70 text-xs">帖子</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{totalCollectionsCount}</div>
            <div className="text-white/70 text-xs">收藏</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {myComments.length}
            </div>
            <div className="text-white/70 text-xs">我的评论</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 bg-white border-b border-gray-200">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'posts'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500'
          }`}
        >
          我的帖子
        </button>
        <button
          onClick={() => setActiveTab('collections')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'collections'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500'
          }`}
        >
          我的收藏
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'comments'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500'
          }`}
        >
          我的评论
        </button>
      </div>

      <div className="p-4">
        {activeTab === 'posts' && (
          <div className="space-y-4">
            {userPosts.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">📝</div>
                <p>还没有发布过帖子</p>
              </div>
            ) : (
              userPosts.map(post => renderPostCard(post))
            )}
          </div>
        )}

        {activeTab === 'collections' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-200 border-t-purple-500 mx-auto"></div>
              </div>
            ) : syncedCollections.length === 0 && collectedComments.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">❤️</div>
                <p>还没有收藏任何内容</p>
              </div>
            ) : (
              <>
                {syncedCollections.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">收藏的帖子</h3>
                      <span className="text-xs text-gray-400">{syncedCollections.length} 条</span>
                    </div>
                    {syncedCollections.map(post => renderPostCard(post, true))}
                  </section>
                )}

                {collectedComments.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">收藏的评论</h3>
                      <span className="text-xs text-gray-400">{collectedComments.length} 条</span>
                    </div>
                    {collectedComments.map(comment => renderCommentCard(comment))}
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-200 border-t-purple-500 mx-auto"></div>
              </div>
            ) : myComments.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">💬</div>
                <p>还没有发表任何评论</p>
              </div>
            ) : (
              myComments.map(comment => renderCommentCard(comment, true))
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-24 left-4 right-4">
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}
